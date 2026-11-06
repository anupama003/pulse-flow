// Deterministic safety net that runs AFTER the LLM and BEFORE anything is saved.
// The LLM is good at language and this file is good at arithmetic. Neither is trusted alone.
//
//  1. Contradictory vitals → re-reads the numbers itself and escalates to critical if needed.
//  2. Mid-sentence corrections → strips any retracted order that leaked into the task list.
//  3. Missing SBAR sections → reported as `missingFields` so the UI asks the doctor for them.
//
// Pure functions with no I/O, so they can be unit-tested (see scripts/validate-cases.ts).

import type { Correction, ExtractedActionItem, Sbar } from "./schema";

export const SBAR_KEYS = ["situation", "background", "assessment", "recommendation"] as const;
export type SbarKey = (typeof SBAR_KEYS)[number];

export interface Finding {
  label: string; // shown as a blush pill, e.g. "BP 70/40"
  rule: string; // why, e.g. "SBP < 90"
}

export interface DraftInput {
  sbar: Sbar;
  isCritical: boolean;
  criticalReasons: string[];
  actionItems: ExtractedActionItem[];
  corrections: Correction[];
  uncertainties: string[];
}

export interface ValidatedDraft extends DraftInput {
  autoEscalated: boolean;
  missingFields: SbarKey[];
  findings: Finding[];
}

// ─── 1. Vitals ────────────────────────────────────────────────────────────────

const FOLLOW_UP = String.raw`[^.;]{0,40}?\b(?:repeat(?:ed)?|now|recheck(?:ed)?|came back|down to|up to|improved to|dropped to)\b\s*(?:was|is|of|to|at)?\s*`;

/**
 * Last value of one vital/lab. Handles "K 6.1, repeat 4.8" by preferring the follow-up value,
 * because the last mention is usually the current state.
 */
function lastValue(text: string, label: string, num: string, gap = String.raw`\s*(?:came back(?: at| as)?|was|is|of|at|now|:|=)?\s*`): number | undefined {
  const re = new RegExp(`(?:${label})${gap}(${num})\\b(?:${FOLLOW_UP}(${num})\\b)?`, "gi");
  let val: number | undefined;
  for (const m of text.matchAll(re)) val = Number(m[2] ?? m[1]);
  return val;
}

/**
 * Last blood pressure, whether written "BP 70/40", "pressure of 70 over 40", "BP 70 by 40" (common in
 * Indian dictation) or just "70 over 40". "by" only counts after a BP label, so "5 by 5" is never a BP.
 */
function lastBp(text: string): [number, number] | undefined {
  const res = [/(?:\bbp\b|blood pressure|pressure)[^0-9]{0,20}(\d{2,3})\s*(?:\/|over|by)\s*(\d{2,3})/gi, /\b(\d{2,3})\s+over\s+(\d{2,3})\b/gi];
  let best: { i: number; end: number; v: [number, number] } | undefined;
  for (const re of res)
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      if (!best || i >= best.i) best = { i, end: i + m[0].length, v: [Number(m[1]), Number(m[2])] };
    }
  // "BP 70/40, after fluids 100/60": a bare a/b shortly after a BP mention is the newer reading.
  if (best) {
    const after = text.slice(best.end).match(/^[^.;]{0,60}?\b(\d{2,3})\s*\/\s*(\d{2,3})\b/);
    if (after && Number(after[1]) >= 50) best.v = [Number(after[1]), Number(after[2])];
  }
  return best?.v;
}

