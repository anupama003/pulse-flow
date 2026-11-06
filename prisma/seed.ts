// Seeds the Pulse Flow demo: `npm run db:reset` (push schema + seed) or `npm run db:seed`.
//
//   2 facilities  Lotus Ridge Hospital (Pune) · Lotus Ridge Clinic · Baner  (tenant isolation demo)
//   12 staff      Night PG, Day PG, 4 consultants (3 with HPR IDs), receptionist, pharmacist, lab tech, admin, + clinic staff
//   IPD ward      5 inpatients, approved 03:00 handover, 1 draft awaiting approval
//   OPD today     15 tokens across 6 departments: waiting, in consult, completed; 1 booking for tomorrow
//   Fulfilment    5 signed Rx → pharmacy queue in every state, 7 lab orders in every state
//   ABHA          5 sandbox ABHA accounts (one mobile with two family members)
//   WhatsApp      outbox entries built with the real payload builders (DRY_RUN)
//
// Runs with `--conditions=react-server` so it can import the server-only WhatsApp builders.

import type { Prisma } from "@prisma/client";
import { base } from "../lib/db";
import { buildFixtures } from "../lib/fixtures";
import { buildAppointmentToken, buildRxDocument, toMetaPayload } from "../server/services/WhatsApp";

async function main() {
  const f = buildFixtures();
  const prisma = base;

  // Wipe in dependency order (idempotent re-seed).
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.messageLog.deleteMany(),
    prisma.labOrder.deleteMany(),
    prisma.pharmacyOrder.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.tokenCounter.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.actionItem.deleteMany(),
    prisma.sbarNote.deleteMany(),
    prisma.handover.deleteMany(),
    prisma.admission.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.abhaSandboxAccount.deleteMany(),
    prisma.user.deleteMany(),
    prisma.department.deleteMany(),
    prisma.facility.deleteMany(),
  ]);

  await prisma.$transaction([
    prisma.facility.createMany({ data: f.facilities }),
    prisma.department.createMany({ data: f.departments }),
    prisma.user.createMany({ data: f.users }),
    prisma.abhaSandboxAccount.createMany({ data: f.abha }),
    prisma.patient.createMany({ data: f.patients }),
    prisma.admission.createMany({ data: f.admissions }),
    prisma.handover.createMany({ data: f.handovers }),
    prisma.sbarNote.createMany({ data: f.sbarNotes }),
    prisma.actionItem.createMany({ data: f.actionItems }),
    prisma.appointment.createMany({ data: f.appointments }),
    prisma.tokenCounter.createMany({ data: f.counters }),
    prisma.prescription.createMany({ data: f.prescriptions }),
    prisma.prescriptionItem.createMany({ data: f.prescriptionItems }),
    prisma.pharmacyOrder.createMany({ data: f.pharmacyOrders }),
    prisma.labOrder.createMany({ data: f.labOrders }),
  ]);

  // WhatsApp outbox: what the engine would have sent for today's online bookings and signed Rx.
  const facilityName = (id: string) => f.facilities.find((x) => x.id === id)!.name;
  const patient = (id: string) => f.patients.find((p) => p.id === id)!;
  const dept = (id: string) => f.departments.find((d) => d.id === id)!;
  const user = (id: string | null | undefined) => f.users.find((u) => u.id === id);
  const messages: Prisma.MessageLogCreateManyInput[] = [];
  for (const a of f.appointments.filter((x) => x.channel === "ONLINE_VOICE")) {
    const p = patient(a.patientId);
    const d = dept(a.departmentId);
    const m = p.phone && buildAppointmentToken({ phone: p.phone, patientName: p.name, facilityName: facilityName(a.facilityId), token: a.tokenLabel, department: d.name, date: a.date as Date, consultant: user(a.consultantId)?.name ?? null, room: d.room });
    if (m) messages.push({ facilityId: a.facilityId, patientId: p.id!, kind: m.kind, provider: "DRY_RUN", to: m.to, payload: toMetaPayload(m).body as Prisma.InputJsonValue, status: "SIMULATED", createdAt: a.createdAt });
  }
  for (const r of f.prescriptions) {
    const p = patient(r.patientId);
    const m = p.phone && buildRxDocument({ phone: p.phone, patientName: p.name, doctor: user(r.consultantId)!.name, facilityName: facilityName(r.facilityId), date: r.signedAt as Date, followUp: r.followUp ?? null, pdfUrl: `${process.env.PUBLIC_BASE_URL || "http://localhost:3000"}/api/rx/${r.id}/pdf?seed=1`, rxId: r.id! });
    if (m) messages.push({ facilityId: r.facilityId, patientId: p.id!, kind: m.kind, provider: "DRY_RUN", to: m.to, payload: toMetaPayload(m).body as Prisma.InputJsonValue, status: p.whatsappConsent ? "SIMULATED" : "SKIPPED_NO_CONSENT", createdAt: r.signedAt as Date });
  }
  await prisma.messageLog.createMany({ data: messages });

  // A few historical audit events so the compliance screen isn't empty on first load.
  await prisma.auditLog.createMany({
    data: [
      { facilityId: "f-hospital", actorId: "u-rao", actorRole: "CONSULTANT", action: "SIGN", entity: "Prescription", entityId: "rx-sanjay", patientIds: ["o-sanjay"], purpose: "OPD e-prescription signing", at: f.prescriptions[0].signedAt as Date },
      { facilityId: "f-hospital", actorId: "u-farhan", actorRole: "PHARMACIST", action: "UPDATE", entity: "PharmacyOrder", entityId: "ph-rx-sanjay", patientIds: ["o-sanjay"], purpose: "Pharmacy dispensing" },
      { facilityId: "f-hospital", actorId: "u-anjali", actorRole: "RECEPTIONIST", action: "DENIED", entity: "Permission", patientIds: [], purpose: "IPD ward dashboard", meta: { perm: "ward:read" } },
      { facilityId: "f-hospital", actorId: null, actorRole: "PUBLIC", action: "CREATE", entity: "Appointment", entityId: "a-gas-t1", patientIds: ["o-arjun"], purpose: "Online appointment booking" },
    ],
  });

  console.log(
    `Seeded ${f.facilities.length} facilities, ${f.users.length} staff, ${f.patients.length} patients, ${f.appointments.length} OPD tokens, ` +
      `${f.prescriptions.length} signed Rx, ${f.pharmacyOrders.length} pharmacy orders, ${f.labOrders.length} lab orders, ` +
      `${f.abha.length} sandbox ABHA accounts, ${messages.length} WhatsApp outbox messages, 1 IPD draft awaiting approval.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => base.$disconnect());
