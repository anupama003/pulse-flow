// The role steps for one agent, taken from the template so CLAUDE.md and Switch never disagree.
const INSTRUCTION_INDENT = "      ";

/** One agent's `instructions: |` block from the template, with {team} filled in. */
export function roleInstructions(template: string, agent: string, teamName: string): string {
  const lines = template.split("\n");
  const start = lines.findIndex((l) => l.trim() === `- name: "{team}-${agent}"`);
  if (start < 0) throw new Error(`No agent "${agent}" in the template.`);
  const from = lines.findIndex((l, i) => i > start && l.trim() === "instructions: |");
  const body: string[] = [];
  for (const line of lines.slice(from + 1)) {
    if (line.trim() && !line.startsWith(INSTRUCTION_INDENT)) break;
    body.push(line.slice(INSTRUCTION_INDENT.length));
  }
  return body.join("\n").trim().replaceAll("{team}", teamName);
}
