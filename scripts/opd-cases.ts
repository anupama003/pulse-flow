// OPD / comms unit tests: `npm run test:rules`. No database or API key needed.
import assert from "node:assert/strict";
import { detectRedFlags } from "../lib/opd/red-flags";
import { allergyConflict, normalizeFrequency, parseDays, validateRx, type RxItemInput } from "../lib/opd/rx-rules";
import { buildAppointmentToken, buildFollowUp, buildRxDocument, toE164India, toMetaPayload, toTwilioPayload } from "../server/services/WhatsApp";
import { MATRIX, can, homeFor } from "../lib/rbac";
import { geminiSchema } from "../lib/llm";
import { HandoverExtractionSchema, RoundsExtractionSchema } from "../lib/sbar/schema";
import { IntakeSchema } from "../lib/opd/intake";
import { RxExtractionSchema } from "../lib/opd/rx";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};
const item = (o: Partial<RxItemInput>): RxItemInput => ({ drug: "X", form: "TAB", strength: "10 mg", dose: "1 tab", frequency: "BD", duration: "5 days", route: "ORAL", instructions: null, ...o });

// ── Booking triage ───────────────────────────────────────────────────────────
test("red flags: 'severe acidity and stomach pain' is NOT an emergency", () => {
  assert.deepEqual(detectRedFlags("I need an appointment for severe acidity and stomach pain tomorrow"), []);
});
test("red flags: chest pain / vomiting blood / child rash that doesn't fade are emergencies", () => {
  assert.ok(detectRedFlags("acidity but also chest pain going to my left arm").includes("Chest pain or pressure"));
  assert.ok(detectRedFlags("he vomited blood twice").includes("Vomiting blood or black stools"));
  assert.ok(detectRedFlags("my son has fever and a purple rash that doesn't fade").length > 0);
});
test("red flags: paediatric itchy rash script is routine", () => {
  assert.deepEqual(detectRedFlags("my 6 year old son Vihaan has an itchy red rash on both arms and behind the knees for 3 days, no fever, he is playing normally"), []);
});
test("red flags: fever in a 2-month-old is an emergency", () => {
  assert.ok(detectRedFlags("my 2 month old baby has fever since morning").includes("Young infant with fever"));
});

// ── e-Rx rules ───────────────────────────────────────────────────────────────
test("frequency: Indian shorthand + 1-0-1 patterns", () => {
  assert.deepEqual(normalizeFrequency("BD"), { code: "BD", timesPerDay: 2 });
  assert.deepEqual(normalizeFrequency("tds"), { code: "TDS", timesPerDay: 3 });
  assert.equal(normalizeFrequency("1-0-1").timesPerDay, 2);
  assert.equal(normalizeFrequency("1-1-1").timesPerDay, 3);
  assert.equal(normalizeFrequency("Q8H").timesPerDay, 3);
  assert.equal(normalizeFrequency("PT").timesPerDay, null); // garbled → never guessed
});
test("duration parsing", () => {
  assert.equal(parseDays("5 days"), 5);
  assert.equal(parseDays("2 weeks"), 14);
  assert.equal(parseDays("1 month"), 30);
});
test("quantity: Tab Augmentin 625 BD x 5 days = 10 tabs", () => {
  const { items } = validateRx([item({ drug: "Augmentin", strength: "625 mg" })], { allergies: [], ageYears: 30 });
  assert.equal(items[0].quantity, 10);
  assert.equal(items[0].needsReview, false);
});
test("review: missing duration / unrecognised frequency are flagged, not guessed", () => {
  const { items, warnings } = validateRx([item({ frequency: "PT" }), item({ drug: "Y", duration: null })], { allergies: [], ageYears: 30 });
  assert.ok(items[0].needsReview && /Unrecognised frequency/.test(items[0].reviewReason!));
  assert.ok(items[1].needsReview && /Duration not dictated/.test(items[1].reviewReason!));
  assert.equal(warnings.filter((w) => w.level === "REVIEW").length, 2);
});
test("allergy: penicillin allergy blocks Augmentin (brand → class)", () => {
  assert.equal(allergyConflict("Augmentin", ["Penicillin"]), "Penicillin");
  assert.equal(allergyConflict("Pan 40", ["Penicillin"]), null);
  const { warnings } = validateRx([item({ drug: "Augmentin" })], { allergies: ["Penicillin"], ageYears: 46 });
  assert.equal(warnings[0].level, "ALLERGY");
});
test("allergy: NSAID allergy catches Combiflam", () => {
  assert.equal(allergyConflict("Combiflam", ["NSAIDs"]), "NSAIDs");
});
test("duplicates and paediatric dosing are surfaced", () => {
  const { warnings } = validateRx([item({ drug: "Calpol", form: "SYP", strength: null }), item({ drug: "calpol", form: "SYP", strength: null })], { allergies: [], ageYears: 6 });
  assert.ok(warnings.some((w) => /appears twice/.test(w.message)));
  assert.ok(warnings.some((w) => /Paediatric patient/.test(w.message)));
});

