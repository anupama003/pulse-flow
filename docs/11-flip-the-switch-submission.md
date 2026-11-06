# Flip the Switch: submission kit

Deadline: **7 Nov 2026, 11:59 PM IST** ([event page](https://www.wemakedevs.org/hackathons/switch)). Fields marked ✏️ need something only you have.

## Track

**Track 01: Best Business Workflow**, plus the side tracks **Code with Wispr** (Wispr usage scorecard ✏️) and **Best Blog** ([docs/10-blog-flip-the-switch.md](10-blog-flip-the-switch.md)). The event allows one main track combined with both side tracks.

## Project title

**Pulse Flow: the hospital's chat rooms, with agents in them**

## One-liner

Four Switch agents join a hospital's Telegram groups and do the clerical work people do in WhatsApp today (writing up handovers and rounds, chasing late tasks, registering walk-ins, running pharmacy orders), while doctors keep every clinical decision.

## About the project

> Indian hospitals already run on chat: handovers in the ward WhatsApp group at 3 AM, consultants' rounds feedback that a resident has to write up, walk-ins messaged to the duty doctor, "is the Rx signed?" to the pharmacy. It's fast, but it doesn't understand medicine. A "stable" patient with a BP of 80/50 gets buried in message 34, a STAT ABG quietly slips past 6 AM, and nobody can say later who approved what.
>
> Pulse Flow puts four agents into those Telegram groups through Switch. The **ward scribe** turns a dictated handover (Wispr Flow) into one SBAR draft per bed, flags patients the vitals say are critical even when the doctor said "stable", and turns a consultant's bedside feedback into an updated care plan. Nothing goes live until a doctor replies "approve" (rounds: only the consultant). The **ward coordinator** does what a charge nurse does: every 15 minutes it chases the PG on duty by name about late tasks and waiting notes, and escalates to the patient's consultant when nobody acts. The **OPD desk** registers walk-ins from one message and escalates emergencies even if nobody typed "emergency". The **fulfilment** agent moves pharmacy and lab orders as staff report them. Pulse Flow itself posts critical patients, emergencies, signed prescriptions and an 8 AM ward brief into the right group.
>
> Agents do the work; people keep the decisions. Every agent acts *for* the person who asked, under that person's role: a receptionist can't approve a clinical note through an agent, and the refusal is logged. Agents get narrow MCP tools, not database access, and every action lands in a DPDP audit trail. Prescriptions are still signed only by a consultant with their HPR ID.

## How Switch is used (judging: "Use of Switch")

- **Template-deployed workflow:** [`switch/pulse-flow-telegram.template.yaml`](../switch/pulse-flow-telegram.template.yaml) creates 4 Claude Code agents and joins each to the Telegram groups its job needs; the Slack/Discord/Mattermost version ([`pulse-flow-hospital.template.yaml`](../switch/pulse-flow-hospital.template.yaml)) also creates 4 rooms, links and a pinned room doc. Both come from one source (`npm run switch:templates`, test-enforced).
- **Agents as teammates with roles:** per-agent instructions and least-privilege toolsets; the ward scribe and coordinator work across the ward and escalations rooms.
- **Agents waking agents:** Pulse Flow's registered events agent (`POST /agents`, then `POST /agents/{id}/message`) addresses the coordinator by name with what's late; the coordinator chases people and escalates on its own.
- **Human approval in the room:** nothing clinical becomes live until a doctor approves it in chat; role checks are enforced server-side, not by the prompt.
- **Built during the event:** the Switch setup, templates, agent tool server, events agent, coordinator, agent rules and tests (`switch/`, `lib/agents/`, `lib/ward/`, `server/services/Switch.ts`). The Pulse Flow web app predates the event, which the rules allow.

## Links ✏️

- Repo: `https://github.com/anupama003/pulse-flow` (push this branch first; the GitHub `main` currently has only the initial commit)
- Demo video: ✏️
- Blog: ✏️ (publish [docs/10](10-blog-flip-the-switch.md) on Hashnode / dev.to / Medium)
- Wispr scorecard: ✏️ Wispr Flow desktop → Insights → share card

## Demo video script (≈3 minutes, Telegram, 3 people)

Cast and setup: [switch/TELEGRAM.md](../switch/TELEGRAM.md). You = **Dr. Suresh Menon** (consultant), member 2 = **Dr. Rahul Verma** (night PG), member 3 = **Anjali Desai** (front desk). Record the host's Telegram Desktop next to the Pulse Flow web app; cut to the phones for Rahul's and Anjali's messages.

| Time | Screen | Say / do |
|---|---|---|
| 0:00–0:15 | A long ward WhatsApp thread | "This is how handovers happen in most Indian hospitals. Bed 21's BP of 80 by 50 is in here somewhere." |
| 0:15–0:30 | Switch Console: the 4 agents and their Telegram groups | "Pulse Flow is four Switch agents in the Telegram groups the team already uses. They do the clerical work; doctors keep the decisions." |
| 0:30–1:05 | **Lotus Ward**, Rahul's phone: holds Wispr, dictates the bed 21 + bed 7 handover | Two SBAR drafts; bed 21 is 🔴 "the vitals rule overrode 'stable'". Cut to **Lotus Escalations**: the alert is already there. |
| 1:05–1:25 | **Lotus Ward**: Anjali "approve all" → refused. You: "approve all" → ward screen updates | "Agents act for people. The front desk can't approve a clinical note; the consultant can, under his name." |
| 1:25–1:50 | Terminal: `npm run switch:nudge -- --at 06:45` → **Lotus Ward** | The coordinator asks "Dr. Rahul" by name: ICU-2's STAT ABG is 45 min late. Rahul: "ICU-2 ABG and lactate done" → ✅. Run it again: the draft nobody approved is escalated to you in Escalations. "Nobody asked it to chase. That's the charge nurse's job, done by an agent." |
| 1:50–2:15 | **Lotus Ward**, you: ICU-2 rounds feedback ("…drop the ICU registrar call, wean norad by noon, start feeds") | A rounds draft only the consultant can approve; approve it and the plan updates on the ward screen. |
| 2:15–2:35 | **Lotus OPD Desk**, Anjali: chest-pain walk-in | Token issued; 🚨 in Escalations though nobody said "emergency". |
| 2:35–2:50 | Web `/opd` sign → **Lotus Pharmacy & Lab** 🧾 → "DER-001 ready" | "Pharmacy runs from the same chat." |
| 2:50–3:00 | `/audit` → Switch rooms | "Every agent action, under the person it acted for. That's what the WhatsApp group never had." |

Before each take: `npm run db:reset`. After the first alert, check **Audit → Switch rooms** shows `sent`, not `simulated`.

## #HowISwitch post (≤280 chars)

> Hospitals hand over sick patients in WhatsApp groups. We put agents in the Telegram group instead: a scribe that writes SBAR notes a doctor approves in chat, a coordinator that chases late tasks, an OPD desk that escalates emergencies. On @switch_ai_ #FlipTheSwitch #HowISwitch
