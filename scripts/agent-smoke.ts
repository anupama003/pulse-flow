// Switch agent integration checks against a seeded Postgres: `npm run test:agents` (run `npm run db:reset` first).
// No API key or Switch server needed: the agent supplies its own structuring, and room posts are SIMULATED.
// Exercises every guarantee the agents rely on: acting-for-a-person RBAC, tenancy, the vitals override,
// human approval, emergency escalation, and the real MCP server over stdio.
import assert from "node:assert/strict";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { AGENT_TOOLS, runAgentTool } from "../lib/agents/tools";
import { base } from "../lib/db";
import { ForbiddenError } from "../lib/staff";
import { UserError } from "../lib/result";
import { runWardChecks } from "../lib/ward/nudges";

const MARK = "SMOKE-AGENT";
const HOSPITAL = { facilityId: "f-hospital", agentName: "smoke-test" };
const CLINIC = { facilityId: "f-clinic", agentName: "smoke-test" };
const tool = (name: string) => AGENT_TOOLS.find((t) => t.name === name)!;
const call = (name: string, args: Record<string, unknown>, where = HOSPITAL) => runAgentTool(tool(name), args, where) as Promise<Record<string, unknown>>;

let passed = 0;
const test = async (name: string, fn: () => Promise<void>) => {
  await fn();
  passed++;
  console.log(`✓ ${name}`);
};

async function cleanup() {
  await base.handover.deleteMany({ where: { rawDictation: { contains: MARK } } }); // notes + tasks cascade
  await base.messageLog.deleteMany({ where: { patient: { name: { startsWith: "Smoke Agent" } } } });
  await base.appointment.deleteMany({ where: { patient: { name: { startsWith: "Smoke Agent" } } } });
  await base.patient.deleteMany({ where: { name: { startsWith: "Smoke Agent" } } });
}

// What the agent's own model would produce. The doctor calls bed 21 "stable"; the vitals say otherwise.
const DICTATION = `${MARK} Bed 21 Fatima Khan, admitted with UTI, on IV ceftriaxone. She's stable, BP 80/50 at 2 AM, HR 104. Recheck BP at 4 AM and send a urine culture.`;
const STRUCTURED = {
  patients: [
    {
      bedNumber: "21", patientName: "Fatima Khan",
      sbar: { situation: "Stable overnight per PG", background: "UTI on IV ceftriaxone", assessment: "Stable", recommendation: "Recheck BP at 4 AM, send urine culture" },
      isCritical: false, criticalReasons: [],
      actionItems: [{ description: "Recheck BP", priority: "HIGH", dueText: "4 AM", condition: null, sourceQuote: "Recheck BP at 4 AM" }],
      corrections: [], uncertainties: [],
    },
  ],
  unassignedNotes: [],
};

