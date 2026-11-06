import "server-only";
import { z } from "zod";
import { advanceLab, advancePharmacy, labBoard, pharmacyBoard } from "../fulfillment";
import { listDepartments, queueBoard } from "../opd/booking";
import { registerWalkIn } from "../opd/walk-in";
import type { Permission } from "../rbac";
import { UserError } from "../result";
import { HandoverExtractionSchema, RoundsExtractionSchema } from "../sbar/schema";
import { runAsStaff, type SessionUser } from "../staff";
import { approveDraft, discardDraft, getCarePlan, getCensus, getDashboard, setTaskCompleted } from "../store";
import { mostRecentIst, wardFollowups } from "../ward/followups";
import { draftHandover, matchPatient } from "../ward/handover";
import { draftRounds } from "../ward/rounds";
import { resolveActor } from "./actor";

// The tools Pulse Flow gives its Switch agents (served over MCP by switch/mcp/server.ts).
// Each tool runs as the named staff member, through the same RBAC, tenant isolation and DPDP
// audit log as the web app; the audit row records which agent relayed the request.

const actor = z
  .string()
  .min(2)
  .describe("The staff member whose chat message asked for this, exactly as their chat name appears. Never the agent itself.");

interface ToolSpec<S extends z.ZodRawShape> {
  name: string;
  description: string;
  input: S;
  perm: Permission;
  purpose: string;
  run: (u: SessionUser, args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
}

export interface AgentTool {
  name: string;
  description: string;
  input: z.ZodRawShape;
  perm: Permission;
  purpose: string;
  run: (u: SessionUser, args: Record<string, unknown>) => Promise<unknown>;
}

// The cast is safe: runAgentTool() parses every call with `input` before `run` sees it.
const tool = <S extends z.ZodRawShape>(t: ToolSpec<S>): AgentTool => ({ ...t, run: (u, args) => t.run(u, args as z.infer<z.ZodObject<S>>) });

// ─── Ward ─────────────────────────────────────────────────────────────────────

const wardBoard = tool({
  name: "ward_board",
  description: "The ward right now: every bed with its approved SBAR, critical flags, drafts waiting for approval, and open tasks.",
  input: { actor },
  perm: "ward:read",
  purpose: "IPD ward board",
  run: async () => {
    const d = await getDashboard();
    return {
      patients: d.patients.map((p) => ({
        bed: p.bedNumber, name: p.name, age: p.age, diagnosis: p.diagnosis, critical: p.isCritical, criticalReasons: p.criticalReasons,
        sbar: p.sbar, draftWaiting: p.draftId,
      })),
      draftsAwaitingApproval: d.drafts.map((x) => ({
        noteId: x.id, bed: x.bedNumber, name: x.patientName, source: x.source, author: x.authorName, critical: x.isCritical,
        criticalReasons: x.criticalReasons, autoEscalated: x.autoEscalated, missingFields: x.missingFields, uncertainties: x.uncertainties,
        sbar: x.sbar, proposedTasks: x.proposedTasks.map((t) => `${t.priority}: ${t.description}${t.dueText ? ` (${t.dueText})` : ""}`),
      })),
      openTasks: d.tasks.filter((t) => !t.isCompleted).map((t) => ({ taskId: t.id, bed: t.bedNumber, name: t.patientName, task: t.description, priority: t.priority, due: t.dueText })),
    };
  },
});

const submitHandover = tool({
  name: "submit_handover",
  description:
    "Turn a shift handover (the doctor's own words, usually dictated) into one SBAR draft per patient. Drafts are NOT live until a doctor approves them. " +
    "Pass `structured` only if this tool tells you the server's AI is not configured: then structure the dictation yourself into that schema " +
    "(patients[] with bedNumber, patientName, sbar{situation,background,assessment,recommendation}, isCritical, criticalReasons, actionItems, corrections, uncertainties; plus unassignedNotes). " +
    "Use only what the doctor said; leave a field empty rather than guess. Pulse Flow's clinical rules re-check vitals either way.",
  input: {
    actor,
    dictation: z.string().min(10).max(20_000).describe("The doctor's handover, verbatim."),
    structured: HandoverExtractionSchema.optional(),
  },
  perm: "ward:dictate",
  purpose: "IPD shift handover",
  run: async (u, a) => {
    const res = await draftHandover(u, a.dictation, a.structured ? { structured: a.structured, structuredBy: "switch-agent" } : {});
    return {
      handoverId: res.handoverId,
      drafts: res.noteIds.length,
      critical: res.critical.map((c) => ({ noteId: c.noteId, bed: c.bedNumber, name: c.patientName, reasons: c.reasons, ruleOverrodeDoctor: c.autoEscalated })),
      unmatchedPatients: res.unmatched.map((m) => ({ bed: m.bedNumber, name: m.patientName })),
      unassignedNotes: res.unassigned,
      next: "Call ward_board to show each draft, then ask a doctor to approve or discard it.",
    };
  },
});

const approveNote = tool({
  name: "approve_handover_note",
  description:
    "Make a draft SBAR note live and create its tasks. Only call this when a doctor has explicitly approved that note in the room; `actor` must be that doctor. " +
    "Rounds drafts need the consultant.",
  input: { actor, noteId: z.string().min(1) },
  perm: "ward:approve",
  purpose: "IPD note sign-off",
  run: async (u, a) => {
    await approveDraft(a.noteId, u, {});
    return { approved: a.noteId, by: u.name };
  },
});

const discardNote = tool({
  name: "discard_handover_note",
  description: "Discard a draft SBAR note a doctor rejected in the room. `actor` must be that doctor.",
  input: { actor, noteId: z.string().min(1) },
  perm: "ward:approve",
  purpose: "IPD note review",
  run: async (u, a) => {
    await discardDraft(a.noteId, u.id);
    return { discarded: a.noteId, by: u.name };
  },
});

const completeTask = tool({
  name: "complete_task",
  description: "Mark a ward task done (or reopen it) when a staff member says so in the room.",
  input: { actor, taskId: z.string().min(1), done: z.boolean().default(true) },
  perm: "task:complete",
  purpose: "IPD task completion",
  run: async (u, a) => {
    await setTaskCompleted(a.taskId, a.done, u.id);
    return { taskId: a.taskId, done: a.done, by: u.name };
  },
});

/** A ward patient by bed ("ICU-2", "bed 7") or, failing that, a unique name. Never a guess. */
async function wardPatient(ref: string) {
  const census = await getCensus();
  const id = matchPatient(census, ref, ref);
  const p = id && census.find((c) => c.id === id);
  if (!p) throw new UserError(`No single ward patient matches "${ref}". Use the bed number from ward_board.`);
  return p;
}

const carePlan = tool({
  name: "care_plan",
  description: "One patient's current care plan: latest approved SBAR and open tasks with their ids. Read it before structuring a rounds note yourself.",
  input: { actor, bed: z.string().min(1).describe("Bed number (e.g. ICU-2, 7) or the patient's name.") },
  perm: "ward:read",
  purpose: "IPD care plan review",
  run: async (_u, a) => {
    const p = await wardPatient(a.bed);
    const plan = await getCarePlan(p.id);
    return { bed: p.bedNumber, name: p.name, age: plan?.age, sbar: plan?.sbar ?? null, openTasks: plan?.openItems.map((i) => ({ taskId: i.id, task: i.description, due: i.dueText })) ?? [] };
  },
});

const submitRounds = tool({
  name: "submit_rounds",
  description:
    "A consultant's bedside rounds feedback for ONE patient (\"ICU-2: wean norad, stop the 6 AM ABG, start enteral feeds\"), merged into that patient's care plan as a draft. " +
    "Only the consultant can approve rounds drafts. Pass `structured` only if this tool says the server's AI is not configured: then call care_plan, " +
    "and structure it yourself (updatedSbar, isCritical, criticalReasons, newActionItems, cancelActionItemIds/completeActionItemIds using ONLY taskIds from care_plan, corrections, uncertainties).",
  input: {
    actor,
    bed: z.string().min(1).describe("Bed number or the patient's name."),
    dictation: z.string().min(5).max(20_000).describe("The consultant's words, verbatim."),
    structured: RoundsExtractionSchema.optional(),
  },
  perm: "ward:dictate",
  purpose: "IPD consultant rounds",
  run: async (u, a) => {
    const p = await wardPatient(a.bed);
    const r = await draftRounds(u, p, a.dictation, a.structured ? { structured: a.structured, structuredBy: "switch-agent" } : {});
    return { ...r, bed: p.bedNumber, name: p.name, next: "Show the draft (ward_board) and ask the consultant to approve it." };
  },
});

const followups = tool({
  name: "ward_followups",
  description: "What needs chasing: tasks past their stated time (or STAT not done in 30 min) and drafts waiting for approval, with the PG on duty, each patient's consultant and how often each was already nudged. Pass `at` when Pulse Flow's check message names a time (\"06:45 check: …\").",
  input: {
    actor,
    at: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe("IST time of the check from Pulse Flow's message, e.g. 06:45. Omit for now."),
  },
  perm: "ward:read",
  purpose: "Ward follow-up check",
  run: async (_u, { at }) => (at ? wardFollowups(mostRecentIst(at), { answeringCheck: true }) : wardFollowups()),
});

// ─── OPD ──────────────────────────────────────────────────────────────────────

const opdQueue = tool({
  name: "opd_queue",
  description: "Today's OPD queue per department: who is with the doctor, who is waiting (emergencies first), how many are done.",
  input: { actor },
  perm: "queue:read",
  purpose: "OPD queue status",
  run: async () => queueBoard({ maskNames: false }),
});

const departments = tool({
  name: "list_departments",
  description: "Departments at this facility with their codes, rooms and consultants. Use the code in register_walk_in.",
  input: { actor },
  perm: "queue:read",
  purpose: "OPD department lookup",
  run: async () => (await listDepartments()).map((d) => ({ code: d.code, name: d.name, room: d.room, consultant: d.consultant?.name ?? null })),
});

const walkIn = tool({
  name: "register_walk_in",
  description:
    "Register a walk-in patient the front desk describes in the room and give them a token. Pulse Flow re-screens the symptoms for red flags itself: " +
    "an emergency is always escalated, whatever urgency you pass. Ask for anything missing (age, gender, department) instead of guessing.",
  input: {
    actor,
    name: z.string().min(2).max(80),
    age: z.number().int().min(0).max(120),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]),
    phone: z.string().regex(/^[6-9]\d{9}$/).nullable().default(null).describe("10-digit Indian mobile, or null."),
    departmentCode: z.string().min(2).describe("From list_departments, e.g. GENMED."),
    symptoms: z.string().min(3).max(2000).describe("The problem in the front desk's or patient's own words."),
    summary: z.string().min(3).max(200).describe("One-line clinical summary."),
    urgency: z.enum(["ROUTINE", "SOON", "EMERGENCY"]).default("ROUTINE"),
    whatsappConsent: z.boolean().default(false).describe("Only true if the patient agreed to WhatsApp messages."),
  },
  perm: "booking:frontdesk",
  purpose: "Front desk registration",
  run: async (_u, a) => {
    const dept = (await listDepartments()).find((d) => d.code.toUpperCase() === a.departmentCode.toUpperCase());
    if (!dept) throw new UserError(`No department "${a.departmentCode}" here. Call list_departments.`);
    const r = await registerWalkIn({
      name: a.name, age: a.age, gender: a.gender, phone: a.phone, departmentId: dept.id, symptomsRaw: a.symptoms, symptomSummary: a.summary,
      urgency: a.urgency, redFlags: [], whatsappConsent: a.whatsappConsent,
    });
    return {
      token: r.tokenLabel, patient: r.patientName, department: r.department, room: r.room, consultant: r.consultant,
      urgency: r.urgency, redFlags: r.redFlags, escalatedToDoctors: r.escalated, whatsapp: r.whatsapp,
    };
  },
});

