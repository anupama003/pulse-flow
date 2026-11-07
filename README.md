<p align="center"><img src="public/pulse-flow-logo.svg" width="96" alt="Pulse Flow logo" /></p>

# Pulse Flow

**The hospital's chat group, with agents in it that keep patients from falling through the cracks.**

Doctors keep talking in the chat app they already use. Pulse Flow's agents turn what they say into approved patient records, chase what's late, and leave an audit trail. Built on [Switch](https://www.switchagents.ai) for the WeMakeDevs *Flip the Switch* hackathon.

## The problem

Hospitals in India coordinate in WhatsApp and Telegram groups. At 3 AM the night resident hands over twelve patients as a long voice note or a wall of text. Somewhere in it is "bed 21 stable, BP 80/50 at 2". The day team reads "stable" and moves on.

Nobody did anything wrong; the channel did:

- **It doesn't understand medicine.** A critical blood pressure looks the same as a lunch order.
- **Nothing is tied to a patient.** The handover lives in message 34, not in the chart.
- **Nobody follows up.** A 6 AM blood test that wasn't done just sits there.
- **There's no record.** Who approved what, and when, is lost in scrollback. That matters under India's DPDP Act.

Handovers are where communication failures cluster: they're involved in over half of the communication failures behind serious hospital incidents ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC9923540)). Sources and caveats: [the blog post](docs/10-blog-flip-the-switch.md).

## The idea: don't make doctors leave the chat; put the agents in it

[Switch](https://docs.switchagents.ai/switch-rooms/getting-started) turns each group in a team's chat app (Telegram, Slack, Discord, Mattermost, Teams) into a **room** where people and AI agents work together. Pulse Flow puts four agents into four hospital groups:

| Group | Agent | What it does |
|---|---|---|
| **Ward** | `ward-scribe` | Turns a dictated handover or the consultant's rounds into one structured note per bed (SBAR: Situation, Background, Assessment, Recommendation), flags critical patients, and files a doctor's approval. |
| **Ward** + **Escalations** | `ward-coordinator` | The charge nurse who chases. Reminds the resident on duty about a late task; tells the consultant if it's still not done at the next check. |
| **OPD Desk** | `opd-desk` | Registers walk-ins by chat, gives a token, and escalates red flags like chest pain. |
| **Pharmacy & Lab** | `fulfilment` | Moves medicine and lab orders along ("DER-001 ready") as the pharmacist who said it. |
| all four | `pulse-flow-events` | Not an AI: Pulse Flow itself, posting 🔴 critical patients, 🚨 emergencies and 🧾 signed prescriptions into the right group as they happen. |

## What it looks like on Telegram

The agents' replies are shortened.

```
Lotus Ward
  Dr. Rahul (night PG):  @lotus-ward-scribe Handover to Dr. Priya. Bed 21 Fatima Khan, pyelo with AKI …
                         Patient is stable, but BP at 2 AM was 80 by 50, pulse 104 … Bed 7 Meera Iyer …
  ward-scribe:           Bed 21 · Fatima Khan: CRITICAL, BP 80/50 (said "stable"; the vitals rule overrode it)
                         Bed 7 · Meera Iyer: …   Reply "approve 21", "approve all" or "discard 21".
  Dr. Priya (day PG):    @lotus-ward-scribe Approve 21 and 7
  ward-scribe:           Both approved, under Dr. Priya's name.

  Pulse Flow:            @lotus-ward-coordinator 07:00 check: 1 late task.
  ward-coordinator:      Dr. Rahul, ICU-2 Vikram Singh: STAT repeat ABG and lactate was due at 6 AM, now 1 hour late.
                         Reply "done ICU-2" once it's done.
                         (no reply: Rahul is in casualty)

Lotus Escalations  (08:00, still not done)
  ward-coordinator:      Dr. Menon, ICU-2 Vikram Singh: STAT repeat ABG and lactate, due 6 AM,
                         still not done an hour after the reminder.

Lotus Ward
  Dr. Priya:             @lotus-ward-coordinator ICU-2 ABG and lactate done, sample sent to lab
  ward-coordinator:      ICU-2 ABG and lactate, done by Dr. Priya.
```

Every one of those actions is now in the patient's record and in **Audit → Switch rooms**, under the person who asked.

## How it works

```
 Telegram / Slack / … groups ──── Switch (rooms, membership, who can address which agent)
            │ "@lotus-ward-scribe …"
            ▼
 Claude Code agents (run by Switch Console on the hospital's machine)
            │ MCP tools: submit_handover, approve_handover_note, ward_followups, complete_task, …
            │ every call names the person who asked ("actor")
            ▼
 Pulse Flow (Next.js + PostgreSQL)
   1. resolve the person → their role decides what's allowed (RBAC, one hospital per agent)
   2. deterministic clinical rules re-check every vital, whatever the AI said
   3. write a DRAFT; nothing is live until a named doctor approves it
   4. audit-log the action under the person, with the agent as the route
            │
            ▼ room events (critical patient, emergency, Rx signed, follow-up check)
 back into the right group as pulse-flow-events
```

**Code owns the facts; agents own the follow-through.** Pulse Flow computes what is late, what is critical and who may approve, the same way every time, with tests. The agents decide how to say it to a person and when to chase.

### With Switch and without it

Take Switch out (stop Switch Console or remove the `SWITCH_*` lines from `.env`, then restart) and the app tells you so:

| | With Switch | Without Switch |
|---|---|---|
| Header badge | **Switch on** | **Switch off** |
| Critical patient in a handover | Posted to the escalations group on Telegram | "Not sent: Switch is off. Only people looking at this screen will know." |
| `npm run switch:nudge -- --at 07:00` | The coordinator reminds the PG on duty; at the next check it tells the consultant | Lists the late task and says nobody was messaged |
| Approvals, walk-ins, pharmacy updates from chat | Done in Telegram, under the person who asked | Not possible: there are no agents |
| Audit → Switch rooms | "sent" | "not sent (Switch off)" |

The web app (dictation, drafts, approvals, queues) works either way. The alerts, follow-ups and escalations that reach people on their phones exist only with Switch.

### The safety model

1. **Agents act *for* people, never *as* themselves.** Every tool takes the chat name of the person who asked; that person's role decides. A receptionist can't approve a note through an agent any more than in the web app.
2. **AI drafts, clinicians decide.** Notes stay drafts until a doctor approves them. Prescriptions are only signed in the web app, with the consultant's HPR ID.
3. **Rules after the model.** If the doctor says "stable" but the systolic BP is under 90, SpO₂ under 92 % or K⁺ 6 or more, the patient is flagged critical anyway ([`lib/sbar/clinical-rules.ts`](lib/sbar/clinical-rules.ts)).
4. **Least privilege twice.** Each agent gets only its own tools, and every tool checks the person's role.
5. **Everything is audit-logged**, built for India's DPDP Act. Each agent is pinned to one hospital.

Full design: [switch/README.md](switch/README.md).

### Beyond the chat

The agents sit on a complete hospital web app that shares the same code paths:

| URL | What |
|---|---|
| `/` | IPD ward: shift handover by voice, approvals, live rounds |
| `/opd` | OPD console: call next patient, dictate the prescription, sign with HPR ID |
| `/front-desk` | Walk-in registration by voice |
| `/pharmacy` · `/lab` | Queues fed by signed prescriptions |
| `/audit` | DPDP access log, WhatsApp outbox, **Switch rooms** (every agent action) |
| `/queue?f=lotus-ridge` | Waiting-room TV |
| `/book?f=lotus-ridge` | Public voice booking with ABHA (sandbox) |

Switch between the 12 demo staff with the name pill at the top right.

## Try it

You need Node 20.11+ and Docker.

```bash
git clone https://github.com/anupama003/pulse-flow.git && cd pulse-flow
npm run setup             # checks Docker, creates .env, installs, starts Postgres, loads a demo hospital
npm run dev               # → http://localhost:3000
```

No API key is needed to look around; dictation falls back to manual entry. For AI structuring in the web app, add `GEMINI_API_KEY` (free at [aistudio.google.com](https://aistudio.google.com/apikey)) or `ANTHROPIC_API_KEY` + `LLM_PROVIDER=anthropic` to `.env`. The Switch agents need no key of ours: they use your own Claude Code, and Pulse Flow's rules re-check the result.

**Check it works, without a Switch server or an AI key:**

```bash
npm test                  # typecheck + 57 unit tests: clinical rules, e-Rx, WhatsApp, Switch messages
npm run test:db           # 6 integration tests: tokens, tenancy, audit, ABHA, WhatsApp outbox
npm run test:agents       # 13 integration tests: agents acting for people, RBAC, rounds, coordinator, the real MCP server
```

**Run the agents in chat:**

- Telegram, with a 3-person team, step by step: [switch/TELEGRAM.md](switch/TELEGRAM.md)
- What each person types during the demo: [switch/DEMO-LINES.md](switch/DEMO-LINES.md)
- Slack, Discord, Mattermost or Teams: [switch/README.md](switch/README.md)

## What's real and what's simulated

| Real | Simulated |
|---|---|
| Switch rooms on Telegram, four Claude Code agents, the MCP tool server | ABHA / ABDM (sandbox accounts) |
| Role checks, tenancy, clinical rules, drafts and approvals, the audit log | WhatsApp to patients (dry-run until credentials are set) |
| PostgreSQL data for one demo hospital (Lotus Ridge) | All people, patients and identifiers are fictional |

## Repo map

| Path | What |
|---|---|
| [`switch/`](switch/) | Switch templates, agent rules, setup scripts, the follow-up checker (`npm run switch:nudge`) |
| [`lib/agents/`](lib/agents/) | The MCP tools the agents call, and how a chat name becomes a staff member |
| [`lib/ward/`](lib/ward/) · [`lib/opd/`](lib/opd/) | Handover, rounds, follow-ups, walk-ins: shared by the web app and the agents |
| [`lib/sbar/clinical-rules.ts`](lib/sbar/clinical-rules.ts) | The deterministic vitals rules |
| [`server/services/Switch.ts`](server/services/Switch.ts) | Room messages Pulse Flow posts, and how they're sent |
| [`app/`](app/) | The Next.js web app |
| [`prisma/`](prisma/) | Schema and the demo hospital seed |

## Docs

| | |
|---|---|
| Medium / Substack post: how Switch works, first-time setup, the build | [docs/12-blog-medium.md](docs/12-blog-medium.md) |
| Flip the Switch blog post (problem, design, sources) | [docs/10-blog-flip-the-switch.md](docs/10-blog-flip-the-switch.md) |
| Demo video script and submission answers | [docs/11-flip-the-switch-submission.md](docs/11-flip-the-switch-submission.md) |
| Pulse Flow on Switch: agents, rooms, safety model | [switch/README.md](switch/README.md) |
| Platform architecture: tenancy, RBAC, DPDP audit, WhatsApp, ABDM | [docs/07-platform-architecture.md](docs/07-platform-architecture.md) |
| IPD architecture (handovers) | [docs/02-architecture.md](docs/02-architecture.md) |
| Clinical validation and edge cases | [docs/03-clinical-validation.md](docs/03-clinical-validation.md) |
| A 24-hour IPD journey | [docs/04-user-journey.md](docs/04-user-journey.md) |
| Developer guide: scripts, personas, UI test checklist | [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) |
| Test flows A–K | [docs/08-test-flows.md](docs/08-test-flows.md) |
| Dictation test scripts | [docs/05-wispr-test-scripts.md](docs/05-wispr-test-scripts.md) · [docs/06-opd-test-scripts.md](docs/06-opd-test-scripts.md) |

**Scripts:** `dev` · `build` · `start` · `setup` · `db:up` · `db:down` · `db:reset` · `db:seed` · `db:studio` · `typecheck` · `test` · `test:rules` (30) · `test:switch` (27) · `test:db` (6) · `test:agents` (13) · `switch:setup` · `switch:register` · `switch:nudge` · `switch:templates` · `switch:mcp`

**Stack:** Switch · MCP · Claude Code · Next.js 15 (App Router, Server Actions) · React 19 · Tailwind v4 · Prisma 6 / PostgreSQL · Gemini or Claude for web-app structuring, switchable in `.env` · pdf-lib.

> Prototype only, not a medical device. All people, facilities and identifiers are fictional. AI output is a draft that a clinician must approve and sign.
