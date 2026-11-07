// Switch layer unit tests: `npm run test:switch`. No database, Switch server or API key needed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chatHandleMap, matchStaff } from "../lib/agents/actor";
import { AGENT_TOOLS } from "../lib/agents/tools";
import { buildCriticalAlert, buildEmergencyWalkIn, buildRxSigned, switchConfig, toSwitchRequest, type SwitchConfig } from "../server/services/Switch";
import { registrationBody } from "../switch/register";
import { roleInstructions } from "../switch/role-instructions";
import { buildTelegramTemplate, TELEGRAM_JOINS } from "../switch/telegram-template";
import { AGENT_TOOLSETS } from "../switch/toolsets";

let passed = 0;
const test = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`✓ ${name}`);
};

const cfg: SwitchConfig = { baseUrl: "http://switch.local:8008", agentId: "agt_1", apiKey: "key_123", rooms: { escalations: "!esc:room", fulfilment: "!ful:room" } };

// ── Room messages ────────────────────────────────────────────────────────────
test("critical alert goes to escalations, names bed + reasons, and says when the vitals rule overrode the doctor", () => {
  const m = buildCriticalAlert({ bedNumber: "21", patientName: "Fatima Khan", reasons: ["BP 80/50 (SBP < 90)"], autoEscalated: true, authorName: "Dr. Rahul Verma", patientId: "p-e" });
  assert.equal(m.room, "escalations");
  assert.equal(m.event, "CRITICAL_PATIENT");
  assert.deepEqual(m.patientIds, ["p-e"]);
  assert.match(m.text, /Bed 21, Fatima Khan\. BP 80\/50/);
  assert.match(m.text, /vitals rule did/);
  assert.match(m.text, /waiting for a doctor to approve/);
});
test("Rx signed goes to fulfilment with medicines, tests and allergy warning", () => {
  const m = buildRxSigned({ token: "GAS-014", patientName: "Ravi", consultant: "Dr. Arvind Rao", medicines: 3, labTests: ["CBC", "LFT"], allergies: ["Penicillin"], patientId: "p1" });
  assert.equal(m.room, "fulfilment");
  assert.match(m.text, /GAS-014 · Ravi\. 3 medicines for pharmacy; lab: CBC, LFT\./);
  assert.match(m.text, /Allergies on file: Penicillin/);
});
test("Rx signed with tests only doesn't mention pharmacy; singular medicine reads right", () => {
  assert.doesNotMatch(buildRxSigned({ token: null, patientName: "A", consultant: "Dr X", medicines: 0, labTests: ["CBC"], allergies: [], patientId: "p" }).text, /pharmacy|Allergies/);
  assert.match(buildRxSigned({ token: null, patientName: "A", consultant: "Dr X", medicines: 1, labTests: [], allergies: [], patientId: "p" }).text, /1 medicine for pharmacy/);
});
test("emergency walk-in goes to escalations with token and red flags", () => {
  const m = buildEmergencyWalkIn({ token: "GEN-007", patientName: "Ramesh Patil", age: 54, department: "General Medicine", redFlags: ["Chest pain or pressure"], patientId: "p2" });
  assert.equal(m.room, "escalations");
  assert.match(m.text, /GEN-007, Ramesh Patil \(54y\), General Medicine\. Red flags: Chest pain or pressure/);
});

// ── Switch agent protocol request ────────────────────────────────────────────
test("toSwitchRequest: POST /agents/{id}/message with bearer key and {room_id, content}", () => {
  const m = buildCriticalAlert({ bedNumber: "7", patientName: "Meera", reasons: [], autoEscalated: false, authorName: "Dr R", patientId: "p" });
  const req = toSwitchRequest(cfg, m)!;
  assert.equal(req.url, "http://switch.local:8008/agents/agt_1/message");
  assert.equal(req.init.method, "POST");
  assert.equal((req.init.headers as Record<string, string>).Authorization, "Bearer key_123");
  assert.deepEqual(JSON.parse(String(req.init.body)), { room_id: "!esc:room", content: m.text });
});
test("toSwitchRequest: no room configured for the event → null (simulated, never sent to the wrong room)", () => {
  const m = buildCriticalAlert({ bedNumber: "7", patientName: "Meera", reasons: [], autoEscalated: false, authorName: "Dr R", patientId: "p" });
  assert.equal(toSwitchRequest({ ...cfg, rooms: { ward: "!ward:room" } }, m), null);
});
test("switchConfig: incomplete env → null; full env → trimmed URL and rooms", () => {
  const keys = ["SWITCH_URL", "SWITCH_AGENT_ID", "SWITCH_AGENT_API_KEY", "SWITCH_ROOM_WARD", "SWITCH_ROOM_ESCALATIONS", "SWITCH_ROOM_OPD", "SWITCH_ROOM_FULFILMENT"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    assert.equal(switchConfig(), null);
    Object.assign(process.env, { SWITCH_URL: "http://s:1/", SWITCH_AGENT_ID: "a", SWITCH_AGENT_API_KEY: "k", SWITCH_ROOM_WARD: "!w" });
    assert.deepEqual(switchConfig(), { baseUrl: "http://s:1", agentId: "a", apiKey: "k", rooms: { ward: "!w" } });
  } finally {
    for (const k of keys) saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k]);
  }
});
test("registration body follows the agent protocol (name pattern, integration_profile arrays)", () => {
  const b = registrationBody("pulse-flow-events");
  assert.match(b.name, /^[a-z0-9][a-z0-9._-]*$/);
  assert.equal(b.integration_profile.connection_model, "always_on");
  assert.deepEqual(b.integration_profile.event_reporting, []);
});