async function main() {
  await cleanup();

  await test("RBAC: a pharmacist asking the ward scribe can't dictate a handover, and the refusal is audit-logged", async () => {
    await assert.rejects(call("submit_handover", { actor: "Farhan Sheikh", dictation: DICTATION, structured: STRUCTURED }), ForbiddenError);
    const denied = await base.auditLog.findFirst({ where: { action: "DENIED", actorId: "u-farhan", route: "switch:smoke-test" }, orderBy: { at: "desc" } });
    assert.ok(denied, "no DENIED audit row");
  });

  await test("actor: an unknown chat name is refused with the staff list, never guessed", async () => {
    await assert.rejects(call("ward_board", { actor: "Dr. House" }), (e: unknown) => e instanceof UserError && /Dr\. Rahul Verma/.test(e.message));
  });

  await test("tenancy: a clinic agent can't act as hospital staff or see hospital beds", async () => {
    await assert.rejects(call("ward_board", { actor: "Dr. Suresh Menon" }, CLINIC), UserError);
    const clinicBoard = await call("ward_board", { actor: "Dr. Imran Qureshi" }, CLINIC).catch((e) => e);
    // The clinic consultant either has no ward or sees an empty one; never the hospital's patients.
    if (!(clinicBoard instanceof Error)) assert.equal((clinicBoard.patients as unknown[]).length, 0);
  });

  let noteId = "";
  await test("handover: agent-structured 'stable' + BP 80/50 is auto-escalated to critical, and escalations is notified", async () => {
    const res = await call("submit_handover", { actor: "rahul verma", dictation: DICTATION, structured: STRUCTURED });
    const critical = res.critical as { noteId: string; bed: string; ruleOverrodeDoctor: boolean }[];
    assert.equal(res.drafts, 1);
    assert.equal(critical.length, 1);
    assert.equal(critical[0].bed, "21");
    assert.equal(critical[0].ruleOverrodeDoctor, true);
    noteId = critical[0].noteId;
    const note = await base.sbarNote.findUniqueOrThrow({ where: { id: noteId }, include: { handover: true } });
    assert.equal(note.status, "DRAFT");
    assert.equal((note.handover.parserMeta as { provider?: string }).provider, "switch-agent");
    const sent = await base.auditLog.findFirst({ where: { entity: "Switch", patientIds: { has: note.patientId } }, orderBy: { at: "desc" } });
    assert.equal((sent?.meta as { event?: string; status?: string }).event, "CRITICAL_PATIENT");
    assert.equal((sent?.meta as { status?: string }).status, "SIMULATED");
  });

  await test("handover: structure that breaks the schema is refused with the failing path", async () => {
    await assert.rejects(
      call("submit_handover", { actor: "Dr. Rahul Verma", dictation: DICTATION, structured: { patients: [{ bedNumber: "21" }], unassignedNotes: [] } }),
      UserError,
    );
  });

  await test("approval: the front desk can't approve; the day PG can, and it's recorded under her name", async () => {
    await assert.rejects(call("approve_handover_note", { actor: "Anjali Desai", noteId }), ForbiddenError);
    const ok = await call("approve_handover_note", { actor: "Dr Priya Raghavan", noteId });
    assert.equal(ok.by, "Dr. Priya Raghavan");
    const note = await base.sbarNote.findUniqueOrThrow({ where: { id: noteId } });
    assert.equal(note.status, "APPROVED");
    assert.equal(note.approvedById, "u-priya");
    await assert.rejects(call("approve_handover_note", { actor: "Dr Priya Raghavan", noteId }), /already reviewed/);
    const tasks = await base.actionItem.findMany({ where: { handover: { rawDictation: { contains: MARK } } } });
    assert.equal(tasks.length, 1);
  });

  await test("walk-in: chest pain is an emergency even if the agent says ROUTINE, and doctors are alerted", async () => {
    const r = await call("register_walk_in", {
      actor: "Anjali Desai", name: "Smoke Agent Ramesh", age: 54, gender: "MALE", departmentCode: "GENMED",
      symptoms: "chest pain since morning, sweating", summary: "Chest pain since morning", urgency: "ROUTINE",
    });
    assert.equal(r.urgency, "EMERGENCY");
    assert.equal(r.escalatedToDoctors, true);
    assert.match(String(r.token), /^GEN-\d{3}$/);
    const sent = await base.auditLog.findFirst({ where: { entity: "Switch", meta: { path: ["event"], equals: "EMERGENCY_WALK_IN" } }, orderBy: { at: "desc" } });
    assert.ok(sent);
  });

  await test("pharmacy: the pharmacist moves an order by OPD token; skipping a step is refused", async () => {
    const queue = (await call("pharmacy_queue", { actor: "Farhan Sheikh" })) as unknown as { token: string | null; status: string }[];
    const queued = queue.find((o) => o.status === "QUEUED" && o.token);
    assert.ok(queued, "seed has no queued pharmacy order with a token");
    await assert.rejects(call("update_pharmacy_order", { actor: "Farhan Sheikh", order: queued.token, to: "DISPENSED" }), /Can't move/);
    const moved = await call("update_pharmacy_order", { actor: "Farhan Sheikh", order: queued.token!.toLowerCase(), to: "PREPARING" });
    assert.equal(moved.status, "PREPARING");
    await call("update_pharmacy_order", { actor: "Farhan Sheikh", order: queued.token, to: "QUEUED" }); // put the demo back
  });

  let abgTaskId = "";
  await test("rounds: the consultant's bedside feedback becomes a rounds draft; only real open tasks can be stopped", async () => {
    const plan = await call("care_plan", { actor: "Dr. Priya Raghavan", bed: "icu 2" });
    const abg = (plan.openTasks as { taskId: string; task: string }[]).find((t) => /ABG/.test(t.task));
    assert.ok(abg, "seed has no open ABG task on ICU-2");
    abgTaskId = abg.taskId;
    const r = await call("submit_rounds", {
      actor: "Dr Suresh Menon", bed: "ICU-2",
      dictation: `${MARK} ICU-2 rounds: BP now 96/60 on norad 0.05, wean off by noon, stop the 6 AM ABG, start enteral feeds.`,
      structured: {
        updatedSbar: { situation: "BP 96/60 on norad 0.05", background: "Septic shock, RLL pneumonia, on meropenem", assessment: "Improving", recommendation: "Wean norad off by noon, start enteral feeds" },
        isCritical: false, criticalReasons: [],
        newActionItems: [{ description: "Wean noradrenaline off", priority: "HIGH", dueText: "noon", condition: null, sourceQuote: "wean off by noon" }],
        cancelActionItemIds: [abgTaskId, "t-not-a-real-task"], completeActionItemIds: [], corrections: [], uncertainties: [],
      },
    });
    assert.equal(r.cancelTasks, 1); // the invented id is dropped, never applied
    assert.equal(r.newTasks, 1);
    noteId = String(r.noteId);
  });

  await test("rounds: a PG can't approve the consultant's rounds draft; the consultant can, and the stopped task closes", async () => {
    await assert.rejects(call("approve_handover_note", { actor: "Dr Priya Raghavan", noteId }), /consultant/);
    await call("approve_handover_note", { actor: "Dr Suresh Menon", noteId });
    const task = await base.actionItem.findUniqueOrThrow({ where: { id: abgTaskId } });
    assert.equal(task.status, "CANCELLED");
    await base.actionItem.update({ where: { id: abgTaskId }, data: { status: "PENDING", isCompleted: false, completedAt: null, completedById: null } }); // put the demo back
  });

  await test("coordinator: a check finds late tasks, posts one nudge addressed to the coordinator, and counts repeat nudges", async () => {
    const later = new Date(Date.now() + 2 * 24 * 60 * 60_000); // every timed task in the seed is late by then
    const [first] = await runWardChecks({ brief: true, now: later });
    assert.equal(first.facility, "Lotus Ridge Hospital");
    assert.ok(first.nudge && first.nudge.items > 0);
    assert.equal(first.nudge.status, "SIMULATED");
    assert.equal(first.brief, "SIMULATED");
    await runWardChecks({ brief: false, now: later });
    const last = await base.auditLog.findFirst({ where: { entity: "Switch", meta: { path: ["event"], equals: "WARD_NUDGE" } }, orderBy: { at: "desc" } });
    const text = String((last?.meta as { text?: string }).text);
    assert.match(text, /^lotus-ward-coordinator: follow-up check\. PG on duty: Dr\. /);
    assert.match(text, /nudged \d+× already/);
    const brief = await base.auditLog.findFirst({ where: { entity: "Switch", meta: { path: ["event"], equals: "WARD_BRIEF" } }, orderBy: { at: "desc" } });
    assert.match(String((brief?.meta as { text?: string }).text), /^☀️ Ward brief, Lotus Ridge Hospital: 5 patients/);
  });

  await test("coordinator: ward_followups answers a PG, refuses a pharmacist", async () => {
    const f = await call("ward_followups", { actor: "Dr. Rahul Verma" });
    assert.ok(Array.isArray(f.overdueTasks) && Array.isArray(f.staleDrafts));
    await assert.rejects(call("ward_followups", { actor: "Farhan Sheikh" }), ForbiddenError);
  });

  await test("MCP: the real tool server starts over stdio, exposes only the agent's toolset, and answers a call", async () => {
    const repo = process.cwd();
    const transport = new StdioClientTransport({
      command: join(repo, "node_modules", ".bin", "tsx"),
      args: ["--env-file", join(repo, ".env"), "--conditions=react-server", join(repo, "switch", "mcp", "server.ts")],
      env: { ...(process.env as Record<string, string>), PULSE_FLOW_AGENT: "ward-scribe", PULSE_FLOW_FACILITY: "lotus-ridge", PULSE_FLOW_TOOLS: "ward_board,approve_handover_note" },
      stderr: "pipe",
    });
    const client = new Client({ name: "agent-smoke", version: "1.0.0" });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      assert.deepEqual(tools.map((t) => t.name).sort(), ["approve_handover_note", "ward_board"]);
      const board = await client.callTool({ name: "ward_board", arguments: { actor: "Dr. Suresh Menon" } });
      const text = (board.content as { type: string; text: string }[])[0].text;
      assert.ok(!board.isError, text);
      assert.ok((JSON.parse(text).patients as { bed: string }[]).some((p) => p.bed === "21"));
      const refused = await client.callTool({ name: "approve_handover_note", arguments: { actor: "Kavya Rao", noteId } });
      assert.equal(refused.isError, true);
      const read = await base.auditLog.findFirst({ where: { action: "READ", actorId: "u-menon", route: "switch:ward-scribe" }, orderBy: { at: "desc" } });
      assert.ok(read, "the MCP call wasn't audit-logged under the human and the agent");
    } finally {
      await client.close();
    }
  });

  await cleanup();
  console.log(`\n${passed} agent integration tests passed`);
}

main()
  .catch(async (err) => {
    console.error(err);
    await cleanup().catch(() => undefined);
    process.exitCode = 1;
  })
  .finally(() => base.$disconnect());