/** Reads the current value of each vital in free text. Numbers spelled as words are not parsed (Wispr outputs digits). */
export function readVitals(text: string) {
  const t = text.replace(/,(?=\d)/g, "");
  const bp = lastBp(t);
  const temp = lastValue(t, String.raw`\btemp(?:erature)?|fever(?: of)?|febrile(?: at| to)?|spiked(?: to)?`, String.raw`\d{2,3}(?:\.\d)?`, "[^0-9]{0,12}");
  return {
    sbp: bp?.[0],
    dbp: bp?.[1],
    hr: lastValue(t, String.raw`\bhr\b|heart rate|pulse(?: rate)?|tachycardic(?: at| to)?`, String.raw`\d{2,3}`, "[^0-9]{0,12}"),
    rr: lastValue(t, String.raw`\brr\b|resp(?:iratory)? rate|breathing at`, String.raw`\d{1,2}`, "[^0-9]{0,12}"),
    spo2: lastValue(t, String.raw`\bspo2\b|\bsp o2\b|\bsats?\b|saturation|saturating`, String.raw`\d{2,3}`, "[^0-9]{0,12}"),
    tempC: temp === undefined ? undefined : temp > 45 ? +(((temp - 32) * 5) / 9).toFixed(1) : temp,
    k: lastValue(t, String.raw`potassium|\bk\+?`, String.raw`\d(?:\.\d)?`),
    na: lastValue(t, String.raw`sodium|\bna\+?`, String.raw`\d{3}`),
    glucose: lastValue(t, String.raw`sugars?|glucose|\bg?rbs\b|\bcbg\b`, String.raw`\d{2,3}`),
    hb: lastValue(t, String.raw`\bhb\b|ha?emoglobin`, String.raw`\d{1,2}(?:\.\d)?`),
    lactate: lastValue(t, String.raw`lactate`, String.raw`\d{1,2}(?:\.\d)?`),
    gcs: lastValue(t, String.raw`\bgcs\b`, String.raw`\d{1,2}`),
  };
}

/** Same thresholds as the system prompt's <critical_flag>, so the two layers agree. */
export function criticalFindings(text: string, ageYears?: number): Finding[] {
  const v = readVitals(text);
  const f: Finding[] = [];
  const peds = ageYears !== undefined && ageYears < 16;

  if (v.sbp !== undefined && v.dbp !== undefined) {
    const map = Math.round((v.sbp + 2 * v.dbp) / 3);
    const sbpFloor = peds ? (ageYears! <= 10 ? 70 + 2 * ageYears! : 90) : 90;
    if (v.sbp < sbpFloor) f.push({ label: `BP ${v.sbp}/${v.dbp}`, rule: `SBP < ${sbpFloor}` });
    else if (map < 65) f.push({ label: `BP ${v.sbp}/${v.dbp}`, rule: `MAP ${map} < 65` });
  }
  if (!peds && v.hr !== undefined && (v.hr > 120 || v.hr < 50)) f.push({ label: `HR ${v.hr}`, rule: v.hr > 120 ? "HR > 120" : "HR < 50" });
  if (!peds && v.rr !== undefined && (v.rr > 24 || v.rr < 10)) f.push({ label: `RR ${v.rr}`, rule: v.rr > 24 ? "RR > 24" : "RR < 10" });
  if (v.spo2 !== undefined && v.spo2 <= 100 && v.spo2 < 92) f.push({ label: `SpO2 ${v.spo2}%`, rule: "SpO2 < 92%" });
  if (v.k !== undefined && (v.k >= 6 || v.k <= 2.5)) f.push({ label: `K+ ${v.k}`, rule: v.k >= 6 ? "K+ ≥ 6.0" : "K+ ≤ 2.5" });
  if (v.na !== undefined && (v.na <= 120 || v.na >= 160)) f.push({ label: `Na+ ${v.na}`, rule: v.na <= 120 ? "Na+ ≤ 120" : "Na+ ≥ 160" });
  if (v.glucose !== undefined && v.glucose < 60) f.push({ label: `Glucose ${v.glucose}`, rule: "Glucose < 60" });
  if (v.hb !== undefined && v.hb < 7) f.push({ label: `Hb ${v.hb}`, rule: "Hb < 7" });
  if (v.lactate !== undefined && v.lactate > 4) f.push({ label: `Lactate ${v.lactate}`, rule: "Lactate > 4" });
  if (v.gcs !== undefined && v.gcs <= 12) f.push({ label: `GCS ${v.gcs}`, rule: "GCS ≤ 12" });
  return f;
}

const STABLE_WORDS = /\b(stable|fine|okay|ok|comfortable|no issues|nothing much|doing well|settled)\b/i;

// ─── 2. Corrections ───────────────────────────────────────────────────────────

const CORRECTION_MARKER = /\b(no,? wait|no no|sorry|i mean|scratch that|actually|correction|make that|rather|instead)\b/i;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(the|a|an|please|pls)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True if `task` is the order the speaker took back (and not part of what replaced it). */
export function isRetracted(task: string, c: Correction): boolean {
  const t = norm(task);
  const r = norm(c.retracted);
  if (!t || !r) return false;
  if (t === r) return true;
  const inReplacement = c.replacedWith ? norm(c.replacedWith).includes(t) : false;
  return r.includes(t) && !inReplacement;
}

// ─── 3. Putting it together ───────────────────────────────────────────────────