// ── Acting for the right person ──────────────────────────────────────────────
const staff = [
  { id: "u-rahul", name: "Dr. Rahul Verma" },
  { id: "u-menon", name: "Dr. Suresh Menon" },
  { id: "u-rao", name: "Dr. Arvind Rao" },
  { id: "u-kavya", name: "Kavya Rao" },
];
test("actor: chat names match staff with or without 'Dr', @, dots or case", () => {
  const none = new Map<string, string>();
  assert.equal(matchStaff("Dr Suresh Menon", staff, none), "u-menon");
  assert.equal(matchStaff("@suresh.menon", staff, none), "u-menon");
  assert.equal(matchStaff("rahul", staff, none), "u-rahul");
  assert.equal(matchStaff("u-kavya", staff, none), "u-kavya");
});
test("actor: ambiguous or unknown names never guess", () => {
  assert.equal(matchStaff("Rao", staff, new Map()), null); // Dr. Arvind Rao or Kavya Rao
  assert.equal(matchStaff("Dr. House", staff, new Map()), null);
  assert.equal(matchStaff("  ", staff, new Map()), null);
});
test("actor: PULSE_FLOW_CHAT_HANDLES maps chat handles; unknown target ids are ignored", () => {
  const handles = chatHandleMap("anupama=u-menon, night_pg = u-rahul, ghost=u-nobody, broken");
  assert.equal(matchStaff("Anupama", staff, handles), "u-menon");
  assert.equal(matchStaff("night-pg", staff, handles), "u-rahul");
  assert.equal(matchStaff("ghost", staff, handles), null);
});
test("actor: a handle mapped \"@agent\" plays that role only in that agent's group", () => {
  const raw = "teammate=u-rahul, teammate=u-kavya@fulfilment";
  assert.equal(matchStaff("teammate", staff, chatHandleMap(raw, "ward-scribe")), "u-rahul");
  assert.equal(matchStaff("teammate", staff, chatHandleMap(raw, "fulfilment")), "u-kavya");
});

// ── Agent toolsets and template stay in sync with the tool server ────────────
test("every agent's toolset names real tools, and every tool belongs to an agent", () => {
  const real = new Set(AGENT_TOOLS.map((t) => t.name));
  const used = Object.values(AGENT_TOOLSETS).flat();
  for (const t of used) assert.ok(real.has(t), `unknown tool ${t}`);
  assert.deepEqual([...real].sort(), [...new Set(used)].sort());
});
test("every tool requires `actor`, so no agent can act as itself", () => {
  for (const t of AGENT_TOOLS) assert.ok("actor" in t.input, `${t.name} has no actor`);
});
test("template: each agent's directory matches a toolset folder and is a Claude Code agent", () => {
  const yaml = readFileSync("switch/pulse-flow-hospital.template.yaml", "utf8");
  for (const agent of Object.keys(AGENT_TOOLSETS)) assert.ok(yaml.includes(`{pulse_flow_dir}/switch/agents/${agent}"`), `no directory for ${agent}`);
  assert.equal((yaml.match(/provider: claude/g) ?? []).length, Object.keys(AGENT_TOOLSETS).length);
});

// ── Telegram template ────────────────────────────────────────────────────────
test("Telegram template is generated from the main one and is up to date (npm run switch:templates)", () => {
  const main = readFileSync("switch/pulse-flow-hospital.template.yaml", "utf8");
  assert.equal(readFileSync("switch/pulse-flow-telegram.template.yaml", "utf8"), buildTelegramTemplate(main));
});
test("Telegram template: no bridge, no rooms created, every agent joins the same rooms it's in on the main template", () => {
  const tg = readFileSync("switch/pulse-flow-telegram.template.yaml", "utf8");
  assert.doesNotMatch(tg, /^\s*(bridge|rooms|links|group):/m);
  assert.deepEqual(Object.keys(TELEGRAM_JOINS).sort(), Object.keys(AGENT_TOOLSETS).sort());
  const main = readFileSync("switch/pulse-flow-hospital.template.yaml", "utf8");
  const roomOf: Record<string, string> = { ward_room: "ward", escalations_room: "escalations", opd_room: "opd-desk", fulfilment_room: "fulfilment" };
  for (const [agent, rooms] of Object.entries(TELEGRAM_JOINS)) {
    const inMain = [...main.matchAll(/- name: "\{team\}-([a-z-]+)"\n(?:.*\n){1,3}?\s+agents: \[([^\]]*)\]/g)]
      .filter((m) => m[2].includes(`"{team}-${agent}"`))
      .map((m) => m[1])
      .sort();
    assert.deepEqual(rooms.map((r) => roomOf[r]).sort(), inMain, agent);
  }
});

test("every agent's CLAUDE.md gets its role steps from the template, with the team filled in", () => {
  const template = readFileSync(new URL("../switch/pulse-flow-hospital.template.yaml", import.meta.url), "utf8");
  for (const agent of Object.keys(AGENT_TOOLSETS)) {
    const role = roleInstructions(template, agent, "lotus");
    assert.ok(role.startsWith("You are the"), agent);
    assert.ok(!role.includes("{team}") && !role.includes("instructions: |"), agent);
  }
  assert.match(roleInstructions(template, "ward-scribe", "lotus"), /call submit_handover with actor = their chat name/);
});

console.log(`\n${passed} Switch tests passed`);
