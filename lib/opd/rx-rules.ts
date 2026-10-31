// Deterministic checks on an AI-parsed prescription, run before the consultant sees it and
// AGAIN at signing (the server never trusts the client's copy). Pure module, unit-tested.
//
// This is NOT a drug-interaction or dose-range engine. It catches structural gaps, duplicates,
// documented-allergy conflicts and paediatric dosing that needs confirming.

export interface RxItemInput {
  drug: string;
  form: string | null;
  strength: string | null;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
}

export interface RxItem extends RxItemInput {
  timesPerDay: number | null;
  durationDays: number | null;
  quantity: number | null;
  needsReview: boolean;
  reviewReason: string | null;
}

export interface RxWarning {
  level: "ALLERGY" | "REVIEW";
  itemIndex: number | null;
  message: string;
}

// ─── Frequency ────────────────────────────────────────────────────────────────

const FREQ: Record<string, number | null> = {
  OD: 1, QD: 1, ONCE: 1, HS: 1, BD: 2, BID: 2, TWICE: 2, TDS: 3, TID: 3, THRICE: 3, QID: 4, QDS: 4,
  SOS: null, PRN: null, STAT: null, WEEKLY: null,
};

/** "BD" → {code: "BD", timesPerDay: 2}; "1-0-1" → 2; unknown → null. */
export function normalizeFrequency(raw: string | null): { code: string | null; timesPerDay: number | null } {
  if (!raw) return { code: null, timesPerDay: null };
  const s = raw.trim().toUpperCase().replace(/\./g, "");
  const pattern = s.match(/^(\d(?:\/\d)?)\s*-\s*(\d(?:\/\d)?)\s*-\s*(\d(?:\/\d)?)(?:\s*-\s*(\d))?$/); // 1-0-1, 1-1-1-1, ½ handled as 1/2
  if (pattern) {
    const n = pattern.slice(1).filter(Boolean).reduce((sum, x) => sum + (x.includes("/") ? 0.5 : Number(x) > 0 ? 1 : 0), 0);
    return { code: s.replace(/\s/g, ""), timesPerDay: n };
  }
  const word = s.replace(/\b(DAILY|A DAY|PER DAY)\b/g, "").trim();
  if (word in FREQ) return { code: word, timesPerDay: FREQ[word] };
  if (/^(EVERY|Q)\s*(\d+)\s*(H|HR|HRS|HOURLY|HOURS)$/.test(word)) {
    const h = Number(word.match(/\d+/)![0]);
    return { code: `Q${h}H`, timesPerDay: h > 0 && h <= 24 ? Math.round(24 / h) : null };
  }
  if (/^(\d+)\s*(HOURLY)$/.test(word)) {
    const h = Number(word.match(/\d+/)![0]);
    return { code: `Q${h}H`, timesPerDay: Math.round(24 / h) };
  }
  return { code: raw.trim(), timesPerDay: null };
}

/** "5 days" → 5, "1 week" → 7, "2 wks" → 14, "1 month" → 30. */
export function parseDays(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(d|day|days|w|wk|wks|week|weeks|m|mo|month|months)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2][0];
  return Math.round(unit === "w" ? n * 7 : unit === "m" ? n * 30 : n);
}

const COUNTABLE = /^(TAB|TABLET|CAP|CAPSULE)S?$/i;
const doseUnits = (dose: string | null): number | null => {
  if (!dose) return 1; // "Tab X BD" conventionally means one tablet
  const d = dose.toLowerCase();
  if (/\b(half|½|1\/2)\b/.test(d)) return 0.5;
  const m = d.match(/^(\d+(?:\.\d+)?)\s*(tab|tabs|tablet|tablets|cap|caps|capsule|capsules)?$/);
  return m ? Number(m[1]) : null;
};

// ─── Allergies ────────────────────────────────────────────────────────────────

