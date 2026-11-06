// `npm run switch:setup`: writes each Pulse Flow agent's working directory, so the Claude Code
// session Switch runs there starts with the Pulse Flow tool server and the shared agent rules.
//
//   switch/agents/<agent>/.mcp.json             the pulse-flow MCP server (absolute paths, this machine)
//   switch/agents/<agent>/.claude/settings.json pre-approves that server and its tools
//   switch/agents/<agent>/CLAUDE.md             switch/agent-rules.md
//
// The folders are generated (machine-specific paths) and git-ignored. Re-run after moving the repo.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AGENT_TOOLSETS } from "./toolsets";

const repo = resolve(import.meta.dirname, "..");
const facility = process.env.PULSE_FLOW_FACILITY?.trim() || "lotus-ridge";
const tsx = join(repo, "node_modules", ".bin", "tsx");

if (!existsSync(tsx)) {
  console.error("✗ Dependencies aren't installed. Run `npm run setup` first.");
  process.exit(1);
}
if (!existsSync(join(repo, ".env"))) {
  console.error("✗ No .env yet. Run `npm run setup` first (it creates one).");
  process.exit(1);
}

for (const [agent, tools] of Object.entries(AGENT_TOOLSETS)) {
  const dir = join(repo, "switch", "agents", agent);
  mkdirSync(join(dir, ".claude"), { recursive: true });

  const mcp = {
    mcpServers: {
      "pulse-flow": {
        command: tsx,
        args: ["--env-file", join(repo, ".env"), "--conditions=react-server", "--tsconfig", join(repo, "tsconfig.json"), join(repo, "switch", "mcp", "server.ts")],
        env: { PULSE_FLOW_AGENT: agent, PULSE_FLOW_FACILITY: facility, PULSE_FLOW_TOOLS: tools.join(",") },
      },
    },
  };
  writeFileSync(join(dir, ".mcp.json"), `${JSON.stringify(mcp, null, 2)}\n`);
  writeFileSync(
    join(dir, ".claude", "settings.json"),
    `${JSON.stringify({ enableAllProjectMcpServers: true, permissions: { allow: tools.map((t) => `mcp__pulse-flow__${t}`) } }, null, 2)}\n`,
  );
  copyFileSync(join(repo, "switch", "agent-rules.md"), join(dir, "CLAUDE.md"));
  console.log(`✓ ${agent}: ${tools.length} tools → ${dir}`);
}

console.log(`
Next, in Switch Console:
  1. npm run switch:register   (once: the agent Pulse Flow posts events as; see switch/README.md)
  2. Templates → Import → switch/pulse-flow-telegram.template.yaml (Telegram, see switch/TELEGRAM.md)
     or switch/pulse-flow-hospital.template.yaml (Slack, Discord, Mattermost, Teams)
  3. pulse_flow_dir = ${repo}
`);
