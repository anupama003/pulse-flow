<p align="center"><img src="public/pulse-flow-logo.svg" width="96" alt="Pulse Flow logo" /></p>

# Pulse Flow

**The hospital's chat group, with agents in it that keep patients from falling through the cracks.**

Doctors keep talking in the chat app they already use. Pulse Flow's agents turn what they say into approved patient records, flag the patients who need a doctor now, and leave an audit trail. Built on [Switch](https://www.switchagents.ai) for the WeMakeDevs *Flip the Switch* hackathon.

| | |
|---|---|
| **Live demo** | [pulse-flow-fs0r.onrender.com](https://pulse-flow-fs0r.onrender.com) |
| **Code** | [github.com/anupama003/pulse-flow](https://github.com/anupama003/pulse-flow) |
| **Blog post** | [Pulse Flow on DEV](https://dev.to/anupama003/pulse-flow-ai-agents-inside-a-hospitals-telegram-groups-built-on-switch-2311) |

## The problem

Hospitals in India coordinate in WhatsApp and Telegram groups. At 3 AM the night resident hands over twelve patients as a long voice note or a wall of text. Somewhere in it is "bed 21 stable, BP 80/50 at 2". The day team reads "stable" and moves on.

Nobody did anything wrong; the channel did:

- **It doesn't understand medicine.** A critical blood pressure looks the same as a lunch order.
- **Nothing is tied to a patient.** The handover lives in message 34, not in the chart.
- **There's no record.** Who approved what, and when, is lost in scrollback. That matters under India's DPDP Act.

Handovers are where communication failures cluster: they're involved in over half of the communication failures behind serious hospital incidents ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC9923540)). More on the problem and the build: [the blog post](docs/12-blog-medium.md).

## The idea: don't make doctors leave the chat; put the agents in it

[Switch](https://docs.switchagents.ai/switch-rooms/getting-started) turns each group in a team's chat app (Telegram, Slack, Discord, Mattermost, Teams) into a **room** where people and AI agents work together. Pulse Flow puts three agents into four hospital groups:

| Group | Agent | What it does |
|---|---|---|
| **Ward** + **Escalations** | `ward-scribe` | Turns a dictated handover into one structured note per bed (SBAR: Situation, Background, Assessment, Recommendation), flags critical patients, and files a doctor's approval. The consultant's rounds become a care-plan draft only the consultant can approve. |
| **OPD Desk** + **Escalations** | `opd-desk` | Registers walk-ins by chat, gives a token, and escalates red flags like chest pain. |
| **Pharmacy & Lab** | `fulfilment` | Moves medicine and lab orders along ("GEN-002 ready") as the pharmacist who said it. |
| **Escalations** · **Pharmacy & Lab** | `pulse-flow-events` | Not an AI: Pulse Flow itself, posting 🔴 critical patients and 🚨 emergencies to Escalations and 🧾 signed prescriptions to Pharmacy & Lab as they happen. |

## What it looks like on Telegram

The agents' replies are shortened.

```
Lotus Ward
  Dr. Rahul (night PG):  @lotus-ward-scribe Handover to the day team. Bed 21 Fatima Khan, pyelo with AKI …
                         Patient is stable, but BP at 2 AM was 80 by 50, pulse 104 … Bed 7 Meera Iyer …
  ward-scribe:           Bed 21 · Fatima Khan: 🔴 Critical on vitals: BP 80/50, pulse 104.
                         ⚠️ Called stable against those vitals — confirm.
                         Bed 7 · Meera Iyer: …   Reply "approve 21", "approve all" or "discard 21".
  Dr. Menon:             @lotus-ward-scribe Approve 21 and 7
  ward-scribe:           Both approved, under Dr. Suresh Menon's name.

  Dr. Menon:             @lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05 …
  Dr. Rahul:             @lotus-ward-scribe Approve ICU-2
  ward-scribe:           ICU-2 · Vikram Singh — not approved. … rounds orders need the consultant's sign-off.
  Dr. Menon:             @lotus-ward-scribe Approve ICU-2
  ward-scribe:           ✅ ICU-2 · Vikram Singh — rounds note approved by Dr. Suresh Menon.

Lotus OPD Desk
  Anjali (front desk):   @lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai …
  opd-desk:              🔴 GEN-005 Ramesh Patil, General Medicine, Room 1, Dr. Suresh Menon.
                         Chest pain flagged — send him straight in, don't make him wait.

Lotus Pharmacy & Lab
  Pulse Flow:            Rx signed by Dr. Suresh Menon: GEN-002 · Ramesh Kumar …
  Anjali:                @lotus-fulfilment GEN-002 ready, send the patient to counter 2
  fulfilment:            ✅ GEN-002 Ramesh Kumar — ready, collect at counter 2
```

Every one of those actions is now in the patient's record and in **Audit → Switch rooms**, under the person who asked.

## How it works

```
 Telegram / Slack / … groups ──── Switch (rooms, membership, who can address which agent)
            │ "@lotus-ward-scribe …"
            ▼
 Claude Code agents (run by Switch Console on the hospital's machine)
            │ MCP tools: submit_handover, approve_handover_note, submit_rounds, register_walk_in, …
            │ every call names the person who asked ("actor")
            ▼
 Pulse Flow (Next.js + PostgreSQL)
   1. resolve the person → their role decides what's allowed (RBAC, one hospital per agent)
   2. deterministic clinical rules re-check every vital, whatever the AI said
   3. write a DRAFT; nothing is live until a named doctor approves it
   4. audit-log the action under the person, with the agent as the route
            │
            ▼ room events (critical patient, emergency, Rx signed)
 back into the right group as pulse-flow-events
```

**Code owns the facts; agents own the conversation.** Pulse Flow computes what is critical and who may approve, the same way every time, with tests. The agents turn what people say into tool calls and tell them what happened.

### With Switch and without it

Take Switch out (stop Switch Console or remove the `SWITCH_*` lines from `.env`, then restart) and the app tells you so:

| | With Switch | Without Switch |
|---|---|---|
| Header badge | **Switch on** | **Switch off** |
| Critical patient in a handover | Posted to the escalations group on Telegram | "Not sent: Switch is off. Only people looking at this screen will know." |
| Approvals, walk-ins, pharmacy updates from chat | Done in Telegram, under the person who asked | Not possible: there are no agents |
| Audit → Switch rooms | "sent" | "not sent (Switch off)" |

The web app (dictation, drafts, approvals, queues) works either way. The alerts and escalations that reach people on their phones exist only with Switch.

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

A labelled sidebar reaches every page (Ward, OPD console, Front desk, Pharmacy, Diagnostics, Queue TV, Audit log, Patient booking). A page your current role can't open shows "as <colleague>" and opens as them in one click. Switch between the 12 demo staff with the name pill at the top right.

## Try it

**No install:** open the [live demo](https://pulse-flow-fs0r.onrender.com). It runs the full web app on the seeded Lotus Ridge hospital. Use the left sidebar to move between the ward, OPD console, front desk, pharmacy, diagnostics, Queue TV and audit log; a page your current role can't open says "as …" and opens as the right colleague. The header shows **Switch off** there, because the Telegram agents run on the Switch server on the author's laptop; the chat side is shown in the [blog post](https://dev.to/anupama003/pulse-flow-ai-agents-inside-a-hospitals-telegram-groups-built-on-switch-2311) and [switch/TELEGRAM.md](switch/TELEGRAM.md).

**Run it yourself:** you need Node 20.11+ and Docker.

```bash
git clone https://github.com/anupama003/pulse-flow.git && cd pulse-flow
npm run setup             # checks Docker, creates .env, installs, starts Postgres, loads a demo hospital
npm run dev               # → http://localhost:3000
```

No API key is needed to look around; dictation falls back to manual entry. For AI structuring in the web app, add `GEMINI_API_KEY` (free at [aistudio.google.com](https://aistudio.google.com/apikey)) or `ANTHROPIC_API_KEY` + `LLM_PROVIDER=anthropic` to `.env`. The Switch agents need no key of ours: they use your own Claude Code, and Pulse Flow's rules re-check the result.

**Check it works, without a Switch server or an AI key:**

```bash
npm test                  # typecheck + 48 unit tests: 30 clinical-rules/OPD, 18 Switch
npm run test:db           # 6 integration tests: tokens, tenancy, audit, ABHA, WhatsApp outbox
npm run test:agents       # 11 integration tests: agents acting for people, RBAC, rounds, the real MCP server
```

**Run the agents in chat:**

- Telegram, with a 3-person team, step by step: [switch/TELEGRAM.md](switch/TELEGRAM.md)
- What each person types during the demo: [switch/DEMO-LINES.md](switch/DEMO-LINES.md)
- Slack, Discord, Mattermost or Teams: [switch/README.md](switch/README.md)

## What's real and what's simulated

| Real | Simulated |
|---|---|
| Switch rooms on Telegram, three Claude Code agents, the MCP tool server (14 tools) | ABHA / ABDM (sandbox accounts) |
| Role checks, tenancy, clinical rules, drafts and approvals, the audit log | WhatsApp to patients (dry-run until credentials are set) |
| PostgreSQL data for one demo hospital (Lotus Ridge) | All people, patients and identifiers are fictional |

## Repo map

| Path | What |
|---|---|
| [`switch/`](switch/) | Switch templates, agent rules, setup scripts |
| [`lib/agents/`](lib/agents/) | The MCP tools the agents call, and how a chat name becomes a staff member |
| [`lib/ward/`](lib/ward/) · [`lib/opd/`](lib/opd/) | Handover, rounds, walk-ins: shared by the web app and the agents |
| [`lib/sbar/clinical-rules.ts`](lib/sbar/clinical-rules.ts) | The deterministic vitals rules |
| [`server/services/Switch.ts`](server/services/Switch.ts) | Room messages Pulse Flow posts, and how they're sent |
| [`app/`](app/) | The Next.js web app |
| [`prisma/`](prisma/) | Schema and the demo hospital seed |

## Docs

| | |
|---|---|
| Blog post: how Switch works, first-time setup, the build, the live run | [docs/12-blog-medium.md](docs/12-blog-medium.md) |
| Pulse Flow on Switch: agents, rooms, safety model | [switch/README.md](switch/README.md) |
| Running it on Telegram with three people | [switch/TELEGRAM.md](switch/TELEGRAM.md) · [what each person types](switch/DEMO-LINES.md) |
| Platform architecture: tenancy, RBAC, DPDP audit, ABDM | [docs/07-platform-architecture.md](docs/07-platform-architecture.md) |
| IPD architecture (handovers) | [docs/02-architecture.md](docs/02-architecture.md) |
| Clinical validation and edge cases | [docs/03-clinical-validation.md](docs/03-clinical-validation.md) |

**Scripts:** `dev` · `build` · `start` · `setup` · `db:up` · `db:down` · `db:reset` · `db:seed` · `db:studio` · `typecheck` · `test` · `test:rules` (30) · `test:switch` (18) · `test:db` (6) · `test:agents` (11) · `switch:setup` · `switch:register` · `switch:templates` · `switch:mcp`

**Stack:** Switch · MCP · Claude Code · Next.js 15 (App Router, Server Actions) · React 19 · Tailwind v4 · Prisma 6 / PostgreSQL · Gemini or Claude for web-app structuring, switchable in `.env` · pdf-lib.

> Prototype only, not a medical device. All people, facilities and identifiers are fictional. AI output is a draft that a clinician must approve and sign.
