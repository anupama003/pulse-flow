// Edge-case tests for the deterministic clinical safety net: `npm run test:rules`
// No API key needed. The "AI output" below is hand-written, including deliberate AI mistakes.
import assert from "node:assert/strict";
import { criticalFindings, readVitals, segmentFor, validateDraft, type DraftInput } from "../lib/sbar/clinical-rules";

const task = (description: string, priority: "STAT" | "HIGH" | "ROUTINE" = "ROUTINE") => ({
  description,
  priority,
  dueText: null,
  condition: null,
  sourceQuote: description,
});
const base = (over: Partial<DraftInput>): DraftInput => ({
  sbar: { situation: "", background: "", assessment: "", recommendation: "" },
  isCritical: false,
  criticalReasons: [],
  actionItems: [],
  corrections: [],
  uncertainties: [],
  ...over,
});

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

// ── Edge case 1: mid-sentence correction ─────────────────────────────────────
test("correction: retracted order that leaked into tasks is removed", () => {
  const text = "Start IV fluids. No, wait, hold fluids. Start Lasix instead.";
  const out = validateDraft(
    base({
      sbar: { situation: "Fluid overloaded.", background: "", assessment: "", recommendation: "Hold IV fluids, start Lasix." },
      // AI mistake: it listed both the retracted and the corrected order
      actionItems: [task("Start IV fluids"), task("Hold IV fluids"), task("Start Lasix")],
      corrections: [{ retracted: "Start IV fluids", replacedWith: "Hold IV fluids; start Lasix", quote: text }],
    }),
    { text },
  );
  assert.deepEqual(out.actionItems.map((a) => a.description), ["Hold IV fluids", "Start Lasix"]);
  assert.ok(out.uncertainties.some((u) => u.includes("Removed “Start IV fluids”")));
});

test("correction: AI missed the correction entirely → doctor is asked to check", () => {
  const text = "Bed 4 give ibuprofen, sorry, paracetamol only.";
  const out = validateDraft(base({ actionItems: [task("Give paracetamol")] }), { text });
  assert.ok(out.uncertainties.some((u) => u.startsWith("Possible self-correction")));
});

test("correction: corrected vital uses the final value", () => {
  assert.equal(readVitals("BP 90 over 60, sorry, 80 over 60").sbp, 80);
});

// ── Edge case 2: missing information ─────────────────────────────────────────
test("missing: empty Background/Recommendation are reported, not invented", () => {
  const out = validateDraft(
    base({ sbar: { situation: "Febrile overnight.", background: "", assessment: "Likely viral.", recommendation: "" } }),
    { text: "Febrile overnight, likely viral." },
  );
  assert.deepEqual(out.missingFields, ["background", "recommendation"]);
  assert.equal(out.sbar.background, "");
});

test("missing: fully empty extraction does not throw and asks for re-dictation", () => {
  const out = validateDraft(base({}), { text: "umm okay so" });
  assert.equal(out.missingFields.length, 4);
  assert.ok(out.uncertainties.some((u) => u.includes("re-dictate")));
});

// ── Edge case 3: contradictory vitals ────────────────────────────────────────
test("contradiction: 'stable' with BP 70/40 is auto-escalated", () => {
  const text = "Bed 9 is stable, BP 70/40, sleeping.";
  const out = validateDraft(
    base({ sbar: { situation: "BP 70/40, sleeping.", background: "", assessment: "Stable.", recommendation: "" }, isCritical: false }),
    { text },
  );
  assert.equal(out.isCritical, true);
  assert.equal(out.autoEscalated, true);
  assert.ok(out.criticalReasons.includes("BP 70/40"));
  assert.ok(out.uncertainties.some((u) => u.startsWith("Dictated as stable")));
});

test("contradiction: spoken '70 over 40' with no 'BP' label is still caught", () => {
  assert.deepEqual(criticalFindings("she's fine, pressure 70 over 40").map((f) => f.label), ["BP 70/40"]);
});

test("contradiction: Indian spoken form 'BP 80 by 50' is caught, even before a later 'recheck BP at 4'", () => {
  const text = "Bed 21 Fatima Khan, she's stable, BP 80 by 50 at 2 AM, heart rate 104, recheck BP at 4 and repeat KFT at 8.";
  assert.deepEqual(criticalFindings(text, 52).map((f) => f.label), ["BP 80/50"]);
  assert.equal(readVitals("blood pressure 110 by 70").sbp, 110);
});

test("no false alarm: abnormal value that has since normalised", () => {
  assert.deepEqual(criticalFindings("K was 6.1 at 2 AM, repeat came back 4.8"), []);
  assert.deepEqual(criticalFindings("BP 84/50 on arrival, after fluids 112/70"), []);
});

test("no false alarm: normal BP is not misread", () => {
  assert.deepEqual(criticalFindings("BP 120/80, HR 88, sats 97 on room air"), []);
});

test("paediatric: HR 150 in a 6-year-old is not flagged by adult rules", () => {
  assert.deepEqual(criticalFindings("HR 150, temp 102.8", 6), []);
  assert.deepEqual(criticalFindings("HR 150, temp 102.8").map((f) => f.label), ["HR 150"]);
});

test("segmentation: finds the right patient's slice of a multi-patient dump", () => {
  const t = "Bed 7 Meera stable for discharge. ICU 2 Vikram BP 78/46 on norad. Bed 21 Fatima awaiting cultures.";
  const seg = segmentFor(t, "ICU-2", "Vikram");
  assert.ok(seg.includes("78/46") && !seg.includes("Fatima") && !seg.includes("Meera"));
});

test("demo script 2 (messy ICU-2): last value of each vital is used", () => {
  const script =
    "So at 4 AM his pressure dropped to 78 over 46, MAP was like 56, so I went up on the norad to point 15, he's now 92 over 58, sorry, I mean 88 over 58. Heart rate 132. Sats 89 on 8 litres. Lactate came back 5.2, up from 4.6.";
  assert.deepEqual(criticalFindings(script).map((f) => f.label), ["BP 88/58", "HR 132", "SpO2 89%", "Lactate 5.2"]);
});

console.log(`\n${passed} clinical rule tests passed`);
