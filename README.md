<p align="center"><img src="public/pulse-flow-logo.svg" width="96" alt="Pulse Flow logo" /></p>

# Pulse Flow

**Voice-first care, from handover to pharmacy.** Doctors, front-desk staff and patients speak. Pulse Flow structures what they say, a human approves it, and it flows to the ward, the OPD queue, pharmacy, lab and the patient's WhatsApp.

*(Formerly SBAR Sync. SBAR is still the clinical handover framework we structure notes into.)*

## Flip the Switch: the hospital's chat rooms, with agents in them

Hospitals already coordinate in WhatsApp groups. Pulse Flow puts **four agents into the team's own chat app through [Switch](https://www.switchagents.ai)** (Telegram, Slack, Discord, Mattermost, Teams): a ward scribe that turns a dictated handover or a consultant's rounds feedback into SBAR drafts a doctor approves in the room, a ward coordinator that chases late tasks and escalates what stays stuck, an OPD desk that registers walk-ins and escalates emergencies, and a fulfilment runner for pharmacy and lab. Every agent acts *for* a named staff member under that person's role, and every action lands in the DPDP audit log. **Setup, safety model and a 3-minute script: [switch/README.md](switch/README.md). Telegram with a 3-person team: [switch/TELEGRAM.md](switch/TELEGRAM.md).**

## Judges: running it in 3 commands

You need Node 20.11+ and Docker running.

```bash
git clone https://github.com/anupama003/pulse-flow.git && cd pulse-flow
npm run setup             # checks Docker, creates .env, installs, starts Postgres, loads a demo hospital
npm run dev               # → http://localhost:3000
```

No API key is needed to look around: every screen works, and dictation falls back to manual entry. For AI structuring in the web app, add `GEMINI_API_KEY` (free at [aistudio.google.com](https://aistudio.google.com/apikey)) or `ANTHROPIC_API_KEY` + `LLM_PROVIDER=anthropic` to `.env`. **The Switch agents need no key of ours**: they structure handovers with your own Claude Code, and Pulse Flow's rules re-check the result.

Check everything works without a Switch server or an AI key:

```bash
npm test                  # typecheck + 55 unit tests (clinical rules, e-Rx, WhatsApp, Switch)
npm run test:db           # 6 integration tests: tokens, tenancy, audit, ABHA, WhatsApp outbox
npm run test:agents       # 13 integration tests: agents acting for people, RBAC, rounds, coordinator, real MCP server
```

| URL | What |
|---|---|
| `/` | IPD ward: shift brain dump, approvals, live rounds |
| `/opd` | OPD console: call next, dictate the e-Rx, sign with HPR ID |
| `/front-desk` | Walk-in registration by voice, check-in |
| `/pharmacy` · `/lab` | Fulfilment queues fed by signed prescriptions |
| `/audit` | DPDP access log, WhatsApp outbox, **Switch rooms** (agent actions + room alerts) |
| `/queue?f=lotus-ridge` | Waiting-room TV |
| `/book?f=lotus-ridge` | Public voice booking + ABHA (sandbox) |

Switch between the 12 demo staff with the name pill at the top right.

**Run, scripts, personas and the full UI test checklist: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md).**
**Step-by-step test flows (A–K): [docs/08-test-flows.md](docs/08-test-flows.md).**

## Scripts at a glance

`npm run dev` · `build` · `start` · `setup` · `db:up` · `db:down` · `db:reset` · `db:seed` · `db:studio` · `typecheck` · `test` · `test:rules` (30 unit tests) · `test:switch` (25) · `test:db` (6 integration tests) · `test:agents` (13) · `switch:setup` · `switch:register` · `switch:nudge` · `switch:templates` · `switch:mcp`

## Docs

| | |
|---|---|
| Launch post | [docs/01-substack-launch-post.md](docs/01-substack-launch-post.md) |
| IPD architecture (handovers) | [docs/02-architecture.md](docs/02-architecture.md) |
| Platform architecture: tenancy, RBAC, DPDP audit, WhatsApp, ABDM | [docs/07-platform-architecture.md](docs/07-platform-architecture.md) |
| Clinical validation & edge cases | [docs/03-clinical-validation.md](docs/03-clinical-validation.md) |
| 24-hour IPD journey | [docs/04-user-journey.md](docs/04-user-journey.md) |
| Pulse Flow on Switch: agents, rooms, safety model | [switch/README.md](switch/README.md) |
| Flip the Switch blog post | [docs/10-blog-flip-the-switch.md](docs/10-blog-flip-the-switch.md) |
| Demo video script + submission answers | [docs/11-flip-the-switch-submission.md](docs/11-flip-the-switch-submission.md) |
| Dictation test scripts | [docs/05-wispr-test-scripts.md](docs/05-wispr-test-scripts.md) · [docs/06-opd-test-scripts.md](docs/06-opd-test-scripts.md) |

**Stack:** Switch (agents in Slack/Discord/Telegram/Mattermost/Teams) · MCP · Next.js 15 (App Router, Server Actions) · React 19 · Tailwind v4 · Framer Motion · Prisma 6 / PostgreSQL · Gemini (`gemini-3.8-flash` / `gemini-3.5-flash-lite`) or Claude (`claude-opus-5-5`), switchable in `.env` · pdf-lib.

> Prototype only, not a medical device. All people, facilities and identifiers are fictional. ABHA/ABDM is simulated and WhatsApp runs in dry-run mode until credentials are set. AI output is a draft that a clinician must approve and sign.
