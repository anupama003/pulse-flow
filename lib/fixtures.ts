// Demo data for `npm run db:reset`. All people, phone numbers, ABHA numbers, HPR IDs and facilities
// are fictional. Sandbox identifiers use obviously fake prefixes (ABHA "99-…", HPR "71-0000-…").
//
// Two tenants:
//   Lotus Ridge Hospital (Pune)       IPD ward (previous demo) + 4 OPD departments
//   Lotus Ridge Clinic · Baner        small clinic. Switch to its staff to see tenant isolation.

import type { Prisma } from "@prisma/client";
import type { Proposal } from "./types";
import { PROMPT_VERSION } from "./sbar/system-prompt";
import { istDay } from "./time";

const H = "f-hospital";
const C = "f-clinic";
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000);
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

/** Today at hh:mm local time, or yesterday if that's still in the future. */
function todayAt(h: number, m = 0) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
  return d;
}

export function buildFixtures() {
  const today = istDay();
  const tomorrow = istDay(1);
  const t0300 = todayAt(3, 0);
  const t0540 = todayAt(5, 40);

  // ── Tenants & departments ───────────────────────────────────────────────────
  const facilities: Prisma.FacilityCreateManyInput[] = [
    { id: H, name: "Lotus Ridge Hospital", type: "HOSPITAL", city: "Pune", slug: "lotus-ridge", hfrId: "IN2700000001 (sandbox)", phone: "+912060000000" },
    { id: C, name: "Lotus Ridge Clinic · Baner", type: "CLINIC", city: "Pune", slug: "lotus-ridge-baner", hfrId: "IN2700000002 (sandbox)", phone: "+912060000001" },
  ];
  const departments: Prisma.DepartmentCreateManyInput[] = [
    { id: "d-genmed", facilityId: H, code: "GENMED", name: "General Medicine", room: "Room 1" },
    { id: "d-paeds", facilityId: H, code: "PAEDS", name: "Paediatrics", room: "Room 2" },
    { id: "d-derm", facilityId: H, code: "DERM", name: "Dermatology", room: "Room 3" },
    { id: "d-gastro", facilityId: H, code: "GASTRO", name: "Gastroenterology", room: "Room 4" },
    { id: "dc-genmed", facilityId: C, code: "GENMED", name: "General Medicine", room: "Cabin A" },
    { id: "dc-derm", facilityId: C, code: "DERM", name: "Skin & Hair", room: "Cabin B" },
  ];

  // ── Staff (RBAC personas) ───────────────────────────────────────────────────
  const U = (id: string, facilityId: string, name: string, role: Prisma.UserCreateManyInput["role"], title: string, extra: Partial<Prisma.UserCreateManyInput> = {}): Prisma.UserCreateManyInput => ({
    id, facilityId, name, role, title, email: `${id.slice(2)}@demo.pulseflow`, createdAt: daysAgo(400), ...extra,
  });
  const users: Prisma.UserCreateManyInput[] = [
    U("u-rahul", H, "Dr. Rahul Verma", "PG_NIGHT", "Night PG · General Medicine"),
    U("u-priya", H, "Dr. Priya Raghavan", "PG_DAY", "Day PG · General Medicine"),
    U("u-menon", H, "Dr. Suresh Menon", "CONSULTANT", "Consultant · Medicine & Critical Care", { hprId: "71-0000-0000-0001", departmentId: "d-genmed" }),
    U("u-rao", H, "Dr. Arvind Rao", "CONSULTANT", "Consultant · Gastroenterology", { hprId: "71-0000-0000-0002", departmentId: "d-gastro" }),
    U("u-joshi", H, "Dr. Sneha Joshi", "CONSULTANT", "Consultant · Paediatrics", { hprId: "71-0000-0000-0003", departmentId: "d-paeds" }),
    U("u-thomas", H, "Dr. Leela Thomas", "CONSULTANT", "Consultant · Dermatology (HPR pending)", { departmentId: "d-derm" }),
    U("u-anjali", H, "Anjali Desai", "RECEPTIONIST", "Front desk · OPD"),
    U("u-farhan", H, "Farhan Sheikh", "PHARMACIST", "In-house pharmacy"),
    U("u-kavya", H, "Kavya Rao", "LAB_TECH", "Diagnostics lab"),
    U("u-deepak", H, "Deepak Kulkarni", "ADMIN", "Facility admin & DPDP officer"),
    U("u-imran", C, "Dr. Imran Qureshi", "CONSULTANT", "Consultant · Family Medicine", { hprId: "71-0000-0000-0004", departmentId: "dc-genmed" }),
    U("u-pooja", C, "Pooja Nair", "RECEPTIONIST", "Front desk · Baner clinic"),
  ];

  // ── ABHA sandbox registry (simulated national registry) ──────────────────────
  const abha: Prisma.AbhaSandboxAccountCreateManyInput[] = [
    { abhaNumber: "99-1001-0000-0001", abhaAddress: "sanjay.patil@sbx", mobile: "9822011001", name: "Sanjay Patil", gender: "MALE", yearOfBirth: 1984 },
    { abhaNumber: "99-1001-0000-0002", abhaAddress: "arjun.deshmukh@sbx", mobile: "9822011002", name: "Arjun Deshmukh", gender: "MALE", yearOfBirth: 1990 },
    { abhaNumber: "99-1001-0000-0003", abhaAddress: "mohammed.arif@sbx", mobile: "9822011003", name: "Mohammed Arif", gender: "MALE", yearOfBirth: 1979 },
    // One mobile, two family members: demos the "choose which ABHA" step (test script 4).
    { abhaNumber: "99-1001-0000-0004", abhaAddress: "pooja.gupta@sbx", mobile: "9876500001", name: "Pooja Gupta", gender: "FEMALE", yearOfBirth: 1992 },
    { abhaNumber: "99-1001-0000-0005", abhaAddress: "anaya.gupta@sbx", mobile: "9876500001", name: "Anaya Gupta", gender: "FEMALE", yearOfBirth: 2021 },
  ];

  // ── Patients ────────────────────────────────────────────────────────────────
  const P = (id: string, facilityId: string, name: string, age: number, gender: Prisma.PatientCreateManyInput["gender"], extra: Partial<Prisma.PatientCreateManyInput> = {}): Prisma.PatientCreateManyInput => ({
    id, facilityId, name, age, gender, careConsentAt: daysAgo(1), whatsappConsent: !!extra.phone, createdAt: daysAgo(3), ...extra,
  });
  const patients: Prisma.PatientCreateManyInput[] = [
    // IPD ward (from the handover demo)
    P("p-a", H, "Vikram Singh", 58, "MALE", { bedNumber: "ICU-2", ward: "ICU" }),
    P("p-b", H, "Meera Iyer", 45, "FEMALE", { bedNumber: "7", ward: "Medicine" }),
    P("p-c", H, "Arjun Nair", 67, "MALE", { bedNumber: "12", ward: "Surgery" }),
    P("p-d", H, "Aarav Sharma", 6, "MALE", { bedNumber: "P-4", ward: "Paediatrics" }),
    P("p-e", H, "Fatima Khan", 52, "FEMALE", { bedNumber: "21", ward: "Medicine", allergies: ["Sulfa"] }),
    // OPD: hospital
    P("o-sanjay", H, "Sanjay Patil", 41, "MALE", { phone: "9822011001", abhaNumber: "99-1001-0000-0001", abhaAddress: "sanjay.patil@sbx", abhaLinkedAt: daysAgo(1) }),
    P("o-neha", H, "Neha Kulkarni", 34, "FEMALE", { phone: "9822011010" }),
    P("o-arif", H, "Mohammed Arif", 46, "MALE", { phone: "9822011003", allergies: ["Penicillin"], abhaNumber: "99-1001-0000-0003", abhaAddress: "mohammed.arif@sbx", abhaLinkedAt: minsAgo(70) }),
    P("o-kavita", H, "Kavita Shinde", 52, "FEMALE", { phone: "9822011011" }),
    P("o-rohan", H, "Rohan Mehta", 29, "MALE", { phone: "9822011012" }),
    P("o-lakshmi", H, "Lakshmi Narayan", 63, "FEMALE", { phone: "9822011013", allergies: ["NSAIDs"] }),
    P("o-ramesh", H, "Ramesh Kumar", 45, "MALE", { phone: "9822011014" }),
    P("o-sunil", H, "Sunil Jadhav", 38, "MALE", { phone: null, whatsappConsent: false }),
    P("o-fatima", H, "Fatima Shaikh", 27, "FEMALE", { phone: "9822011015" }),
    P("o-ishaan", H, "Ishaan Verma", 7, "MALE", { phone: "9822011016" }),
    P("o-anaya", H, "Anaya Gupta", 4, "FEMALE", { phone: "9876500001", abhaNumber: "99-1001-0000-0005", abhaAddress: "anaya.gupta@sbx", abhaLinkedAt: daysAgo(1) }),
    P("o-priyanka", H, "Priyanka Rao", 31, "FEMALE", { phone: "9822011017" }),
    P("o-arjun", H, "Arjun Deshmukh", 35, "MALE", { phone: "9822011002", abhaNumber: "99-1001-0000-0002", abhaAddress: "arjun.deshmukh@sbx", abhaLinkedAt: minsAgo(300) }),
    // OPD: clinic (separate tenant)
    P("c-vijay", C, "Vijay More", 50, "MALE", { phone: "9822011020" }),
    P("c-shalini", C, "Shalini Pawar", 36, "FEMALE", { phone: "9822011021" }),
  ];

  // ── IPD ward ────────────────────────────────────────────────────────────────
  const dx: Record<string, string> = {
    "p-a": "Septic shock · right lower lobe pneumonia",
    "p-b": "Diabetic ketoacidosis (resolved)",
    "p-c": "POD 1 · laparotomy for perforated DU",
    "p-d": "Acute febrile illness · NS1+ dengue",
    "p-e": "Acute pyelonephritis with AKI",
  };
  const admissions: Prisma.AdmissionCreateManyInput[] = Object.entries(dx).map(([patientId, diagnosis], i) => ({
    id: `adm-${patientId}`, facilityId: H, patientId, diagnosis, admittedAt: daysAgo([2, 4, 1, 3, 1][i]), admittingConsultantId: "u-menon",
  }));

  const meta = { model: "claude-opus-5-5", promptVersion: PROMPT_VERSION, unassignedNotes: [] };
  const handovers: Prisma.HandoverCreateManyInput[] = [
    {
      id: "h-0300", facilityId: H, authorId: "u-rahul", source: "HANDOVER", shift: "NIGHT", parserMeta: meta, createdAt: t0300,
      rawDictation:
        "Okay handover from night. ICU 2, Vikram Singh, 58, septic shock from right lower lobe pneumonia, he's not doing well. BP 84 over 50 on noradrenaline point 1, heart rate 128, sats 90 on 6 litres, lactate 4.6. On meropenem. I think he's worsening. Repeat ABG and lactate at 6, and if MAP stays under 65 call the ICU registrar. Hourly urine output please. " +
        "Bed 7, Meera Iyer, DKA resolved, off the insulin drip since yesterday, sugars 140 to 180 on basal bolus, eating well. She's stable, ready for discharge after Menon sir sees her. " +
        "Bed 12, Arjun Nair, 67, post-op day 1 laparotomy, Graham's patch for perforated DU, known COPD. BP 118 over 72, heart rate 104, drain 180 ml overnight, urine output 30 an hour. Stable but needs close monitoring. " +
        "P 4, little Aarav Sharma, 6 years, day 3 fever, NS1 positive. Temp 102.8 at 2 AM, well hydrated, playing. Repeat CBC with platelets at 8, paracetamol only. " +
        "Bed 21, Fatima Khan, 52, pyelonephritis with AKI, creatinine 2.1 on admission, on IV ceftriaxone. Afebrile since midnight. Follow up the urine culture and repeat KFT at 8.",
    },
    {
      id: "h-0540", facilityId: H, authorId: "u-rahul", source: "HANDOVER", shift: "NIGHT", parserMeta: meta, createdAt: t0540,
      rawDictation:
        "Quick update on P 4, Aarav. Spiked again to 103.1 at 5:30. I gave ibuprofen, sorry, no, I mean I did tepid sponging and gave paracetamol, no ibuprofen obviously. Platelets from last night came back 98,000, down from 1.4 lakh. He's still drinking okay, no vomiting, no abdominal pain. Recheck temperature in an hour and watch for warning signs.",
    },
  ];
  const sbar = (situation: string, background: string, assessment: string, recommendation: string) => ({ situation, background, assessment, recommendation });
  const N = (id: string, patientId: string, s: ReturnType<typeof sbar>, extra: Partial<Prisma.SbarNoteCreateManyInput> = {}): Prisma.SbarNoteCreateManyInput => ({
    id, facilityId: H, handoverId: "h-0300", patientId, sbar: s, status: "APPROVED", approvedById: "u-rahul", approvedAt: t0300, createdAt: t0300, ...extra,
  });
  const sbarNotes: Prisma.SbarNoteCreateManyInput[] = [
    N("n-a", "p-a", sbar("BP 84/50 on noradrenaline 0.1, HR 128, SpO2 90% on 6 L O2, lactate 4.6.", "Septic shock from right lower lobe pneumonia, admitted 2 days ago. On meropenem.", "Worsening.", "Repeat ABG and lactate at 6. Call ICU registrar if MAP stays under 65. Hourly urine output."), { isCritical: true, criticalReasons: ["BP 84/50", "HR 128", "SpO2 90%", "Lactate 4.6"] }),
    N("n-b", "p-b", sbar("Off insulin infusion since yesterday. Sugars 140–180 on basal-bolus, eating well.", "Admitted with DKA 4 days ago, now resolved.", "Stable, ready for discharge.", "Discharge after consultant review.")),
    N("n-c", "p-c", sbar("POD 1. BP 118/72, HR 104, drain 180 ml overnight, urine output 30 ml/hr.", "Emergency laparotomy with Graham's patch for perforated DU. Known COPD.", "Stable but needs close monitoring.", "Hourly urine output, 4-hourly drain output. NBM until surgical review.")),
    N("n-d", "p-d", sbar("Temp 102.8 °F at 2 AM, well hydrated, playing.", "Day 3 of fever, NS1 positive.", "Probable dengue without warning signs.", "Repeat CBC with platelets at 8. Paracetamol only."), { uncertainties: ["Paediatric patient: adult HR/RR cut-offs were not applied. Review against age-specific norms."] }),
    N("n-e", "p-e", sbar("Afebrile since midnight.", "Pyelonephritis with AKI, creatinine 2.1 on admission. On IV ceftriaxone.", "Improving.", "Follow up urine culture. Repeat KFT at 8.")),
    N("n-d-draft", "p-d", sbar("Spiked to 103.1 °F at 5:30. Tepid sponging done and paracetamol given. Drinking well, no vomiting, no abdominal pain.", "Day 3 dengue, NS1 positive. Platelets 98,000, down from 1.4 lakh.", "", ""), {
      handoverId: "h-0540", status: "DRAFT", approvedById: null, approvedAt: null, createdAt: t0540, missingFields: ["assessment", "recommendation"],
      corrections: [{ retracted: "Gave ibuprofen", replacedWith: "Tepid sponging and paracetamol; no ibuprofen", quote: "I gave ibuprofen, sorry, no, I mean I did tepid sponging and gave paracetamol" }],
      uncertainties: ["Paediatric patient: adult HR/RR cut-offs were not applied. Review against age-specific norms.", "Platelets dropped from 1.4 lakh to 98,000. Confirm the trend before approving."],
      proposal: {
        segment: "Quick update on P 4, Aarav. Spiked again to 103.1 at 5:30…",
        actionItems: [
          { description: "Recheck temperature", priority: "ROUTINE", dueText: "in 1 hour" },
          { description: "Watch for dengue warning signs (vomiting, abdominal pain, bleeding)", priority: "HIGH", dueText: null },
        ],
      } satisfies Proposal,
    }),
  ];
  let t = 0;
  const A = (patientId: string, description: string, priority: Prisma.ActionItemCreateManyInput["priority"], dueText: string | null): Prisma.ActionItemCreateManyInput => ({
    id: `t-${++t}`, facilityId: H, handoverId: "h-0300", patientId, description, priority, dueText, source: "HANDOVER", shift: "NIGHT", createdAt: t0300,
  });
  const actionItems: Prisma.ActionItemCreateManyInput[] = [
    A("p-a", "Repeat ABG and lactate", "STAT", "6 AM"),
    A("p-a", "If MAP stays under 65: call ICU registrar", "HIGH", null),
    A("p-a", "Hourly urine output charting", "HIGH", "hourly"),
    A("p-b", "Prepare discharge summary", "ROUTINE", "after consultant review"),
    A("p-c", "Hourly urine output monitoring", "HIGH", "hourly"),
    A("p-c", "Drain output charting", "HIGH", "every 4 hours"),
    A("p-c", "Continue IV ceftriaxone and metronidazole", "ROUTINE", null),
    A("p-c", "Keep NBM until surgical review", "ROUTINE", null),
    A("p-d", "Repeat CBC with platelet count", "HIGH", "8 AM"),
    A("p-e", "Repeat KFT", "HIGH", "8 AM"),
    A("p-e", "Follow up urine culture and sensitivity", "ROUTINE", "today"),
  ];

  // ── OPD appointments (today + tomorrow) ──────────────────────────────────────
  type Appt = Prisma.AppointmentCreateManyInput;
  const prefix: Record<string, string> = { "d-genmed": "GEN", "d-gastro": "GAS", "d-paeds": "PED", "d-derm": "DER", "dc-genmed": "GEN", "dc-derm": "DER" };
  const doctor: Record<string, string> = { "d-genmed": "u-menon", "d-gastro": "u-rao", "d-paeds": "u-joshi", "d-derm": "u-thomas", "dc-genmed": "u-imran" };
  const AP = (id: string, facilityId: string, departmentId: string, n: number, patientId: string, status: Appt["status"], channel: Appt["channel"], summary: string, extra: Partial<Appt> = {}): Appt => ({
    id, facilityId, departmentId, patientId, consultantId: doctor[departmentId] ?? null, date: today, tokenNumber: n, tokenLabel: `${prefix[departmentId]}-${String(n).padStart(3, "0")}`,
    status, channel, symptomSummary: summary, symptomsRaw: channel === "ONLINE_VOICE" ? summary : null, urgency: "ROUTINE",
    checkedInAt: status === "BOOKED" ? null : minsAgo(200 - n * 15), calledAt: status === "IN_CONSULT" || status === "COMPLETED" ? minsAgo(150 - n * 15) : null,
    completedAt: status === "COMPLETED" ? minsAgo(140 - n * 15) : null, createdAt: minsAgo(240 - n * 10), ...extra,
  });
  const appointments: Appt[] = [
    AP("a-gas1", H, "d-gastro", 1, "o-sanjay", "COMPLETED", "ONLINE_VOICE", "burning in the chest after meals for 2 weeks"),
    AP("a-gas2", H, "d-gastro", 2, "o-neha", "COMPLETED", "WALK_IN", "loose motions and cramps since yesterday"),
    AP("a-gas3", H, "d-gastro", 3, "o-arif", "IN_CONSULT", "ONLINE_VOICE", "severe acidity and stomach pain", { symptomsRaw: "I need an appointment for severe acidity and stomach pain tomorrow", urgency: "SOON", createdAt: daysAgo(1) }),
    AP("a-gas4", H, "d-gastro", 4, "o-kavita", "WAITING", "WALK_IN", "bloating and gas after food"),
    AP("a-gas5", H, "d-gastro", 5, "o-rohan", "WAITING", "ONLINE_VOICE", "vomiting since morning, can't keep food down", { urgency: "SOON" }),
    AP("a-gen1", H, "d-genmed", 1, "o-lakshmi", "COMPLETED", "WALK_IN", "tiredness, frequent urination"),
    AP("a-gen2", H, "d-genmed", 2, "o-ramesh", "IN_CONSULT", "WALK_IN", "fever and body ache since 3 days"),
    AP("a-gen3", H, "d-genmed", 3, "o-sunil", "WAITING", "WALK_IN", "high fever for 4 days with chills", { urgency: "SOON" }),
    AP("a-gen4", H, "d-genmed", 4, "o-fatima", "WAITING", "ONLINE_VOICE", "cough and cold for a week"),
    AP("a-ped1", H, "d-paeds", 1, "o-ishaan", "COMPLETED", "WALK_IN", "cough and runny nose for 4 days"),
    AP("a-ped2", H, "d-paeds", 2, "o-anaya", "WAITING", "ONLINE_VOICE", "itchy red rash on both arms for 3 days"),
    AP("a-der1", H, "d-derm", 1, "o-priyanka", "WAITING", "WALK_IN", "hair fall for 2 months"),
    // Tomorrow: the exact booking example from the brief
    AP("a-gas-t1", H, "d-gastro", 1, "o-arjun", "BOOKED", "ONLINE_VOICE", "severe acidity and stomach pain", {
      date: tomorrow, symptomsRaw: "I need an appointment for severe acidity and stomach pain tomorrow", urgency: "SOON", preferredSlot: "MORNING", createdAt: minsAgo(300),
    }),
    // Clinic tenant
    AP("a-c1", C, "dc-genmed", 1, "c-vijay", "WAITING", "WALK_IN", "BP check and headache"),
    AP("a-c2", C, "dc-derm", 1, "c-shalini", "COMPLETED", "WALK_IN", "acne flare-up"),
  ];
  const counters = new Map<string, Prisma.TokenCounterCreateManyInput>();
  for (const a of appointments) {
    const key = `${a.departmentId}|${(a.date as Date).toISOString()}`;
    const cur = counters.get(key);
    if (!cur || cur.last! < a.tokenNumber) counters.set(key, { facilityId: a.facilityId, departmentId: a.departmentId, date: a.date, last: a.tokenNumber });
  }

  // ── Signed prescriptions → pharmacy + lab queues ────────────────────────────
  type Item = Omit<Prisma.PrescriptionItemCreateManyInput, "prescriptionId" | "position">;
  const I = (drug: string, form: string, strength: string | null, dose: string, frequency: string, timesPerDay: number | null, duration: string | null, durationDays: number | null, instructions: string | null, route = "ORAL"): Item => ({
    drug, form, strength, dose, frequency, timesPerDay, duration, durationDays, instructions, route,
    quantity: /TAB|CAP/.test(form) && timesPerDay && durationDays ? Math.ceil(timesPerDay * durationDays) : null,
  });
  const rxDefs: { id: string; facilityId: string; appt: string; patientId: string; consultantId: string; hpr: string; raw: string; items: Item[]; labs: { test: string; urgency: "ROUTINE" | "URGENT"; status: Prisma.LabOrderCreateManyInput["status"] }[]; advice: string[]; followUp: string; pharmacy: Prisma.PharmacyOrderCreateManyInput["status"]; mins: number }[] = [
    {
      id: "rx-sanjay", facilityId: H, appt: "a-gas1", patientId: "o-sanjay", consultantId: "u-rao", hpr: "71-0000-0000-0002", mins: 160,
      raw: "Tab Pan 40 OD before breakfast for 4 weeks. Syrup Gelusil 2 teaspoons TID after food for 2 weeks. USG abdomen. Avoid spicy, oily food and late dinners. Review after 4 weeks.",
      items: [I("Pan", "TAB", "40 mg", "1 tab", "OD", 1, "4 weeks", 28, "before breakfast"), I("Gelusil", "SYP", null, "2 tsp", "TID", 3, "2 weeks", 14, "after food")],
      labs: [{ test: "USG abdomen", urgency: "ROUTINE", status: "REPORTED" }], advice: ["Avoid spicy, oily food", "No late dinners"], followUp: "Review after 4 weeks", pharmacy: "DISPENSED",
    },
    {
      id: "rx-neha", facilityId: H, appt: "a-gas2", patientId: "o-neha", consultantId: "u-rao", hpr: "71-0000-0000-0002", mins: 120,
      raw: "ORS sachets after every loose stool. Tab Racecadotril 100 mg TID for 3 days. Cap Econorm 1 BD for 5 days. Stool routine. Plenty of fluids. Review if blood in stool.",
      items: [I("ORS", "SACHET", null, "1 sachet in 1 L water", "SOS", null, null, null, "after every loose stool"), I("Racecadotril", "TAB", "100 mg", "1 tab", "TID", 3, "3 days", 3, null), I("Econorm", "CAP", null, "1 cap", "BD", 2, "5 days", 5, null)],
      labs: [{ test: "Stool routine and microscopy", urgency: "ROUTINE", status: "SAMPLE_COLLECTED" }, { test: "H. pylori stool antigen", urgency: "ROUTINE", status: "ORDERED" }],
      advice: ["Plenty of oral fluids", "Come back immediately if there is blood in the stool"], followUp: "Review in 3 days if not better", pharmacy: "PREPARING",
    },
    {
      id: "rx-lakshmi", facilityId: H, appt: "a-gen1", patientId: "o-lakshmi", consultantId: "u-menon", hpr: "71-0000-0000-0001", mins: 60,
      raw: "Tab Metformin 500 mg BD after food for 1 month. Tab Paracetamol 650 SOS for body ache. CBC, fasting blood sugar, HbA1c, urgent urine routine. Walk 30 minutes daily. Review with reports in 1 week.",
      items: [I("Metformin", "TAB", "500 mg", "1 tab", "BD", 2, "1 month", 30, "after food"), I("Paracetamol", "TAB", "650 mg", "1 tab", "SOS", null, null, null, "for body ache, max 3 a day")],
      labs: [{ test: "CBC", urgency: "ROUTINE", status: "ORDERED" }, { test: "Fasting blood sugar", urgency: "ROUTINE", status: "ORDERED" }, { test: "HbA1c", urgency: "ROUTINE", status: "PROCESSING" }, { test: "Urine routine", urgency: "URGENT", status: "ORDERED" }],
      advice: ["Walk 30 minutes daily", "Cut down on sweets and rice"], followUp: "Review with reports in 1 week", pharmacy: "QUEUED",
    },
    {
      id: "rx-ishaan", facilityId: H, appt: "a-ped1", patientId: "o-ishaan", consultantId: "u-joshi", hpr: "71-0000-0000-0003", mins: 90,
      raw: "Syrup Ascoril LS 5 ml TID for 5 days. Syrup Calpol 250 5 ml SOS for fever above 100. Saline nasal drops 2 drops each nostril QID. Steam inhalation twice a day. Review after 5 days.",
      items: [I("Ascoril LS", "SYP", null, "5 ml", "TID", 3, "5 days", 5, null), I("Calpol", "SYP", "250 mg/5 ml", "5 ml", "SOS", null, null, null, "for fever above 100 °F"), I("Saline nasal drops", "DROPS", null, "2 drops each nostril", "QID", 4, "5 days", 5, null, "NASAL")],
      labs: [], advice: ["Steam inhalation twice a day", "Warm fluids"], followUp: "Review after 5 days", pharmacy: "READY",
    },
    {
      id: "rx-shalini", facilityId: C, appt: "a-c2", patientId: "c-shalini", consultantId: "u-imran", hpr: "71-0000-0000-0004", mins: 45,
      raw: "Adapalene gel 0.1% apply thin layer at night HS for 6 weeks. Face wash twice daily. Review after 6 weeks.",
      items: [I("Adapalene gel", "GEL", "0.1%", "thin layer", "HS", 1, "6 weeks", 42, "apply on face at night", "TOPICAL")],
      labs: [], advice: ["Gentle face wash twice daily", "Avoid squeezing pimples"], followUp: "Review after 6 weeks", pharmacy: "QUEUED",
    },
  ];
  const prescriptions: Prisma.PrescriptionCreateManyInput[] = [];
  const prescriptionItems: Prisma.PrescriptionItemCreateManyInput[] = [];
  const pharmacyOrders: Prisma.PharmacyOrderCreateManyInput[] = [];
  const labOrders: Prisma.LabOrderCreateManyInput[] = [];
  for (const r of rxDefs) {
    const signedAt = minsAgo(r.mins);
    prescriptions.push({
      id: r.id, facilityId: r.facilityId, patientId: r.patientId, appointmentId: r.appt, consultantId: r.consultantId, status: "SIGNED", rawDictation: r.raw,
      advice: r.advice, followUp: r.followUp, hprId: r.hpr, signedAt, signatureHash: `seed-${r.id}`, createdAt: signedAt,
      draftLabTests: r.labs.map(({ test, urgency }) => ({ test, urgency, notes: null })),
    });
    r.items.forEach((it, position) => prescriptionItems.push({ ...it, prescriptionId: r.id, position }));
    pharmacyOrders.push({ id: `ph-${r.id}`, facilityId: r.facilityId, patientId: r.patientId, prescriptionId: r.id, status: r.pharmacy, updatedById: r.pharmacy === "QUEUED" ? null : "u-farhan", createdAt: signedAt });
    r.labs.forEach((l, k) =>
      labOrders.push({ id: `lab-${r.id}-${k}`, facilityId: r.facilityId, patientId: r.patientId, prescriptionId: r.id, appointmentId: r.appt, test: l.test, urgency: l.urgency, status: l.status, orderedById: r.consultantId, updatedById: l.status === "ORDERED" ? null : "u-kavya", createdAt: signedAt }),
    );
  }

  return { facilities, departments, users, abha, patients, admissions, handovers, sbarNotes, actionItems, appointments, counters: [...counters.values()], prescriptions, prescriptionItems, pharmacyOrders, labOrders };
}
