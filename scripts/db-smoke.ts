// Integration checks against a seeded Postgres: `npm run test:db` (run `npm run db:reset` first).
// No API key needed: exercises tokens, tenancy, audit, ABHA sandbox and the WhatsApp outbox.
import assert from "node:assert/strict";
import { createAbha, requestMobileOtp, verifyMobileOtp } from "../lib/abdm/abha-sandbox";
import { runWithCtx } from "../lib/context";
import { base, db } from "../lib/db";
import { createAppointment } from "../lib/opd/booking";
import { istDay } from "../lib/time";
import { sendAppointmentToken } from "../server/services/WhatsApp";

const hospital = { facilityId: "f-hospital", actorId: "u-anjali", actorRole: "RECEPTIONIST", purpose: "Smoke test" };
const clinic = { facilityId: "f-clinic", actorId: "u-pooja", actorRole: "RECEPTIONIST", purpose: "Smoke test" };
let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
};

async function cleanup() {
  await base.$transaction([
    base.messageLog.deleteMany({ where: { patient: { name: { startsWith: "Smoke" } } } }),
    base.appointment.deleteMany({ where: { patient: { name: { startsWith: "Smoke" } } } }),
    base.patient.deleteMany({ where: { name: { startsWith: "Smoke" } } }),
    base.tokenCounter.deleteMany({ where: { date: istDay(2) } }),
    base.abhaSandboxAccount.deleteMany({ where: { name: "Vihaan Gupta" } }),
  ]);
}

async function main() {
  await cleanup(); // in case a previous run was interrupted
  await test("tokens: 8 parallel walk-ins in one department get 8 unique, sequential tokens", async () => {
    const date = istDay(2);
    const made = await runWithCtx(hospital, () =>
      Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          createAppointment({
            patient: { name: `Smoke Patient ${i}`, age: 30, gender: "OTHER", phone: null, whatsappConsent: false },
            departmentId: "d-derm", date, channel: "WALK_IN", status: "WAITING", symptomSummary: "smoke test",
          }),
        ),
      ),
    );
    const labels = made.map((m) => m.tokenLabel).sort();
    assert.equal(new Set(labels).size, 8);
    assert.deepEqual(labels, Array.from({ length: 8 }, (_, i) => `DER-${String(i + 1).padStart(3, "0")}`));
  });

  await test("tenancy: the clinic can't see or update hospital patients", async () => {
    const seen = await runWithCtx(clinic, () => db.patient.findMany({ select: { facilityId: true } }));
    assert.ok(seen.length > 0 && seen.every((p) => p.facilityId === "f-clinic"));
    const arif = await runWithCtx(clinic, () => db.patient.findUnique({ where: { id: "o-arif" } }));
    assert.equal(arif, null);
    const res = await runWithCtx(clinic, () => db.patient.updateMany({ where: { id: "o-arif" }, data: { name: "hacked" } }));
    assert.equal(res.count, 0);
  });

  await test("tenancy: a tenant table queried with no context fails closed", async () => {
    await assert.rejects(() => db.patient.findMany(), /without a request context/);
  });

  await test("audit: reading a patient writes a READ row with purpose and patientId", async () => {
    const before = await base.auditLog.count({ where: { action: "READ", patientIds: { has: "o-sanjay" } } });
    await runWithCtx({ ...hospital, purpose: "Audit smoke read" }, () => db.patient.findUnique({ where: { id: "o-sanjay" } }));
    const rows = await base.auditLog.findMany({ where: { action: "READ", patientIds: { has: "o-sanjay" } }, orderBy: { at: "desc" } });
    assert.equal(rows.length, before + 1);
    assert.equal(rows[0].purpose, "Audit smoke read");
    assert.equal(rows[0].actorId, "u-anjali");
  });

  await test("ABHA sandbox: OTP → verify → existing family accounts → create new", async () => {
    const { txnId, sandboxOtp, sentTo } = requestMobileOtp("98765 00001");
    assert.equal(sentTo, "XXXXXX0001");
    await assert.rejects(() => verifyMobileOtp(txnId, "000000"), /Incorrect OTP/);
    const v = await verifyMobileOtp(txnId, sandboxOtp);
    assert.deepEqual(v.accounts.map((a) => a.name).sort(), ["Anaya Gupta", "Pooja Gupta"]);
    const acc = await createAbha(txnId, { name: "Vihaan Gupta", gender: "MALE", yearOfBirth: 2020 });
    assert.match(acc.abhaNumber, /^99-\d{4}-\d{4}-\d{4}$/);
    assert.match(acc.abhaAddress, /^vihaan\.gupta\d+@sbx$/);
  });

  await test("WhatsApp: token message is built, consent-checked and logged as SIMULATED", async () => {
    const appt = await runWithCtx(hospital, () =>
      createAppointment({
        patient: { name: "Smoke WhatsApp", age: 40, gender: "FEMALE", phone: "9822099999", whatsappConsent: true },
        departmentId: "d-gastro", date: istDay(2), channel: "ONLINE_VOICE", status: "BOOKED", symptomSummary: "smoke",
      }),
    );
    const sent = await runWithCtx(hospital, () => sendAppointmentToken(appt.appointmentId));
    assert.equal(sent?.status, "SIMULATED");
    const log = await base.messageLog.findFirst({ where: { patientId: appt.patientId }, orderBy: { createdAt: "desc" } });
    assert.equal(log?.to, "+919822099999");
    assert.equal((log?.payload as { template: { name: string } }).template.name, "opd_token_v1");
    assert.ok(await base.auditLog.findFirst({ where: { action: "SEND", patientIds: { has: appt.patientId } } }));
  });

  await cleanup(); // keep the demo data tidy
  console.log(`\n${passed} database integration tests passed`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => base.$disconnect());