// ── WhatsApp payloads ────────────────────────────────────────────────────────
test("phone normalisation to E.164", () => {
  assert.equal(toE164India("98220 11001"), "+919822011001");
  assert.equal(toE164India("+91-98220-11001"), "+919822011001");
  assert.equal(toE164India("09822011001"), "+919822011001");
  assert.equal(toE164India("12345"), null);
});
test("Meta Cloud API template payload for an OPD token", () => {
  const m = buildAppointmentToken({ phone: "9822011002", patientName: "Arjun Deshmukh", facilityName: "Lotus Ridge Hospital", token: "GAS-001", department: "Gastroenterology", date: new Date("2026-10-31T00:00:00Z"), consultant: "Dr. Arvind Rao", room: "Room 4" })!;
  const { url, body } = toMetaPayload(m);
  assert.match(url, /graph\.facebook\.com\/v\d+\.\d+\/.+\/messages$/);
  assert.equal(body.messaging_product, "whatsapp");
  assert.equal(body.to, "919822011002");
  assert.equal(body.template.name, "opd_token_v1");
  const params = (body.template.components[0] as { parameters: { text: string }[] }).parameters.map((p) => p.text);
  assert.deepEqual(params.slice(0, 4), ["Arjun", "Lotus Ridge Hospital", "GAS-001", "Gastroenterology"]);
});
test("Rx document payload has a document header; Twilio variant uses ContentVariables", () => {
  const m = buildRxDocument({ phone: "9822011003", patientName: "Mohammed Arif", doctor: "Dr. Arvind Rao", facilityName: "Lotus Ridge Hospital", date: new Date(), followUp: "Review after 2 weeks", pdfUrl: "https://example.test/rx.pdf", rxId: "rx123456" })!;
  const meta = toMetaPayload(m).body.template.components[0] as { type: string; parameters: { document: { link: string } }[] };
  assert.equal(meta.type, "header");
  assert.equal(meta.parameters[0].document.link, "https://example.test/rx.pdf");
  const tw = toTwilioPayload(m);
  assert.equal(tw.form.To, "whatsapp:+919822011003");
  assert.equal(JSON.parse(tw.form.ContentVariables)["6"], "https://example.test/rx.pdf");
});
test("template params are sanitised (no newlines) and follow-up is skipped when empty", () => {
  const m = buildFollowUp({ phone: "9822011003", patientName: "A B", doctor: "Dr X", instructions: ["Line one\nline two"], followUp: null })!;
  assert.ok(!m.bodyParams.some((p) => /\n/.test(p)));
  assert.equal(buildFollowUp({ phone: "9822011003", patientName: "A", doctor: "D", instructions: [], followUp: null }), null);
});

// ── RBAC ─────────────────────────────────────────────────────────────────────
test("RBAC: only consultants sign Rx; receptionist can't read the ward; pharmacist lands on pharmacy", () => {
  assert.ok(can("CONSULTANT", "rx:sign"));
  assert.ok(!can("PG_DAY", "rx:sign"));
  assert.ok(!can("RECEPTIONIST", "ward:read"));
  assert.ok(!can("PHARMACIST", "lab:update"));
  assert.equal(homeFor("PHARMACIST"), "/pharmacy");
  assert.equal(homeFor("RECEPTIONIST"), "/front-desk");
  assert.ok(Object.values(MATRIX).every((perms) => !perms.includes("audit:read") || perms === MATRIX.ADMIN));
});

// ── Gemini structured output ─────────────────────────────────────────────────
test("Gemini: every extraction schema converts to the JSON Schema subset Gemini enforces", () => {
  const SUPPORTED = new Set(["type", "properties", "required", "items", "anyOf", "enum", "description", "title", "additionalProperties", "const", "format", "minimum", "maximum", "minItems", "maxItems", "prefixItems"]);
  for (const [name, schema] of Object.entries({ HandoverExtractionSchema, RoundsExtractionSchema, IntakeSchema, RxExtractionSchema })) {
    const js = geminiSchema(schema);
    assert.equal(js.type, "object", name);
    const bad: string[] = [];
    const walk = (o: unknown, inProps = false) => {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) return o.forEach((x) => walk(x));
      for (const [k, v] of Object.entries(o)) {
        if (!inProps && !SUPPORTED.has(k)) bad.push(k);
        walk(v, k === "properties");
      }
    };
    walk(js);
    assert.deepEqual([...new Set(bad)], [], `${name} uses unsupported keywords`);
  }
});

console.log(`\n${passed} OPD/comms tests passed`);
