import "server-only";
import { audit } from "@/lib/db";
import type { WardFollowups } from "@/lib/ward/followups";

// Switch: posts Pulse Flow's clinical events into the hospital's team-chat rooms, where staff and
// the Pulse Flow agents (switch/pulse-flow-hospital.template.yaml) pick them up. This replaces the
// ward WhatsApp group: same chat app the team already uses, but every message is structured,
// tied to a patient record, and audit-logged.
//
// 1. Builders turn a domain event into a RoomMessage (plain text + which room + which patients).
// 2. toSwitchRequest() builds the Switch agent-protocol call: POST /agents/{id}/message {room_id, content}.
// 3. postToRoom() sends it (or, with no Switch config, SIMULATES it) and writes an audit SEND entry.
//    It never throws: a chat outage must not fail a handover, a signature or a registration.
//
// Env (all optional; unset → SIMULATED, visible in /audit):
//   SWITCH_URL                      e.g. http://localhost:8008 (the address Switch Console shows)
//   SWITCH_AGENT_ID, SWITCH_AGENT_API_KEY   from `npm run switch:register`
//   SWITCH_ROOM_WARD, SWITCH_ROOM_ESCALATIONS, SWITCH_ROOM_OPD, SWITCH_ROOM_FULFILMENT   room ids

export type RoomKey = "ward" | "escalations" | "opd" | "fulfilment";
export type RoomEvent = "CRITICAL_PATIENT" | "RX_SIGNED" | "EMERGENCY_WALK_IN" | "WARD_NUDGE" | "WARD_BRIEF";
export type DeliveryStatus = "SENT" | "SIMULATED" | "FAILED";

export interface RoomMessage {
  event: RoomEvent;
  room: RoomKey;
  text: string;
  patientIds: string[];
  /** Tasks/notes a nudge names, so the next check can count repeat nudges. */
  itemIds?: string[];
}

export interface SwitchConfig {
  baseUrl: string;
  agentId: string;
  apiKey: string;
  rooms: Partial<Record<RoomKey, string>>;
}

const REQUEST_TIMEOUT_MS = 5_000;
const ROOM_ENV: Record<RoomKey, string> = {
  ward: "SWITCH_ROOM_WARD",
  escalations: "SWITCH_ROOM_ESCALATIONS",
  opd: "SWITCH_ROOM_OPD",
  fulfilment: "SWITCH_ROOM_FULFILMENT",
};

const env = (k: string) => process.env[k]?.trim() || undefined;

/** Null when Switch isn't configured: messages are then simulated, not sent. */
export function switchConfig(): SwitchConfig | null {
  const baseUrl = env("SWITCH_URL");
  const agentId = env("SWITCH_AGENT_ID");
  const apiKey = env("SWITCH_AGENT_API_KEY");
  if (!baseUrl || !agentId || !apiKey) return null;
  const rooms = Object.fromEntries(
    (Object.keys(ROOM_ENV) as RoomKey[]).flatMap((k) => (env(ROOM_ENV[k]) ? [[k, env(ROOM_ENV[k])]] : [])),
  ) as Partial<Record<RoomKey, string>>;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), agentId, apiKey, rooms };
}

// ─── Builders ─────────────────────────────────────────────────────────────────

const list = (xs: string[]) => xs.filter(Boolean).join(", ");

export function buildCriticalAlert(p: {
  bedNumber: string;
  patientName: string;
  reasons: string[];
  autoEscalated: boolean;
  authorName: string;
  patientId: string;
}): RoomMessage {
  const why = p.reasons.length ? list(p.reasons) : "flagged critical in the handover";
  const override = p.autoEscalated ? " The doctor didn't call it critical; the vitals rule did." : "";
  return {
    event: "CRITICAL_PATIENT",
    room: "escalations",
    patientIds: [p.patientId],
    text:
      `🔴 Critical: Bed ${p.bedNumber}, ${p.patientName}. ${why}.${override}\n` +
      `From ${p.authorName}'s handover. The SBAR draft is waiting for a doctor to approve it in the ward room.`,
  };
}

export function buildRxSigned(p: {
  token: string | null;
  patientName: string;
  consultant: string;
  medicines: number;
  labTests: string[];
  allergies: string[];
  patientId: string;
}): RoomMessage {
  const who = p.token ? `${p.token} · ${p.patientName}` : p.patientName;
  const parts = [
    p.medicines ? `${p.medicines} medicine${p.medicines === 1 ? "" : "s"} for pharmacy` : null,
    p.labTests.length ? `lab: ${list(p.labTests)}` : null,
  ].filter(Boolean);
  const allergy = p.allergies.length ? `\n⚠️ Allergies on file: ${list(p.allergies)}.` : "";
  return {
    event: "RX_SIGNED",
    room: "fulfilment",
    patientIds: [p.patientId],
    text: `🧾 Rx signed by ${p.consultant}: ${who}. ${parts.join("; ")}.${allergy}`,
  };
}

export function buildEmergencyWalkIn(p: {
  token: string;
  patientName: string;
  age: number;
  department: string;
  redFlags: string[];
  patientId: string;
}): RoomMessage {
  return {
    event: "EMERGENCY_WALK_IN",
    room: "escalations",
    patientIds: [p.patientId],
    text:
      `🚨 Emergency at the front desk: ${p.token}, ${p.patientName} (${p.age}y), ${p.department}. ` +
      `Red flags: ${list(p.redFlags)}. Moved to the top of the queue; a doctor needs to see them now.`,
  };
}

