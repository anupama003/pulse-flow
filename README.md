<p align="center"><img src="public/pulse-flow-logo.svg" width="96" alt="Pulse Flow logo" /></p>

# Pulse Flow

**Voice-first care, from handover to pharmacy.** Doctors, front-desk staff and patients speak. Pulse Flow structures what they say, a human approves it, and it flows to the ward, the OPD queue, pharmacy, lab and the patient's WhatsApp.

*(Formerly SBAR Sync. SBAR is still the clinical handover framework we structure notes into.)*

## Quick start

```bash
cp .env.example .env      # add GEMINI_API_KEY (or ANTHROPIC_API_KEY + LLM_PROVIDER=anthropic)
npm run setup             # install + Postgres (Docker) + schema + demo data
npm run dev               # → http://localhost:3000
```

| URL | What |
|---|---|
| `/` | IPD ward: shift brain dump, approvals, live rounds |
| `/opd` | OPD console: call next, dictate the e-Rx, sign with HPR ID |
| `/front-desk` | Walk-in registration by voice, check-in |
| `/pharmacy` · `/lab` | Fulfilment queues fed by signed prescriptions |
| `/audit` | DPDP access log + WhatsApp outbox |
| `/queue?f=lotus-ridge` | Waiting-room TV |
| `/book?f=lotus-ridge` | Public voice booking + ABHA (sandbox) |

Switch between the 12 demo staff with the name pill at the top right.

**Run, scripts, personas and the full UI test checklist: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md).**
**Step-by-step test flows (A–K): [docs/08-test-flows.md](docs/08-test-flows.md).**

## Scripts at a glance

`npm run dev` · `build` · `start` · `setup` · `db:up` · `db:down` · `db:reset` · `db:seed` · `db:studio` · `typecheck` · `test` · `test:rules` (28 unit tests) · `test:db` (6 integration tests)

## Docs

| | |
|---|---|
| Launch post | [docs/01-substack-launch-post.md](docs/01-substack-launch-post.md) |
| IPD architecture (handovers) | [docs/02-architecture.md](docs/02-architecture.md) |
| Platform architecture: tenancy, RBAC, DPDP audit, WhatsApp, ABDM | [docs/07-platform-architecture.md](docs/07-platform-architecture.md) |
| Clinical validation & edge cases | [docs/03-clinical-validation.md](docs/03-clinical-validation.md) |
| 24-hour IPD journey | [docs/04-user-journey.md](docs/04-user-journey.md) |
| Dictation test scripts | [docs/05-wispr-test-scripts.md](docs/05-wispr-test-scripts.md) · [docs/06-opd-test-scripts.md](docs/06-opd-test-scripts.md) |

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · Tailwind v4 · Framer Motion · Prisma 6 / PostgreSQL · Gemini (`gemini-3.8-flash` / `gemini-3.5-flash-lite`) or Claude (`claude-opus-5-5`), switchable in `.env` · pdf-lib.

> Prototype only, not a medical device. All people, facilities and identifiers are fictional. ABHA/ABDM is simulated and WhatsApp runs in dry-run mode until credentials are set. AI output is a draft that a clinician must approve and sign.
