import "server-only";
import { base, db } from "../db";
import { requireCtx } from "../context";

// What a charge nurse chases on a ward round of the phones: tasks past their time, and notes no
// doctor has approved yet. Pulse Flow computes this (deterministic, testable); the Switch ward
// coordinator agent does the chasing in the room, by name, and escalates what stays stuck.

const IST_OFFSET_MS = 330 * 60_000;
const MINUTE = 60_000;
/** A task is "late" only after this grace period past its stated time. */
export const LATE_GRACE_MIN = 15;
/** STAT with no time stated: expected within this long of being ordered. */
export const STAT_EXPECTED_MIN = 30;
/** Drafts waiting longer than this need a doctor's eyes (critical ones sooner). */
export const STALE_DRAFT_MIN = 60;
export const STALE_CRITICAL_DRAFT_MIN = 20;

/**
 * When a task was due, from the time as dictated: "6 AM", "4", "06:30", "at 8 pm", "in 2 hours",
 * "now"/"stat". Clock times resolve to the first such IST time after the order was given.
 * Anything vaguer ("tomorrow", "after review") returns null: never guess a deadline.
 */
export function parseDue(dueText: string | null, orderedAt: Date): Date | null {
  const t = (dueText ?? "").toLowerCase().trim();
  if (!t) return null;
  if (/^(now|stat|immediately|asap|right away)\b/.test(t)) return orderedAt;

  const rel = t.match(/\bin\s+(\d{1,3})\s*(min(?:ute)?s?|hours?|hrs?|h)\b/);
  if (rel) return new Date(orderedAt.getTime() + Number(rel[1]) * (rel[2].startsWith("m") ? MINUTE : 60 * MINUTE));

  if (/\b\d+\s*(days?|weeks?|months?)\b/.test(t)) return null; // "in 2 days" is not 2 o'clock
  if (/\b(every|hourly|q\d+h)\b|\d+\s*-?\s*hourly/.test(t)) return null; // recurring: no single deadline

  const clock = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?=\s|$|,)/);
  if (!clock) return null;
  let hour = Number(clock[1]);
  const minute = Number(clock[2] ?? 0);
  const meridiem = clock[3]?.[0];
  if (hour > 23 || minute > 59) return null;
  if (meridiem === "p" && hour < 12) hour += 12;
  if (meridiem === "a" && hour === 12) hour = 0;
  // A bare "4" or "8" with no am/pm: the next time the clock shows it (4 AM or 4 PM).
  const ambiguous = !meridiem && !clock[2] && hour <= 12;

  const candidates = (ambiguous ? [hour % 12, (hour % 12) + 12] : [hour]).flatMap((h) => [0, 1].map((day) => istClock(orderedAt, h, minute, day)));
  return candidates.filter((d) => d.getTime() > orderedAt.getTime()).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

/** hh:mm IST on the IST calendar day of `from` (+ dayOffset), as a UTC instant. */
function istClock(from: Date, hour: number, minute: number, dayOffset: number): Date {
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  const utcMidnightOfIstDay = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + dayOffset);
  return new Date(utcMidnightOfIstDay + (hour * 60 + minute) * MINUTE - IST_OFFSET_MS);
}

export interface OverdueTask {
  taskId: string;
  patientId: string;
  bed: string;
  patient: string;
  task: string;
  priority: "STAT" | "HIGH" | "ROUTINE";
  dueText: string | null;
  minutesLate: number;
  consultant: string | null;
  nudgedBefore: number;
}

export interface StaleDraft {
  noteId: string;
  patientId: string;
  bed: string;
  patient: string;
  critical: boolean;
  source: "HANDOVER" | "ROUNDS";
  author: string;
  minutesWaiting: number;
  needs: "a doctor" | "the consultant";
  consultant: string | null;
  nudgedBefore: number;
}

const DAY_MS = 24 * 60 * MINUTE;

