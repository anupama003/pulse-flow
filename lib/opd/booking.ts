import "server-only";
import { Prisma, type AppointmentStatus, type BookingChannel, type Gender, type Urgency } from "@prisma/client";
import { requireCtx } from "../context";
import { db, type Tx } from "../db";
import { UserError } from "../result";
import { istDay } from "../time";

// OPD appointments and the per-department daily token sequence.

export const TOKEN_PREFIX: Record<string, string> = { GENMED: "GEN", GASTRO: "GAS", PAEDS: "PED", DERM: "DER", ORTHO: "ORT", ENT: "ENT" };
const prefixFor = (code: string) => TOKEN_PREFIX[code] ?? code.slice(0, 3).toUpperCase();

export async function listDepartments() {
  const deps = await db.department.findMany({
    orderBy: { name: "asc" },
    include: { consultants: { where: { role: "CONSULTANT" }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } } },
  });
  return deps.map((d) => ({ id: d.id, code: d.code, name: d.name, room: d.room, consultant: d.consultants[0] ?? null }));
}
export type DepartmentOption = Awaited<ReturnType<typeof listDepartments>>[number];

/**
 * Next sequential token for a department on a day. One atomic statement
 * (INSERT … ON CONFLICT DO UPDATE … RETURNING), so two receptionists can't get the same number.
 */
async function nextToken(tx: Tx, departmentId: string, code: string, date: Date) {
  const { facilityId } = requireCtx(); // raw SQL bypasses the tenant extension, so scope explicitly
  const rows = await tx.$queryRaw<{ last: number }[]>(Prisma.sql`
    INSERT INTO "TokenCounter" ("facilityId", "departmentId", "date", "last")
    VALUES (${facilityId}, ${departmentId}, ${date}::date, 1)
    ON CONFLICT ("facilityId", "departmentId", "date")
    DO UPDATE SET "last" = "TokenCounter"."last" + 1
    RETURNING "last"`);
  const n = Number(rows[0].last);
  return { tokenNumber: n, tokenLabel: `${prefixFor(code)}-${String(n).padStart(3, "0")}` };
}

export interface PatientInput {
  name: string;
  age: number;
  gender: Gender;
  phone: string | null;
  abhaNumber?: string | null;
  abhaAddress?: string | null;
  whatsappConsent: boolean;
}

/** Same facility + same ABHA, or same phone + same first name → existing record. Otherwise new. */
async function findOrCreatePatient(tx: Tx, p: PatientInput) {
  const first = p.name.trim().split(/\s+/)[0];
  const existing =
    (p.abhaNumber && (await tx.patient.findFirst({ where: { abhaNumber: p.abhaNumber } }))) ||
    (p.phone && (await tx.patient.findFirst({ where: { phone: p.phone, name: { startsWith: first, mode: "insensitive" } } })));
  const abha = p.abhaNumber ? { abhaNumber: p.abhaNumber, abhaAddress: p.abhaAddress ?? null, abhaLinkedAt: new Date() } : {};
  const consent = { careConsentAt: new Date(), whatsappConsent: p.whatsappConsent };
  if (existing) return tx.patient.update({ where: { id: existing.id }, data: { ...abha, ...consent, age: p.age, phone: p.phone ?? existing.phone } });
  return tx.patient.create({
    data: { name: p.name.trim(), age: p.age, gender: p.gender, phone: p.phone, ...abha, ...consent } as Prisma.PatientUncheckedCreateInput,
  });
}

export interface NewAppointment {
  patient: PatientInput;
  departmentId: string;
  date: Date;
  channel: BookingChannel;
  status: Extract<AppointmentStatus, "BOOKED" | "WAITING">;
  symptomsRaw?: string | null;
  symptomSummary?: string | null;
  urgency?: Urgency;
  redFlags?: string[];
  preferredSlot?: string | null;
}