// ─── Pharmacy & lab ───────────────────────────────────────────────────────────

const pharmacyQueue = tool({
  name: "pharmacy_queue",
  description: "Open pharmacy orders from signed prescriptions: token, patient, allergies, medicines with quantities, status.",
  input: { actor },
  perm: "pharmacy:read",
  purpose: "Pharmacy dispensing",
  run: async () =>
    (await pharmacyBoard()).map((o) => ({
      orderId: o.id, token: o.token, status: o.status, patient: o.patient.name, allergies: o.patient.allergies, consultant: o.consultant,
      medicines: o.items.map((i) => [i.drug, i.strength, i.dose, i.frequency, i.duration, i.quantity ? `qty ${i.quantity}` : null].filter(Boolean).join(" ")),
    })),
});

/** An order id, or the patient's OPD token (e.g. GAS-014) when exactly one open order has it. */
function pickOrder<T extends { id: string; token: string | null }>(orders: T[], ref: string, what: string): T {
  const r = ref.trim().toUpperCase();
  const hits = orders.filter((o) => o.id === ref.trim() || o.token?.toUpperCase() === r);
  if (hits.length !== 1) throw new UserError(hits.length ? `More than one ${what} matches ${ref}; use the order id.` : `No open ${what} matches ${ref}.`);
  return hits[0];
}