/** "06:45": a time on the IST clock, as the ward says it. */
export function istHhmm(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

/** The last time the IST clock showed HH:MM, at or before now. Used to replay a check ("--at 06:45"). */
export function mostRecentIst(hhmm: string, now = new Date()): Date {
  const at = /^\d{1,2}:\d{2}$/.test(hhmm) ? parseDue(hhmm, new Date(now.getTime() - DAY_MS)) : null;
  if (!at || at.getTime() > now.getTime()) throw new Error(`Expected a 24-hour IST time like 06:45 (got "${hhmm}").`);
  return at;
}

export interface WardFollowups {
  checkedAt: string;
  pgOnDuty: string | null;
  overdueTasks: OverdueTask[];
  staleDrafts: StaleDraft[];
}

/** Pure: which open tasks are late at `now`. Exported for tests. */
export function lateBy(task: { priority: string; dueText: string | null; createdAt: Date }, now: Date): number | null {
  const due = parseDue(task.dueText, task.createdAt);
  const deadline = due ? due.getTime() + LATE_GRACE_MIN * MINUTE : task.priority === "STAT" ? task.createdAt.getTime() + STAT_EXPECTED_MIN * MINUTE : null;
  if (deadline === null || now.getTime() <= deadline) return null;
  return Math.round((now.getTime() - (due ?? new Date(task.createdAt.getTime() + STAT_EXPECTED_MIN * MINUTE)).getTime()) / MINUTE);
}

const isDayShift = (now: Date) => {
  const h = new Date(now.getTime() + IST_OFFSET_MS).getUTCHours();
  return h >= 8 && h < 20;
};

/** Task and note ids are unique, so this only bounds the scan; open items older than this are long escalated. */
const NUDGE_LOOKBACK_MS = 7 * 24 * 60 * MINUTE;

/** How many earlier nudges already named each task/note, so the coordinator knows when to escalate. */
/**
 * How often Pulse Flow already listed each item in a check. When the coordinator answers a check,
 * that check is already logged; it isn't an earlier reminder, so `skipLatest` leaves it out.
 */
async function priorNudges(facilityId: string, skipLatest: boolean): Promise<Map<string, number>> {
  const rows = await base.auditLog.findMany({
    where: { facilityId, entity: "Switch", at: { gte: new Date(Date.now() - NUDGE_LOOKBACK_MS) }, meta: { path: ["event"], equals: "WARD_NUDGE" } },
    select: { meta: true },
    orderBy: { at: "desc" },
  });
  const counts = new Map<string, number>();
  for (const r of skipLatest ? rows.slice(1) : rows) for (const id of ((r.meta as { itemIds?: string[] }).itemIds ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Runs inside a request context (staff or SYSTEM): tenant-scoped and audit-logged like every read. */
export async function wardFollowups(now = new Date(), opts: { answeringCheck?: boolean } = {}): Promise<WardFollowups> {
  const { facilityId } = requireCtx();
  const [tasks, drafts, pgs, nudged] = await Promise.all([
    db.actionItem.findMany({
      where: { status: "PENDING", patient: { bedNumber: { not: null } } },
      include: { patient: { include: { admissions: { where: { dischargedAt: null }, include: { admittingConsultant: true }, take: 1 } } } },
      orderBy: { createdAt: "asc" },
    }),
    db.sbarNote.findMany({
      where: { status: "DRAFT" },
      include: {
        handover: { include: { author: true } },
        patient: { include: { admissions: { where: { dischargedAt: null }, include: { admittingConsultant: true }, take: 1 } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    base.user.findMany({ where: { facilityId, role: { in: ["PG_DAY", "PG_NIGHT"] } }, select: { name: true, role: true } }),
    priorNudges(facilityId, opts.answeringCheck ?? false),
  ]);
  const consultantOf = (p: { admissions: { admittingConsultant: { name: string } | null }[] }) => p.admissions[0]?.admittingConsultant?.name ?? null;

  const overdueTasks = tasks.flatMap((t): OverdueTask[] => {
    const late = lateBy(t, now);
    if (late === null) return [];
    return [{
      taskId: t.id, patientId: t.patientId, bed: t.patient.bedNumber ?? "-", patient: t.patient.name, task: t.description, priority: t.priority,
      dueText: t.dueText, minutesLate: late, consultant: consultantOf(t.patient), nudgedBefore: nudged.get(t.id) ?? 0,
    }];
  });

  const staleDrafts = drafts.flatMap((d): StaleDraft[] => {
    const waiting = Math.round((now.getTime() - d.createdAt.getTime()) / MINUTE);
    if (waiting < (d.isCritical ? STALE_CRITICAL_DRAFT_MIN : STALE_DRAFT_MIN)) return [];
    return [{
      noteId: d.id, patientId: d.patientId, bed: d.patient.bedNumber ?? "-", patient: d.patient.name, critical: d.isCritical, source: d.handover.source,
      author: d.handover.author.name, minutesWaiting: waiting, needs: d.handover.source === "ROUNDS" ? "the consultant" : "a doctor",
      consultant: consultantOf(d.patient), nudgedBefore: nudged.get(d.id) ?? 0,
    }];
  });

  const onDuty = pgs.find((u) => u.role === (isDayShift(now) ? "PG_DAY" : "PG_NIGHT"));
  return { checkedAt: now.toISOString(), pgOnDuty: onDuty?.name ?? null, overdueTasks, staleDrafts };
}