/**
 * Wakes the ward coordinator agent: its name leads the message (how Switch addresses an agent in
 * Telegram and the other bridges), followed by everything it needs to chase people by name.
 * Null when there is nothing to chase, so quiet wards get no noise.
 */
const LONG_WAIT_MIN = 90;
/** "20 min" under an hour and a half, "3 h" beyond it. */
const duration = (min: number) => (min < LONG_WAIT_MIN ? `${min} min` : `${Math.round(min / 60)} h`);

export function buildWardNudge(f: WardFollowups, coordinator: string): RoomMessage | null {
  if (!f.overdueTasks.length && !f.staleDrafts.length) return null;
  const again = (n: number) => (n ? ` · nudged ${n}× already` : "");
  const tasks = f.overdueTasks.map(
    (t) => `- [task ${t.taskId}] Bed ${t.bed} ${t.patient} · ${t.priority} ${t.task}${t.dueText ? ` (due ${t.dueText})` : ""} · ${duration(t.minutesLate)} late${t.consultant ? ` · consultant ${t.consultant}` : ""}${again(t.nudgedBefore)}`,
  );
  const drafts = f.staleDrafts.map(
    (d) => `- [note ${d.noteId}] Bed ${d.bed} ${d.patient} · ${d.critical ? "🔴 critical " : ""}${d.source === "ROUNDS" ? "rounds" : "handover"} draft by ${d.author} · waiting ${duration(d.minutesWaiting)} for ${d.needs}${d.consultant ? ` (${d.consultant})` : ""}${again(d.nudgedBefore)}`,
  );
  return {
    event: "WARD_NUDGE",
    room: "ward",
    patientIds: [...new Set([...f.overdueTasks.map((t) => t.patientId), ...f.staleDrafts.map((d) => d.patientId)])],
    itemIds: [...f.overdueTasks.map((t) => t.taskId), ...f.staleDrafts.map((d) => d.noteId)],
    text: [
      `@${coordinator} follow-up check. PG on duty: ${f.pgOnDuty ?? "unknown"}.`,
      ...(tasks.length ? ["⏰ Late tasks:", ...tasks] : []),
      ...(drafts.length ? ["📝 Waiting for approval:", ...drafts] : []),
    ].join("\n"),
  };
}

export interface BriefPatient {
  bed: string;
  name: string;
  diagnosis: string | null;
  critical: boolean;
  criticalReasons: string[];
  openTasks: number;
  draftWaiting: boolean;
  patientId: string;
}

/** The consultant's 8 AM ward brief: critical beds first, one line per bed. */
export function buildWardBrief(p: { patients: BriefPatient[]; lateTasks: number; draftsWaiting: number; facilityName: string }): RoomMessage {
  const order = [...p.patients].sort((a, b) => Number(b.critical) - Number(a.critical) || a.bed.localeCompare(b.bed, undefined, { numeric: true }));
  const line = (x: BriefPatient) =>
    `${x.critical ? "🔴" : "•"} Bed ${x.bed} ${x.name}${x.diagnosis ? ` · ${x.diagnosis}` : ""}` +
    `${x.critical && x.criticalReasons.length ? ` · ${x.criticalReasons.join(", ")}` : ""}` +
    `${x.openTasks ? ` · ${x.openTasks} open task${x.openTasks === 1 ? "" : "s"}` : ""}${x.draftWaiting ? " · draft waiting" : ""}`;
  const critical = order.filter((x) => x.critical).length;
  return {
    event: "WARD_BRIEF",
    room: "escalations",
    patientIds: p.patients.map((x) => x.patientId),
    text: [
      `☀️ Ward brief, ${p.facilityName}: ${p.patients.length} patients, ${critical} critical, ${p.draftsWaiting} draft${p.draftsWaiting === 1 ? "" : "s"} waiting, ${p.lateTasks} late task${p.lateTasks === 1 ? "" : "s"}.`,
      ...order.map(line),
    ].join("\n"),
  };
}

// ─── Transport ────────────────────────────────────────────────────────────────

/** The Switch agent-protocol call for one message. Pure, so it is unit-tested without a server. */
export function toSwitchRequest(cfg: SwitchConfig, m: RoomMessage): { url: string; init: RequestInit } | null {
  const roomId = cfg.rooms[m.room];
  if (!roomId) return null;
  return {
    url: `${cfg.baseUrl}/agents/${encodeURIComponent(cfg.agentId)}/message`,
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, content: m.text }),
    },
  };
}

async function deliver(m: RoomMessage): Promise<{ status: DeliveryStatus; error?: string }> {
  const cfg = switchConfig();
  const req = cfg && toSwitchRequest(cfg, m);
  if (!req) return { status: "SIMULATED" };
  try {
    const res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (res.ok) return { status: "SENT" };
    return { status: "FAILED", error: `Switch ${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Never throws. Every attempt (sent, simulated or failed) is in the audit log. */
export async function postToRoom(m: RoomMessage): Promise<DeliveryStatus> {
  const outcome = await deliver(m);
  try {
    await audit("SEND", "Switch", {
      patientIds: m.patientIds,
      meta: {
        event: m.event, room: m.room, status: outcome.status, text: m.text,
        ...(m.itemIds?.length ? { itemIds: m.itemIds } : {}),
        ...(outcome.error ? { error: outcome.error } : {}),
      },
    });
  } catch (err) {
    console.error("Switch audit log failed", err);
  }
  return outcome.status;
}
