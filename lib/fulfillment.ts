import "server-only";
import type { LabStatus, PharmacyStatus } from "@prisma/client";
import { db } from "./db";
import { UserError } from "./result";
import { istDay } from "./time";

// Pharmacy and diagnostics work queues, fed automatically when a consultant signs an Rx.

const PHARMACY_FLOW: Record<PharmacyStatus, PharmacyStatus[]> = {
  QUEUED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "QUEUED"],
  READY: ["DISPENSED", "PREPARING"],
  DISPENSED: [],
  CANCELLED: [],
};
const LAB_FLOW: Record<LabStatus, LabStatus[]> = {
  ORDERED: ["SAMPLE_COLLECTED", "CANCELLED"],
  SAMPLE_COLLECTED: ["PROCESSING", "ORDERED"],
  PROCESSING: ["REPORTED", "SAMPLE_COLLECTED"],
  REPORTED: [],
  CANCELLED: [],
};

/** Open orders plus anything finished today. */
const visible = <S extends string>(open: S[], done: S[]) => ({ OR: [{ status: { in: open } }, { status: { in: done }, updatedAt: { gte: istDay() } }] });

export async function pharmacyBoard() {
  const orders = await db.pharmacyOrder.findMany({
    where: visible<PharmacyStatus>(["QUEUED", "PREPARING", "READY"], ["DISPENSED"]),
    orderBy: { createdAt: "asc" },
    include: {
      patient: { select: { name: true, age: true, gender: true, allergies: true, abhaNumber: true } },
      prescription: { include: { items: { orderBy: { position: "asc" } }, consultant: { select: { name: true } }, appointment: { select: { tokenLabel: true } } } },
    },
  });
  return orders.map((o) => ({
    id: o.id, status: o.status, createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
    rxId: o.prescriptionId, token: o.prescription.appointment?.tokenLabel ?? null,
    patient: o.patient, consultant: o.prescription.consultant.name, hprId: o.prescription.hprId, signedAt: o.prescription.signedAt?.toISOString() ?? null,
    items: o.prescription.items.map((i) => ({ drug: i.drug, form: i.form, strength: i.strength, dose: i.dose, frequency: i.frequency, duration: i.duration, instructions: i.instructions, quantity: i.quantity })),
  }));
}
export type PharmacyCard = Awaited<ReturnType<typeof pharmacyBoard>>[number];

export async function labBoard() {
  const orders = await db.labOrder.findMany({
    where: visible<LabStatus>(["ORDERED", "SAMPLE_COLLECTED", "PROCESSING"], ["REPORTED"]),
    orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
    include: {
      patient: { select: { name: true, age: true, gender: true } },
      appointment: { select: { tokenLabel: true } },
      prescription: { select: { consultant: { select: { name: true } } } },
    },
  });
  return orders.map((o) => ({
    id: o.id, status: o.status, test: o.test, urgency: o.urgency, notes: o.notes, createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
    token: o.appointment?.tokenLabel ?? null, patient: o.patient, orderedBy: o.prescription?.consultant.name ?? null,
  }));
}
export type LabCard = Awaited<ReturnType<typeof labBoard>>[number];

export async function advancePharmacy(id: string, to: PharmacyStatus, userId: string) {
  const o = await db.pharmacyOrder.findUnique({ where: { id } });
  if (!o) throw new UserError("Order not found.");
  if (!PHARMACY_FLOW[o.status].includes(to)) throw new UserError(`Can't move an order from ${o.status} to ${to}.`);
  const res = await db.pharmacyOrder.updateMany({ where: { id, status: o.status }, data: { status: to, updatedById: userId } });
  if (res.count === 0) throw new UserError("Someone else just updated this order.");
}

export async function advanceLab(id: string, to: LabStatus, userId: string) {
  const o = await db.labOrder.findUnique({ where: { id } });
  if (!o) throw new UserError("Order not found.");
  if (!LAB_FLOW[o.status].includes(to)) throw new UserError(`Can't move a test from ${o.status} to ${to}.`);
  const res = await db.labOrder.updateMany({ where: { id, status: o.status }, data: { status: to, updatedById: userId } });
  if (res.count === 0) throw new UserError("Someone else just updated this test.");
}

export { LAB_FLOW, PHARMACY_FLOW };
