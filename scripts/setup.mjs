// One-command local setup: `npm run setup`.
// Checks prerequisites first so a fresh clone fails with a clear message instead of a stack trace.
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";

const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 11; // `--env-file` (seed, tests) and import.meta.dirname (switch:setup)

const step = (msg) => console.log(`\n▸ ${msg}`);
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const quietly = (cmd) => {
  try {
    execSync(cmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor < MIN_NODE_MINOR)) {
  fail(`Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}+ is required (you have ${process.versions.node}).`);
}
if (!quietly("docker info")) fail("Docker isn't running. Start Docker Desktop (or another Docker engine) and run `npm run setup` again.");

if (!existsSync(".env")) {
  step("Creating .env from .env.example");
  copyFileSync(".env.example", ".env");
}
const env = readFileSync(".env", "utf8");
const hasAiKey = /^(GEMINI_API_KEY|ANTHROPIC_API_KEY)=\S+/m.test(env);

step("Installing dependencies");
run("npm install --no-audit --no-fund");
step("Starting Postgres (Docker)");
run("npm run db:up");
step("Creating tables");
run("npm run db:push");
step("Loading demo hospital data");
run("npm run db:seed");

console.log("\n✓ Pulse Flow is ready. Run `npm run dev` and open http://localhost:3000");
if (!hasAiKey) {
  console.log(
    "  No AI key in .env yet: every screen works, and dictation falls back to manual entry.\n" +
      "  Add GEMINI_API_KEY (free at https://aistudio.google.com/apikey) to turn on AI structuring,\n" +
      "  or use the Switch agents (switch/README.md): they structure notes with your own Claude Code.",
  );
}
