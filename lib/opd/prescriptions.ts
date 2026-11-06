import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { audit, db } from "../db";
import { UserError } from "../result";
import type { SessionUser } from "../staff";
import type { Correction } from "../sbar/schema";
import { istDay } from "../time";
import type { RxExtraction } from "./rx";
import { validateRx, type RxItem, type RxItemInput, type RxWarning } from "./rx-rules";
import { buildRxSigned, postToRoom } from "@/server/services/Switch";

// OPD consult lifecycle: call next → dictate Rx (DRAFT) → review/edit → sign with HPR ID →
// route to pharmacy + diagnostics queues → appointment COMPLETED.

const json = (v: unknown) => v as Prisma.InputJsonValue;
const rank = { EMERGENCY: 0, SOON: 1, ROUTINE: 2 } as const;

export interface LabTestInput {
  test: string;
  urgency: "ROUTINE" | "URGENT";
  notes: string | null;
}

export interface RxDraftView {
  id: string;
  status: "DRAFT" | "SIGNED" | "CANCELLED";
  rawDictation: string;
  items: RxItem[];
  labTests: LabTestInput[];
  advice: string[];
  followUp: string | null;
  corrections: Correction[];
  uncertainties: string[];
  warnings: RxWarning[];
  hprId: string | null;
  signedAt: string | null;
  signatureHash: string | null;
}

const toView = (rx: Prisma.PrescriptionGetPayload<{ include: { items: true } }>): RxDraftView => ({
  id: rx.id, status: rx.status, rawDictation: rx.rawDictation,
  items: rx.items.sort((a, b) => a.position - b.position).map((i) => ({
    drug: i.drug, form: i.form, strength: i.strength, dose: i.dose, frequency: i.frequency, duration: i.duration, route: i.route,
    instructions: i.instructions, timesPerDay: i.timesPerDay, durationDays: i.durationDays, quantity: i.quantity, needsReview: i.needsReview, reviewReason: i.reviewReason,
  })),
  labTests: (rx.draftLabTests ?? []) as unknown as LabTestInput[],
  advice: rx.advice, followUp: rx.followUp, corrections: (rx.corrections ?? []) as Correction[], uncertainties: rx.uncertainties,
  warnings: (rx.warnings ?? []) as unknown as RxWarning[], hprId: rx.hprId, signedAt: rx.signedAt?.toISOString() ?? null, signatureHash: rx.signatureHash,
});

/** The consultant's OPD screen: my department's queue + the patient currently in my room. */
export async function opdConsole(user: SessionUser) {
  const date = istDay();
  const where = { date, ...(user.departmentId ? { departmentId: user.departmentId } : {}) };
  const appts = await db.appointment.findMany({
    where: { ...where, status: { in: ["WAITING", "IN_CONSULT", "COMPLETED"] } },
    include: {
      patient: true,
      department: true,
      prescription: { include: { items: true } },
    },
    orderBy: { tokenNumber: "asc" },
  });
  const current = appts.find((a) => a.status === "IN_CONSULT" && (!a.consultantId || a.consultantId === user.id || !user.departmentId)) ?? null;
  const waiting = appts.filter((a) => a.status === "WAITING").sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.tokenNumber - b.tokenNumber);
  const history = current
    ? await db.prescription.findMany({ where: { patientId: current.patientId, status: "SIGNED" }, orderBy: { signedAt: "desc" }, take: 3, include: { items: true } })
    : [];

  return {
    department: appts[0]?.department.name ?? null,
    waiting: waiting.map((a) => ({ id: a.id, token: a.tokenLabel, name: a.patient.name, age: a.patient.age, gender: a.patient.gender, urgency: a.urgency, summary: a.symptomSummary, channel: a.channel })),
    completedCount: appts.filter((a) => a.status === "COMPLETED").length,
    current: current && {
      appointmentId: current.id, token: current.tokenLabel, urgency: current.urgency, summary: current.symptomSummary, symptomsRaw: current.symptomsRaw,
      redFlags: current.redFlags, channel: current.channel, calledAt: current.calledAt?.toISOString() ?? null,
      patient: {
        id: current.patient.id, name: current.patient.name, age: current.patient.age, gender: current.patient.gender, phone: current.patient.phone,
        allergies: current.patient.allergies, abhaNumber: current.patient.abhaNumber, abhaAddress: current.patient.abhaAddress, whatsappConsent: current.patient.whatsappConsent,
      },
      rx: current.prescription ? toView(current.prescription) : null,
      history: history.map((h) => ({ id: h.id, signedAt: h.signedAt?.toISOString() ?? null, drugs: h.items.map((i) => i.drug) })),
    },
  };
}
export type OpdConsoleData = Awaited<ReturnType<typeof opdConsole>>;

export async function callNext(user: SessionUser) {
  const date = istDay();
  const scope = { date, ...(user.departmentId ? { departmentId: user.departmentId } : {}) };
  const busy = await db.appointment.findFirst({ where: { ...scope, status: "IN_CONSULT", consultantId: user.id } });
  if (busy) throw new UserError(`Finish ${busy.tokenLabel} first.`);
  const waiting = await db.appointment.findMany({ where: { ...scope, status: "WAITING" } });
  const next = waiting.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.tokenNumber - b.tokenNumber)[0];
  if (!next) throw new UserError("No one is waiting.");
  const res = await db.appointment.updateMany({ where: { id: next.id, status: "WAITING" }, data: { status: "IN_CONSULT", calledAt: new Date(), consultantId: user.id } });
  if (res.count === 0) throw new UserError("That token was just called by someone else. Try again.");
  return next.tokenLabel;
}

