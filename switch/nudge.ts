// `npm run switch:nudge`: the ward coordinator's alarm clock.
//
//   npm run switch:nudge                 one check now: late tasks + drafts waiting → #ward, addressed to the coordinator
//   npm run switch:nudge -- --brief      also post the consultant's ward brief to #escalations
//   npm run switch:nudge -- --watch      keep running: a check every 15 min, the brief daily at 08:00 IST
//   npm run switch:nudge -- --at 06:45   demo: check as if it were the most recent 06:45 IST (the demo
//                                        hospital's data is "last night", so this replays that morning)
//
// Without Switch configured, the messages are simulated and shown in Audit → Switch rooms.
import { parseDue } from "../lib/ward/followups";
import { runWardChecks, type WardCheckResult } from "../lib/ward/nudges";

const CHECK_EVERY_MS = 15 * 60_000;
const BRIEF_HOUR_IST = 8;
const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 24 * 60 * 60_000;

const argv = process.argv.slice(2);
const args = new Set(argv);
const atIndex = argv.indexOf("--at");
const istNow = () => new Date(Date.now() + IST_OFFSET_MS);
const istDate = () => istNow().toISOString().slice(0, 10);

/** The last time the IST clock showed HH:MM, at or before now. */
function mostRecentIst(hhmm: string): Date {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) throw new Error(`--at needs a 24-hour time like 06:45 (got "${hhmm}").`);
  const at = parseDue(hhmm, new Date(Date.now() - DAY_MS));
  if (!at) throw new Error(`--at needs a 24-hour time like 06:45 (got "${hhmm}").`);
  return at;
}

function report(results: WardCheckResult[]) {
  for (const r of results) {
    const nudge = r.nudge ? `${r.nudge.items} item(s) → #ward (${r.nudge.status.toLowerCase()})` : "nothing to chase";
    const brief = r.brief ? `, brief → #escalations (${r.brief.toLowerCase()})` : "";
    console.log(`${istNow().toISOString().slice(11, 16)} IST · ${r.facility}: ${nudge}${brief}`);
  }
}

async function main() {
  if (!args.has("--watch")) {
    const at = atIndex >= 0 ? mostRecentIst(argv[atIndex + 1] ?? "") : null;
    if (at) console.log(`Simulating a check at ${argv[atIndex + 1]} IST (${at.toISOString()}).`);
    report(await runWardChecks({ brief: args.has("--brief"), now: at ?? undefined }));
    return;
  }
  let briefedOn = "";
  const tick = async () => {
    const due = istNow().getUTCHours() >= BRIEF_HOUR_IST && briefedOn !== istDate();
    if (due) briefedOn = istDate();
    try {
      report(await runWardChecks({ brief: due }));
    } catch (err) {
      console.error("Ward check failed; will retry next tick:", err instanceof Error ? err.message : err);
    }
  };
  console.log(`Watching wards: a check every ${CHECK_EVERY_MS / 60_000} min, brief at ${BRIEF_HOUR_IST}:00 IST. Ctrl+C to stop.`);
  await tick();
  setInterval(tick, CHECK_EVERY_MS);
}

main().catch((err) => {
  console.error("✗ Ward check failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
