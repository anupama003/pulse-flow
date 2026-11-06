// Pulse Flow's tool server for Switch agents (Model Context Protocol over stdio).
//
// Each Switch agent (a Claude Code session in a hospital chat room) launches this server from its
// working directory's .mcp.json (written by `npm run switch:setup`). One process per agent:
//   PULSE_FLOW_FACILITY  facility id or slug the agent works for (default: the first facility)
//   PULSE_FLOW_AGENT     the agent's name, recorded on every audit row (default: "switch-agent")
//   PULSE_FLOW_TOOLS     optional comma list limiting which tools this agent gets
//
// Run by hand to check it starts: npm run switch:mcp
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AGENT_TOOLS, runAgentTool } from "../../lib/agents/tools";
import { base } from "../../lib/db";
import { fail } from "../../lib/result";

const SERVER_VERSION = "1.0.0";

async function facilityId(ref: string | undefined): Promise<{ id: string; name: string }> {
  const f = ref
    ? await base.facility.findFirst({ where: { OR: [{ id: ref }, { slug: ref }] } })
    : await base.facility.findFirst({ orderBy: { createdAt: "asc" } });
  if (!f) throw new Error(`Facility "${ref ?? "(first)"}" not found. Run \`npm run db:reset\` or fix PULSE_FLOW_FACILITY.`);
  return { id: f.id, name: f.name };
}

async function main() {
  const facility = await facilityId(process.env.PULSE_FLOW_FACILITY?.trim() || undefined);
  const agentName = process.env.PULSE_FLOW_AGENT?.trim() || "switch-agent";
  const allow = new Set((process.env.PULSE_FLOW_TOOLS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const tools = allow.size ? AGENT_TOOLS.filter((t) => allow.has(t.name)) : AGENT_TOOLS;

  const server = new McpServer({ name: "pulse-flow", version: SERVER_VERSION }, {
    instructions:
      `Pulse Flow hospital tools for ${facility.name}. Every call acts for the staff member named in \`actor\` ` +
      "(the person whose chat message asked), under their role's permissions, and is audit-logged. " +
      "AI only drafts: nothing becomes part of the record until a named clinician approves it.",
  });

  for (const t of tools) {
    server.registerTool(t.name, { description: t.description, inputSchema: t.input }, async (args) => {
      try {
        const result = await runAgentTool(t, args, { facilityId: facility.id, agentName });
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        // Same rule as the web app: user-facing errors pass through, anything else is logged and hidden.
        return { content: [{ type: "text" as const, text: fail(err).error }], isError: true };
      }
    });
  }

  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error("Pulse Flow MCP server failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});
