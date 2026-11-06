// Builds switch/pulse-flow-telegram.template.yaml from switch/pulse-flow-hospital.template.yaml.
//
// Switch can't create Telegram groups: you create them in Telegram and add the bot, and Switch
// makes each group a room. So the Telegram template keeps the same agents (same instructions,
// single source) but, instead of creating rooms, asks for the four existing rooms and `join`s each
// agent to the ones its job needs. Regenerate after editing the main template:
//   npm run switch:templates        (a test fails if the two drift apart)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const TELEGRAM_ROOMS = {
  ward_room: { label: "Ward group", hint: "the Telegram group for ward handovers, e.g. Lotus Ward" },
  escalations_room: { label: "Escalations group", hint: "the consultants' Telegram group, e.g. Lotus Escalations" },
  opd_room: { label: "OPD desk group", hint: "the front-desk Telegram group, e.g. Lotus OPD Desk" },
  fulfilment_room: { label: "Pharmacy & lab group", hint: "the pharmacy/lab Telegram group, e.g. Lotus Pharmacy & Lab" },
} as const;
type RoomParam = keyof typeof TELEGRAM_ROOMS;

/** Which existing rooms each agent joins (same as the rooms each agent is in, in the main template). */
export const TELEGRAM_JOINS: Record<string, RoomParam[]> = {
  "ward-scribe": ["ward_room", "escalations_room"],
  "ward-coordinator": ["ward_room", "escalations_room"],
  "opd-desk": ["opd_room", "escalations_room"],
  fulfilment: ["fulfilment_room"],
};

const HEADER = `# Pulse Flow hospital agents for TELEGRAM. GENERATED from pulse-flow-hospital.template.yaml by
# \`npm run switch:templates\`: edit that file, not this one.
#
# Telegram groups can't be created by bots, so this template creates only the four agents and adds
# them to four groups you already made in Telegram (each with the Switch bot in it, which turns the
# group into a room). Then add the events agent to all four rooms in Switch Console.
# Step by step: switch/TELEGRAM.md
`;

export function buildTelegramTemplate(main: string): string {
  const paramsStart = main.indexOf("params:");
  const agentsStart = main.indexOf("\nagents:");
  const groupStart = main.indexOf("\ngroup:");
  if (paramsStart < 0 || agentsStart < 0 || groupStart < 0) throw new Error("Main template layout changed: expected params:, agents:, group: sections.");

  // Params: everything but the bridge (rooms already exist on Telegram), plus one room param each.
  const params = main
    .slice(paramsStart, agentsStart)
    .replace(/\n  bridge:\n(?: {4}.*\n?)+/, "\n")
    .trimEnd();
  const roomParams = (Object.keys(TELEGRAM_ROOMS) as RoomParam[])
    .map((k) => `  ${k}:\n    type: room\n    label: ${TELEGRAM_ROOMS[k].label}\n    description: ${TELEGRAM_ROOMS[k].hint}`)
    .join("\n");

  // Agents: unchanged, plus a join line after each agent's directory.
  const agents = main.slice(agentsStart + 1, groupStart).replace(
    /( {4}directory: "\{pulse_flow_dir\}\/switch\/agents\/([a-z-]+)"\n)/g,
    (line: string, _all: string, agent: string) => {
      const rooms = TELEGRAM_JOINS[agent];
      if (!rooms) throw new Error(`No Telegram rooms listed for agent "${agent}" in TELEGRAM_JOINS.`);
      return `${line}    join: [${rooms.map((r) => `"{${r}}"`).join(", ")}]\n`;
    },
  );

  return `${HEADER}version: 1\n\n${params}\n${roomParams}\n\n${agents.trimEnd()}\n`;
}

const dir = import.meta.dirname;
export const MAIN_TEMPLATE = join(dir, "pulse-flow-hospital.template.yaml");
export const TELEGRAM_TEMPLATE = join(dir, "pulse-flow-telegram.template.yaml");

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(TELEGRAM_TEMPLATE, buildTelegramTemplate(readFileSync(MAIN_TEMPLATE, "utf8")));
  console.log(`✓ Wrote ${TELEGRAM_TEMPLATE}`);
}