/** Save (or replace) the AI-parsed draft for the current consult. */
export async function saveRxDraft(user: SessionUser, appointmentId: string, raw: string, ex: RxExtraction) {
  const appt = await db.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true, prescription: true } });
  if (!appt || appt.status !== "IN_CONSULT") throw new UserError("Call the patient in before dictating.");
  if (appt.prescription?.status === "SIGNED") throw new UserError("This prescription is already signed.");
  const { items, warnings } = validateRx(ex.items, { allergies: appt.patient.allergies, ageYears: appt.patient.age });

  const data = {
    patientId: appt.patientId, appointmentId, consultantId: user.id, status: "DRAFT" as const, rawDictation: raw,
    advice: ex.advice, followUp: ex.followUp, corrections: json(ex.corrections), uncertainties: ex.uncertainties,
    warnings: json(warnings), draftLabTests: json(ex.labTests),
  };
  await db.$transaction(async (tx) => {
    const rx = appt.prescription
      ? await tx.prescription.update({ where: { id: appt.prescription.id }, data })
      : await tx.prescription.create({ data: data as Prisma.PrescriptionUncheckedCreateInput });
    await tx.prescriptionItem.deleteMany({ where: { prescriptionId: rx.id } });
    if (items.length) await tx.prescriptionItem.createMany({ data: items.map((it, position) => ({ ...it, prescriptionId: rx.id, position })) });
  });
}

export interface SignInput {
  items: RxItemInput[];
  labTests: LabTestInput[];
  advice: string[];
  followUp: string | null;
  allergyOverride: boolean;
}

/**
 * Consultant e-signature. Server re-validates the (possibly edited) items, refuses unresolved
 * allergy conflicts unless explicitly overridden, stamps HPR ID + SHA-256 content hash, then routes.
 */
export async function signRx(user: SessionUser, rxId: string, input: SignInput) {
  if (user.role !== "CONSULTANT") throw new UserError("Only consultants can sign prescriptions.");
  if (!user.hprId) throw new UserError("Add your HPR ID to your profile before signing prescriptions.");

  const rx = await db.prescription.findUnique({ where: { id: rxId }, include: { patient: true, appointment: true } });
  if (!rx) throw new UserError("Prescription not found.");
  if (rx.status !== "DRAFT") throw new UserError("This prescription is already signed.");
  const cleaned = input.items.filter((i) => i.drug.trim());
  if (!cleaned.length && !input.labTests.length) throw new UserError("Nothing to sign: add a medicine or a test.");

  const { items, warnings } = validateRx(cleaned, { allergies: rx.patient.allergies, ageYears: rx.patient.age });
  if (warnings.some((w) => w.level === "ALLERGY") && !input.allergyOverride) {
    throw new UserError("Resolve the allergy warning, or confirm the override, before signing.");
  }
  const signedAt = new Date();
  const signatureHash = createHash("sha256")
    .update(JSON.stringify({ rxId, patientId: rx.patientId, items, labTests: input.labTests, advice: input.advice, followUp: input.followUp, hprId: user.hprId, signedAt }))
    .digest("hex");

  await db.$transaction(async (tx) => {
    const res = await tx.prescription.updateMany({
      where: { id: rxId, status: "DRAFT" },
      data: {
        status: "SIGNED", signedAt, signatureHash, hprId: user.hprId, consultantId: user.id, advice: input.advice, followUp: input.followUp,
        warnings: json(warnings), draftLabTests: json(input.labTests),
      },
    });
    if (res.count === 0) throw new UserError("This prescription is already signed.");
    await tx.prescriptionItem.deleteMany({ where: { prescriptionId: rxId } });
    if (items.length) {
      await tx.prescriptionItem.createMany({ data: items.map((it, position) => ({ ...it, prescriptionId: rxId, position })) });
      await tx.pharmacyOrder.create({ data: { patientId: rx.patientId, prescriptionId: rxId } as Prisma.PharmacyOrderUncheckedCreateInput });
    }
    if (input.labTests.length) {
      await tx.labOrder.createMany({
        data: input.labTests.map((t) => ({
          patientId: rx.patientId, prescriptionId: rxId, appointmentId: rx.appointmentId, test: t.test, urgency: t.urgency, notes: t.notes, orderedById: user.id,
        })) as Prisma.LabOrderCreateManyInput[],
      });
    }
    if (rx.appointmentId) await tx.appointment.updateMany({ where: { id: rx.appointmentId, status: "IN_CONSULT" }, data: { status: "COMPLETED", completedAt: signedAt } });
  });
  await audit("SIGN", "Prescription", { entityId: rxId, patientIds: [rx.patientId], meta: { hprId: user.hprId, signatureHash, items: items.length, labTests: input.labTests.length } });
  await postToRoom(
    buildRxSigned({
      token: rx.appointment?.tokenLabel ?? null, patientName: rx.patient.name, consultant: user.name, medicines: items.length,
      labTests: input.labTests.map((t) => t.test), allergies: rx.patient.allergies, patientId: rx.patientId,
    }),
  );
  return { rxId, patientId: rx.patientId, pharmacy: items.length > 0, labs: input.labTests.length };
}

/** Full prescription for the PDF and the pharmacy screen. */
export async function getPrescription(rxId: string) {
  return db.prescription.findUnique({
    where: { id: rxId },
    include: { items: { orderBy: { position: "asc" } }, patient: true, consultant: { include: { department: true } }, appointment: true, facility: true, labOrders: true },
  });
}