export async function createAppointment(input: NewAppointment) {
  const dept = await db.department.findUnique({ where: { id: input.departmentId }, include: { consultants: { where: { role: "CONSULTANT" }, take: 1 } } });
  if (!dept) throw new UserError("That department isn't available at this facility.");
  const today = istDay();
  if (input.date < today || input.date > istDay(30)) throw new UserError("Choose a date between today and the next 30 days.");

  return db.$transaction(async (tx) => {
    const patient = await findOrCreatePatient(tx, input.patient);
    const token = await nextToken(tx, dept.id, dept.code, input.date);
    const appt = await tx.appointment.create({
      data: {
        patientId: patient.id, departmentId: dept.id, consultantId: dept.consultants[0]?.id ?? null, date: input.date, ...token,
        status: input.status, channel: input.channel, symptomsRaw: input.symptomsRaw ?? null, symptomSummary: input.symptomSummary ?? null,
        urgency: input.urgency ?? "ROUTINE", redFlags: input.redFlags ?? [], preferredSlot: input.preferredSlot ?? null,
        checkedInAt: input.status === "WAITING" ? new Date() : null,
      } as Prisma.AppointmentUncheckedCreateInput,
    });
    return {
      appointmentId: appt.id, tokenLabel: appt.tokenLabel, date: appt.date.toISOString(), patientId: patient.id, patientName: patient.name,
      department: dept.name, room: dept.room, consultant: dept.consultants[0]?.name ?? null, abhaLinked: !!patient.abhaNumber,
    };
  });
}
export type BookingConfirmation = Awaited<ReturnType<typeof createAppointment>>;

// ─── Front desk ───────────────────────────────────────────────────────────────

export async function frontDeskDay() {
  const date = istDay();
  const appts = await db.appointment.findMany({
    where: { date },
    orderBy: [{ status: "asc" }, { tokenNumber: "asc" }],
    include: { patient: { select: { name: true, age: true, gender: true, phone: true, abhaNumber: true } }, department: { select: { name: true, room: true } } },
  });
  return appts.map((a) => ({
    id: a.id, token: a.tokenLabel, status: a.status, channel: a.channel, urgency: a.urgency, summary: a.symptomSummary,
    patient: a.patient.name, age: a.patient.age, gender: a.patient.gender, phone: a.patient.phone, abha: a.patient.abhaNumber,
    department: a.department.name, room: a.department.room, createdAt: a.createdAt.toISOString(),
  }));
}
export type FrontDeskRow = Awaited<ReturnType<typeof frontDeskDay>>[number];

export async function setAppointmentStatus(id: string, from: AppointmentStatus[], to: AppointmentStatus) {
  const stamp = to === "WAITING" ? { checkedInAt: new Date() } : to === "IN_CONSULT" ? { calledAt: new Date() } : to === "COMPLETED" ? { completedAt: new Date() } : {};
  const res = await db.appointment.updateMany({ where: { id, status: { in: from } }, data: { status: to, ...stamp } });
  if (res.count === 0) throw new UserError("This token was already updated by someone else. Refreshing.");
}

// ─── Live queue (OPD console + waiting-room TV) ───────────────────────────────

const mask = (name: string) => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

export async function queueBoard(opts: { maskNames: boolean }) {
  const date = istDay();
  const [deps, appts] = await Promise.all([
    listDepartments(),
    db.appointment.findMany({
      where: { date, status: { in: ["WAITING", "IN_CONSULT", "COMPLETED"] } },
      orderBy: [{ tokenNumber: "asc" }],
      include: { patient: { select: { name: true } } },
    }),
  ]);
  const show = (n: string) => (opts.maskNames ? mask(n) : n);
  // Emergency/soon first, then token order.
  const rank = { EMERGENCY: 0, SOON: 1, ROUTINE: 2 } as const;
  return deps.map((d) => {
    const mine = appts.filter((a) => a.departmentId === d.id);
    const now = mine.find((a) => a.status === "IN_CONSULT");
    const waiting = mine.filter((a) => a.status === "WAITING").sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.tokenNumber - b.tokenNumber);
    return {
      departmentId: d.id, department: d.name, code: d.code, room: d.room, consultant: d.consultant?.name ?? null,
      nowServing: now ? { id: now.id, token: now.tokenLabel, name: show(now.patient.name), since: (now.calledAt ?? now.createdAt).toISOString() } : null,
      waiting: waiting.map((a) => ({ id: a.id, token: a.tokenLabel, name: show(a.patient.name), urgency: a.urgency, channel: a.channel })),
      done: mine.filter((a) => a.status === "COMPLETED").length,
    };
  });
}
export type QueueRoom = Awaited<ReturnType<typeof queueBoard>>[number];