const updatePharmacy = tool({
  name: "update_pharmacy_order",
  description: "Move a pharmacy order along QUEUED → PREPARING → READY → DISPENSED when the pharmacist says so. `order` is the order id or the OPD token.",
  input: { actor, order: z.string().min(1), to: z.enum(["PREPARING", "READY", "DISPENSED", "QUEUED", "CANCELLED"]) },
  perm: "pharmacy:update",
  purpose: "Pharmacy dispensing",
  run: async (u, a) => {
    const o = pickOrder(await pharmacyBoard(), a.order, "pharmacy order");
    await advancePharmacy(o.id, a.to, u.id);
    return { orderId: o.id, token: o.token, patient: o.patient.name, status: a.to, by: u.name };
  },
});

const labQueue = tool({
  name: "lab_queue",
  description: "Open lab tests: token, patient, test, urgency, status.",
  input: { actor },
  perm: "lab:read",
  purpose: "Diagnostics processing",
  run: async () => (await labBoard()).map((o) => ({ orderId: o.id, token: o.token, patient: o.patient.name, test: o.test, urgency: o.urgency, status: o.status })),
});

const updateLab = tool({
  name: "update_lab_order",
  description: "Move a lab test along ORDERED → SAMPLE_COLLECTED → PROCESSING → REPORTED when the lab says so. `order` is the order id (tokens can have several tests).",
  input: { actor, order: z.string().min(1), to: z.enum(["SAMPLE_COLLECTED", "PROCESSING", "REPORTED", "ORDERED", "CANCELLED"]) },
  perm: "lab:update",
  purpose: "Diagnostics processing",
  run: async (u, a) => {
    const o = pickOrder(await labBoard(), a.order, "lab test");
    await advanceLab(o.id, a.to, u.id);
    return { orderId: o.id, token: o.token, patient: o.patient.name, test: o.test, status: a.to, by: u.name };
  },
});

export const AGENT_TOOLS: AgentTool[] = [
  wardBoard, submitHandover, approveNote, discardNote, completeTask, carePlan, submitRounds, followups,
  opdQueue, departments, walkIn,
  pharmacyQueue, updatePharmacy, labQueue, updateLab,
];

/**
 * Runs one tool call for an agent: resolves the human it is acting for, checks their permission,
 * and scopes + audits every query. `agentName` is recorded as the route, e.g. "switch:ward-scribe".
 */
export async function runAgentTool(t: AgentTool, rawArgs: unknown, opts: { facilityId: string; agentName: string }): Promise<unknown> {
  const parsed = z.object(t.input).safeParse(rawArgs);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new UserError(`Invalid ${issue?.path.join(".") || "input"}: ${issue?.message ?? "check the arguments"}.`);
  }
  const u = await resolveActor(String(parsed.data.actor), opts.facilityId);
  return runAsStaff(u, t.perm, { purpose: `${t.purpose} (via Switch)`, route: `switch:${opts.agentName}` }, (me) => t.run(me, parsed.data));
}