/** Allergy class → drug names/brands that belong to it (common Indian brands included). */
export const ALLERGY_CLASSES: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "amoxycillin", "amoxyclav", "augmentin", "moxikind", "clavam", "ampicillin", "cloxacillin", "piperacillin", "pip-taz", "piptaz", "tazobactam"],
  sulfa: ["sulfa", "sulpha", "cotrimoxazole", "co-trimoxazole", "septran", "bactrim", "sulfamethoxazole"],
  nsaid: ["nsaid", "ibuprofen", "brufen", "combiflam", "diclofenac", "voveran", "aceclofenac", "zerodol", "naproxen", "aspirin", "ecosprin", "ketorolac", "mefenamic", "meftal"],
  cephalosporin: ["cephalosporin", "cefixime", "taxim", "cefuroxime", "ceftriaxone", "cefpodoxime", "cephalexin"],
  macrolide: ["macrolide", "azithromycin", "azithral", "azee", "clarithromycin", "erythromycin"],
  fluoroquinolone: ["quinolone", "ciprofloxacin", "ciplox", "levofloxacin", "ofloxacin", "norfloxacin"],
};

export function allergyConflict(drug: string, allergies: string[]): string | null {
  const d = drug.toLowerCase();
  for (const raw of allergies) {
    const a = raw.toLowerCase().trim();
    if (!a) continue;
    if (d.includes(a)) return raw;
    for (const [cls, members] of Object.entries(ALLERGY_CLASSES)) {
      const allergicToClass = a.includes(cls) || members.some((m) => a.includes(m));
      if (allergicToClass && members.some((m) => d.includes(m))) return raw;
    }
  }
  return null;
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export function validateRx(items: RxItemInput[], ctx: { allergies: string[]; ageYears: number | null }): { items: RxItem[]; warnings: RxWarning[] } {
  const warnings: RxWarning[] = [];
  const seen = new Map<string, number>();

  const out = items.map((it, i): RxItem => {
    const reasons: string[] = [];
    const freq = normalizeFrequency(it.frequency);
    const days = parseDays(it.duration);
    const asNeeded = freq.code ? /^(SOS|PRN|STAT)$/.test(freq.code) : false;

    if (!it.drug.trim()) reasons.push("Drug name missing");
    if (!it.frequency) reasons.push("Frequency not dictated");
    else if (freq.timesPerDay === null && !asNeeded && !/WEEKLY/i.test(freq.code ?? "")) reasons.push(`Unrecognised frequency “${it.frequency}”`);
    if (!it.duration && !asNeeded) reasons.push("Duration not dictated");
    if (it.form && COUNTABLE.test(it.form) && !it.strength) reasons.push("Strength not dictated");

    const key = it.drug.toLowerCase().replace(/[^a-z]/g, "");
    if (key && seen.has(key)) {
      reasons.push(`Duplicate of item ${seen.get(key)! + 1}`);
      warnings.push({ level: "REVIEW", itemIndex: i, message: `${it.drug} appears twice.` });
    } else seen.set(key, i);

    const allergy = allergyConflict(it.drug, ctx.allergies);
    if (allergy) warnings.push({ level: "ALLERGY", itemIndex: i, message: `${it.drug}: patient has a documented ${allergy} allergy.` });

    const units = doseUnits(it.dose);
    const quantity =
      it.form && COUNTABLE.test(it.form) && units !== null && freq.timesPerDay && days ? Math.ceil(units * freq.timesPerDay * days) : null;

    return {
      ...it,
      frequency: freq.code ?? it.frequency,
      timesPerDay: freq.timesPerDay,
      durationDays: days,
      quantity,
      needsReview: reasons.length > 0 || !!allergy,
      reviewReason: [allergy ? `ALLERGY: ${allergy}` : null, ...reasons].filter(Boolean).join(" · ") || null,
    };
  });

  if (ctx.ageYears !== null && ctx.ageYears < 12 && out.length) {
    warnings.push({ level: "REVIEW", itemIndex: null, message: `Paediatric patient (${ctx.ageYears}y): confirm every dose is weight-appropriate.` });
  }
  for (const [i, it] of out.entries()) if (it.needsReview && !warnings.some((w) => w.itemIndex === i)) warnings.push({ level: "REVIEW", itemIndex: i, message: `${it.drug || `Item ${i + 1}`}: ${it.reviewReason}` });
  return { items: out, warnings };
}
