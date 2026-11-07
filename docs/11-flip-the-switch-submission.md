# Flip the Switch: submission kit

Deadline: **7 Nov 2026, 11:59 PM IST** ([event page](https://www.wemakedevs.org/hackathons/switch)). Fields marked ✏️ need something only you have.

## Track

**Track 01: Best Business Workflow**, plus the side tracks **Code with Wispr** (Wispr usage scorecard ✏️) and **Best Blog** ([docs/10-blog-flip-the-switch.md](10-blog-flip-the-switch.md)). The event allows one main track combined with both side tracks.

## Project title

**Pulse Flow: the hospital's chat rooms, with agents in them**

## One-liner

Three Switch agents join a hospital's Telegram groups and do the clerical work people do in chat groups today (writing up handovers and rounds, registering walk-ins, running pharmacy orders), while doctors keep every clinical decision.

## About the project

> Indian hospitals already run on chat: handovers in the ward WhatsApp group at 3 AM, consultants' rounds feedback that a resident has to write up, walk-ins messaged to the duty doctor, "is the Rx signed?" to the pharmacy. It's fast, but it doesn't understand medicine. A "stable" patient with a BP of 80/50 gets buried in message 34, and nobody can say later who approved what.
>
> Pulse Flow puts three agents into Telegram groups through Switch. The **ward scribe** turns a dictated handover (Wispr Flow) into one SBAR draft per bed, flags patients the vitals say are critical even when the doctor said "stable", and turns a consultant's bedside feedback into an updated care plan. Nothing goes live until a doctor replies "approve" (rounds: only the consultant). The **OPD desk** registers walk-ins from one message and escalates emergencies even if nobody typed "emergency". The **fulfilment** agent moves pharmacy and lab orders as staff report them. Pulse Flow itself posts critical patients and emergencies to the escalations group and signed prescriptions to the pharmacy group.
>
> Agents do the work; people keep the decisions. Every agent acts *for* the person who asked, under that person's role: a receptionist can't approve a clinical note through an agent, and the refusal is logged. Agents get narrow MCP tools, not database access, and every action lands in a DPDP audit trail. Prescriptions are still signed only by a consultant with their HPR ID.

## How Switch is used (judging: "Use of Switch")

- **Template-deployed workflow:** [`switch/pulse-flow-telegram.template.yaml`](../switch/pulse-flow-telegram.template.yaml) creates 3 Claude Code agents and joins each to the Telegram groups its job needs; the Slack/Discord/Mattermost version ([`pulse-flow-hospital.template.yaml`](../switch/pulse-flow-hospital.template.yaml)) also creates the 4 rooms, links and a pinned room doc. Both come from one source (`npm run switch:templates`, test-enforced).
- **Agents as teammates with roles:** per-agent instructions and least-privilege toolsets; the ward scribe and the OPD desk each work across their own room and the escalations room.
- **The app speaks in rooms too:** Pulse Flow's registered events agent (`POST /agents`, then `POST /agents/{id}/message`) posts critical patients and emergencies to escalations and signed prescriptions to pharmacy & lab, whether they came from the web app or another agent.
- **Human approval in the room:** nothing clinical becomes live until a doctor approves it in chat; role checks are enforced server-side, not by the prompt.
- **Built during the event:** the Switch setup, templates, agent tool server (14 tools), events agent, agent rules and tests (`switch/`, `lib/agents/`, `lib/ward/`, `server/services/Switch.ts`). The Pulse Flow web app predates the event, which the rules allow.

## Links ✏️

- Repo: `https://github.com/anupama003/pulse-flow` (push this branch first; the GitHub `main` currently has only the initial commit)
- Demo video: ✏️
- Blog: ✏️ (publish [docs/10](10-blog-flip-the-switch.md) on Hashnode / dev.to / Medium)
- Wispr scorecard: ✏️ Wispr Flow desktop → Insights → share card

## Demo video script (≈3 minutes, Telegram, 3 people)

Cast and setup: [switch/TELEGRAM.md](../switch/TELEGRAM.md). You = **Dr. Suresh Menon** (consultant), member 2 = **Dr. Rahul Verma** (night PG), member 3 = **Anjali Desai** (front desk; in Lotus Pharmacy & Lab her account also moves pharmacy orders). Lines for each person: [switch/DEMO-LINES.md](../switch/DEMO-LINES.md). Record the host's Telegram Desktop next to the Pulse Flow web app; cut to the phones for Rahul's and Anjali's messages.

| Time | Screen | Say / do |
|---|---|---|
| 0:00–0:15 | A long ward chat thread | "This is how handovers happen in most Indian hospitals. Bed 21's BP of 80 by 50 is in here somewhere." |
| 0:15–0:30 | Switch Console: the 3 agents and their Telegram groups | "Pulse Flow is three Switch agents in the Telegram groups the team already uses. They do the clerical work; doctors keep the decisions." |
| 0:30–1:00 | **Lotus Ward**, Rahul's phone: holds Wispr, dictates the bed 21 + bed 7 handover | One SBAR draft per bed; bed 21 is 🔴 "Critical on vitals: BP 80/50, pulse 104. ⚠️ Called stable against those vitals — confirm." Cut to **Lotus Escalations**: the alert is already there. |
| 1:00–1:15 | **Lotus Ward**, you: "@lotus-ward-scribe Approve 21 and 7" → ward screen updates | "The consultant approves in chat, under his name." |
| 1:15–1:50 | **Lotus Ward**, you: ICU-2 rounds ("…no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.") → Rahul: "Approve ICU-2" → refused → you: "Approve ICU-2" → ✅ | "Agents act for people. Only the consultant can approve his rounds, and Pulse Flow enforces it, not the prompt." |
| 1:50–2:15 | **Lotus OPD Desk**, Anjali: the Hinglish chest-pain walk-in | Token GEN-005, Room 1, Dr. Suresh Menon, "send him straight in"; 🚨 in Escalations though nobody said "emergency". |
| 2:15–2:45 | Web: sidebar → OPD console → Ramesh Kumar (GEN-002) → paste the Rx → Structure Rx → Sign → **Lotus Pharmacy & Lab** "Rx signed by Dr. Suresh Menon…" → Anjali: "GEN-002 preparing", "GEN-002 ready, send the patient to counter 2" | "Pharmacy runs from the same chat." |
| 2:45–3:00 | Sidebar → Audit log (as Deepak) → Switch rooms | "Every agent action, under the person it acted for. That's what the chat group never had." |

Before each take: `npm run db:reset`, `!reset-all-agents` in all four groups, and each person posts once in each group they'll use. After the first alert, check **Audit → Switch rooms** shows `sent`, not `simulated`.

## #HowISwitch post (≤280 chars)

> Hospitals hand over sick patients in chat groups. We put agents in the Telegram group: a scribe that writes SBAR notes a doctor approves in chat, an OPD desk that escalates emergencies, a pharmacy agent. On @switch_ai_ #FlipTheSwitch #HowISwitch