/**
 * @param text  everything dictated about this patient (their transcript segment + AI SBAR text)
 * @param ageYears  from the census, so paediatric thresholds can be used
 */
export function validateDraft(input: DraftInput, ctx: { text: string; ageYears?: number }): ValidatedDraft {
  const out: ValidatedDraft = {
    ...input,
    criticalReasons: [...input.criticalReasons],
    uncertainties: [...input.uncertainties],
    actionItems: [...input.actionItems],
    autoEscalated: false,
    missingFields: [],
    findings: [],
  };
  const pushOnce = (arr: string[], s: string) => !arr.includes(s) && arr.push(s);

  // (a) Contradictory vitals → auto-escalate
  const sbarText = SBAR_KEYS.map((k) => input.sbar[k]).join(". ");
  // Prefer the doctor's own words; fall back to the AI's SBAR text if we couldn't locate them.
  out.findings = criticalFindings(ctx.text.trim() ? ctx.text : sbarText, ctx.ageYears);
  if (out.findings.length) {
    if (!out.isCritical) {
      out.isCritical = true;
      out.autoEscalated = true;
    }
    for (const f of out.findings) pushOnce(out.criticalReasons, f.label);
    if (STABLE_WORDS.test(input.sbar.assessment) || (!input.isCritical && STABLE_WORDS.test(ctx.text))) {
      pushOnce(
        out.uncertainties,
        `Dictated as stable, but ${out.findings.map((f) => `${f.label} (${f.rule})`).join(", ")} meets critical criteria. Auto-escalated to critical. Please confirm.`,
      );
    } else if (out.autoEscalated) {
      pushOnce(out.uncertainties, `Auto-escalated to critical: ${out.findings.map((f) => `${f.label} (${f.rule})`).join(", ")}.`);
    }
  }
  if (ctx.ageYears !== undefined && ctx.ageYears < 16) {
    pushOnce(out.uncertainties, "Paediatric patient: adult HR/RR cut-offs were not applied. Review against age-specific norms.");
  }

  // (b) Corrections → strip leaked retracted orders, nudge when a correction may have been missed
  for (const c of out.corrections) {
    const leaked = out.actionItems.filter((a) => isRetracted(a.description, c));
    if (leaked.length) {
      out.actionItems = out.actionItems.filter((a) => !leaked.includes(a));
      for (const a of leaked) pushOnce(out.uncertainties, `Removed “${a.description}”: you retracted it (“${c.quote}”).`);
    }
  }
  const marker = ctx.text.match(CORRECTION_MARKER);
  if (marker && out.corrections.length === 0) {
    const i = marker.index ?? 0;
    const snippet = ctx.text.slice(Math.max(0, i - 40), i + 50).trim();
    pushOnce(out.uncertainties, `Possible self-correction near “…${snippet}…”. Check the orders reflect your final intent.`);
  }

  // (c) Missing sections → Pending in the UI, never invented
  out.missingFields = SBAR_KEYS.filter((k) => !input.sbar[k].trim());
  if (out.missingFields.length === 4 && out.actionItems.length === 0) {
    pushOnce(out.uncertainties, "Nothing could be structured for this patient. Please re-dictate.");
  }
  return out;
}

// ─── Transcript segmentation (multi-patient brain dump) ───────────────────────

/** Best-effort: the slice of the transcript from this patient's bed/name mention up to the next "bed …". */
export function segmentFor(transcript: string, bed: string | null, name: string | null): string {
  const lower = transcript.toLowerCase();
  const needles = [
    bed && new RegExp(`\\bbed\\s*(?:no\\.?|number)?\\s*${bed.replace(/[^a-z0-9]/gi, "[^a-z0-9]?")}\\b`, "i"),
    bed && new RegExp(`\\b${bed.replace(/[^a-z0-9]/gi, "[^a-z0-9]?")}\\b`, "i"),
    name && new RegExp(`\\b${name.split(/\s+/)[0].replace(/[^a-z]/gi, "")}\\b`, "i"),
  ].filter(Boolean) as RegExp[];
  for (const re of needles) {
    const m = re.exec(lower);
    if (!m) continue;
    const rest = transcript.slice(m.index + m[0].length);
    const next = rest.search(/\b(?:bed|icu|picu|peds)\s*(?:no\.?|number)?\s*[a-z]?-?\d+/i);
    return transcript.slice(m.index, next === -1 ? undefined : m.index + m[0].length + next);
  }
  return "";
}
