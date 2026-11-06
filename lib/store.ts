import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { SessionUser } from "./staff";
import { SBAR_KEYS, type SbarKey, type ValidatedDraft } from "./sbar/clinical-rules";
import type { Correction, Sbar } from "./sbar/schema";
import type { DashboardData, DraftEdits, DraftView, PatientView, Proposal, ProposedTask, Source, TaskView } from "./types";

// IPD (ward) persistence. Every query goes through `db`, which scopes it to the caller's
// facility and audit-logs it, so nothing here mentions facilityId.

export class StoreError extends Error {}

type Shift = "DAY" | "NIGHT";
const currentShift = (): Shift => {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h >= 8 && h < 20 ? "DAY" : "NIGHT";
};
const COMPLETED_VISIBLE_MS = 12 * 60 * 60 * 1000;
const json = (v: unknown) => v as Prisma.InputJsonValue;

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<DashboardData> {
  const since = new Date(Date.now() - COMPLETED_VISIBLE_MS);
  const [patients, approved, drafts, tasks] = await Promise.all([
    db.patient.findMany({
      where: { bedNumber: { not: null } }, // IPD only
      include: { admissions: { where: { dischargedAt: null }, orderBy: { admittedAt: "desc" }, take: 1 } },
    }),
    db.sbarNote.findMany({ where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, distinct: ["patientId"] }),
    db.sbarNote.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" }, include: { handover: { include: { author: true } } } }),
    db.actionItem.findMany({
      where: { OR: [{ status: "PENDING" }, { status: "DONE", completedAt: { gte: since } }] },
      orderBy: { createdAt: "asc" },
      include: { completedBy: true },
    }),
  ]);

  const byPatient = new Map(patients.map((p) => [p.id, p]));
  const approvedBy = new Map(approved.map((n) => [n.patientId, n]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const latestDraft = new Map<string, (typeof drafts)[number]>();
  for (const d of drafts) if (!latestDraft.has(d.patientId)) latestDraft.set(d.patientId, d);

  return {
    patients: patients.map((p): PatientView => {
      const note = approvedBy.get(p.id);
      const draft = latestDraft.get(p.id);
      return {
        id: p.id, name: p.name, age: p.age, gender: p.gender, bedNumber: p.bedNumber ?? "-", ward: p.ward,
        diagnosis: p.admissions[0]?.diagnosis ?? null,
        sbar: (note?.sbar as Sbar | undefined) ?? null,
        isCritical: note?.isCritical ?? false,
        criticalReasons: note?.criticalReasons ?? [],
        updatedAt: (note?.approvedAt ?? note?.createdAt ?? p.updatedAt).toISOString(),
        draftId: draft?.id ?? null,
        draftCritical: draft?.isCritical ?? false,
      };
    }),
    tasks: tasks
      .filter((t) => byPatient.has(t.patientId))
      .map((t): TaskView => {
        const p = byPatient.get(t.patientId)!;
        return {
          id: t.id, patientId: t.patientId, bedNumber: p.bedNumber ?? "-", patientName: p.name, description: t.description,
          priority: t.priority, dueText: t.dueText, isCompleted: t.isCompleted, completedByName: t.completedBy?.name ?? null,
          source: t.source, createdAt: t.createdAt.toISOString(),
        };
      }),
    drafts: drafts
      .filter((d) => byPatient.has(d.patientId))
      .map((d): DraftView => {
        const p = byPatient.get(d.patientId)!;
        const prop = (d.proposal ?? {}) as Proposal;
        const name = (id: string) => ({ id, description: taskById.get(id)?.description ?? "(task no longer open)" });
        return {
          id: d.id, handoverId: d.handoverId, patientId: d.patientId, bedNumber: p.bedNumber ?? "-", patientName: p.name, ward: p.ward,
          source: d.handover.source, authorName: d.handover.author.name, createdAt: d.createdAt.toISOString(),
          rawDictation: d.handover.rawDictation, segment: prop.segment ?? null,
          sbar: d.sbar as Sbar, isCritical: d.isCritical, criticalReasons: d.criticalReasons, autoEscalated: d.autoEscalated,
          missingFields: d.missingFields as SbarKey[], corrections: (d.corrections ?? []) as Correction[], uncertainties: d.uncertainties,
          proposedTasks: prop.actionItems ?? [],
          cancelTasks: (prop.cancelIds ?? []).map(name),
          completeTasks: (prop.completeIds ?? []).map(name),
        };
      }),
  };
}

export async function getCensus() {
  return db.patient.findMany({ where: { bedNumber: { not: null } }, select: { id: true, bedNumber: true, name: true, age: true } });
}

/** The care plan the rounds extractor merges into: latest approved SBAR + open tasks. */
export async function getCarePlan(patientId: string) {
  const patient = await db.patient.findUnique({
    where: { id: patientId },
    include: {
      sbarNotes: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 1 },
      actionItems: { where: { status: "PENDING" }, select: { id: true, description: true, dueText: true } },
    },
  });
  if (!patient) return null;
  return { age: patient.age, sbar: (patient.sbarNotes[0]?.sbar as Sbar | undefined) ?? null, openItems: patient.actionItems };
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export interface NewDraft {
  patientId: string;
  draft: ValidatedDraft;
  segment: string;
  cancelIds?: string[];
  completeIds?: string[];
}

const toProposed = (d: ValidatedDraft): ProposedTask[] =>
  d.actionItems.map((a) => ({ description: a.condition ? `If ${a.condition}: ${a.description}` : a.description, priority: a.priority, dueText: a.dueText }));

/** Saves one dictation and its per-patient AI drafts. Nothing touches the live record yet. */
export async function createDrafts(input: { authorId: string; source: Source; raw: string; parserMeta: Record<string, unknown>; drafts: NewDraft[] }) {
  return db.$transaction(async (tx) => {
    const h = await tx.handover.create({
      data: { authorId: input.authorId, source: input.source, shift: currentShift(), rawDictation: input.raw, parserMeta: json(input.parserMeta) } as Prisma.HandoverUncheckedCreateInput,
    });
    const noteIds: string[] = [];
    for (const { patientId, draft: d, segment, cancelIds, completeIds } of input.drafts) {
      const data = {
        handoverId: h.id, patientId, sbar: json(d.sbar), isCritical: d.isCritical, criticalReasons: d.criticalReasons,
        autoEscalated: d.autoEscalated, missingFields: d.missingFields, corrections: json(d.corrections), uncertainties: d.uncertainties,
        proposal: json({ actionItems: toProposed(d), cancelIds: cancelIds ?? [], completeIds: completeIds ?? [], segment } satisfies Proposal),
      } as Prisma.SbarNoteUncheckedCreateInput;
      const row = await tx.sbarNote.upsert({ where: { handoverId_patientId: { handoverId: h.id, patientId } }, create: data, update: data });
      noteIds.push(row.id);
    }
    return { handoverId: h.id, noteIds };
  });
}

/** Human-in-the-loop sign-off: apply edits, make SBAR live, create tasks, apply rounds cancellations. */
export async function approveDraft(noteId: string, approver: SessionUser, edits: DraftEdits): Promise<void> {
  const note = await db.sbarNote.findUnique({ where: { id: noteId }, include: { handover: true } });
  if (!note) throw new StoreError("This draft no longer exists.");
  if (note.status !== "DRAFT") throw new StoreError("This draft was already reviewed.");
  if (note.handover.source === "ROUNDS" && approver.role !== "CONSULTANT") {
    throw new StoreError("Rounds orders need the consultant's sign-off. Switch to the consultant to approve.");
  }

  const original = note.sbar as Sbar;
  const sbar: Sbar = edits.sbar ? { ...original, ...edits.sbar } : original;
  const isCritical = edits.isCritical ?? note.isCritical;
  const prop = (note.proposal ?? {}) as Proposal;
  const drop = new Set(edits.dropTaskIndexes ?? []);
  const tasks = (prop.actionItems ?? []).filter((_, i) => !drop.has(i));
  const edited = SBAR_KEYS.some((k) => sbar[k] !== original[k]) || isCritical !== note.isCritical || drop.size > 0;
  const now = new Date();
  const { handover } = note;

  await db.$transaction(async (tx) => {
    // Conditional update = optimistic lock: two doctors can't approve the same draft twice.
    const res = await tx.sbarNote.updateMany({
      where: { id: noteId, status: "DRAFT" },
      data: { sbar: json(sbar), isCritical, edited, missingFields: SBAR_KEYS.filter((k) => !sbar[k].trim()), status: "APPROVED", approvedById: approver.id, approvedAt: now },
    });
    if (res.count === 0) throw new StoreError("This draft was already reviewed.");
    if (tasks.length) {
      await tx.actionItem.createMany({
        data: tasks.map((t) => ({
          handoverId: handover.id, patientId: note.patientId, description: t.description, priority: t.priority, dueText: t.dueText,
          source: handover.source, shift: handover.shift,
        })) as Prisma.ActionItemCreateManyInput[],
      });
    }
    const close = { patientId: note.patientId, status: "PENDING" as const };
    await tx.actionItem.updateMany({ where: { ...close, id: { in: prop.cancelIds ?? [] } }, data: { status: "CANCELLED", isCompleted: true, completedAt: now, completedById: approver.id } });
    await tx.actionItem.updateMany({ where: { ...close, id: { in: prop.completeIds ?? [] } }, data: { status: "DONE", isCompleted: true, completedAt: now, completedById: approver.id } });
  });
}

export async function discardDraft(noteId: string, userId: string): Promise<void> {
  const res = await db.sbarNote.updateMany({ where: { id: noteId, status: "DRAFT" }, data: { status: "DISCARDED", approvedById: userId, approvedAt: new Date() } });
  if (res.count === 0) throw new StoreError("This draft was already reviewed.");
}

export async function setTaskCompleted(id: string, done: boolean, userId: string): Promise<void> {
  const res = await db.actionItem.updateMany({
    where: { id, status: { not: "CANCELLED" } },
    data: { isCompleted: done, status: done ? "DONE" : "PENDING", completedAt: done ? new Date() : null, completedById: done ? userId : null },
  });
  if (res.count === 0) throw new StoreError("Task not found.");
}
