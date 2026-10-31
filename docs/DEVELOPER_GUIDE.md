# Pulse Flow: developer guide

How to run Pulse Flow locally, what every script does, and a click-by-click checklist for testing the UI.

## 1. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 20+ (tested on 25) | `node -v` |
| Docker Desktop | any recent version (for Postgres) | `docker info` |
| Gemini API key (default) **or** Anthropic API key | Optional for browsing. Required for voice → AI parsing | aistudio.google.com/apikey · console.anthropic.com |

## 2. First run (about 2 minutes)

From the project folder (`~/workspace/flow`):

```bash
cp .env.example .env              # then paste your GEMINI_API_KEY into .env
npm run setup                     # npm install + start Postgres (Docker) + create tables + seed demo data (non-destructive)
npm run dev                       # http://localhost:3000
```

> Use `.env`, not `.env.local`. Both Next.js **and** the Prisma CLI/seed read `.env`.

Without an API key, every screen still loads and works on the seeded data. The AI features (brain dump, rounds, symptom intake, walk-in parsing, e-Rx dictation) show a clear "AI isn't configured" message, and the booking page offers a manual form instead.

## 3. Scripts

Run `npm run` to list them all.

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server on :3000 |
| `npm run build` / `npm start` | Production build (also runs `prisma generate`) and serve |
| `npm run setup` | One-shot: install, `db:up`, `db:push`, `db:seed`. Never drops tables |
| `npm run db:up` / `db:down` | Start / stop the Postgres container (`docker-compose.yml`, database `pulse_flow`) |
| `npm run db:push` | Sync `prisma/schema.prisma` to the database |
| `npm run db:seed` | Load demo data (`lib/fixtures.ts`). Safe to re-run |
| `npm run db:reset` | **Destructive**: drops all tables, pushes the schema, seeds. Dev databases only. Prisma asks AI agents for explicit consent before running it |
| `npm run db:studio` | Prisma Studio: browse tables in the browser |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:rules` | 28 unit tests: clinical rules, red flags, Rx safety, WhatsApp payloads, RBAC. No DB or API key needed |
| `npm run test:db` | 6 integration tests against the seeded DB: concurrent tokens, tenant isolation, audit, ABHA, WhatsApp outbox |
| `npm test` | Type-check + unit tests |

## 4. Project map

```
app/                 routes (App Router)
  page.tsx           /            IPD ward (handovers, approvals, rounds)
  opd/ front-desk/ pharmacy/ lab/ audit/ queue/ book/
  actions/           server actions: ward · booking · opd · session
  api/queue          waiting-room TV feed (public, masked names)
  api/rx/[id]/pdf    prescription PDF (staff session or signed link)
components/          UI (AppShell, brand/PulseFlowLogo, booking/, opd/, ward widgets)
lib/                 db (tenant + audit extension) · session/RBAC · sbar/ (handover AI + rules) · opd/ (intake, Rx, tokens) · fixtures
server/services/     WhatsApp.ts (Meta / Twilio payloads + outbox)
prisma/              schema.prisma · seed.ts
scripts/             unit + integration tests
public/              pulse-flow-logo.svg (animated logo)
docs/                blog post, architecture, validation, journeys, dictation scripts
```

## 5. Demo personas

Switch with the **name pill** at the top right. Each role lands on its own module.

| Persona | Role | Lands on | Try |
|---|---|---|---|
| Dr. Rahul Verma | Night PG | `/` Ward | Brain dump, approve drafts |
| Dr. Priya Raghavan | Day PG | `/` Ward | Approve Aarav's draft, tick tasks |
| Dr. Suresh Menon | Consultant (Gen Med) | `/` Ward | Live rounds sign-off, `/opd` |
| Dr. Arvind Rao | Consultant (Gastro) | `/` → `/opd` | Mohammed Arif is in the room (penicillin allergy) |
| Dr. Leela Thomas | Consultant, **no HPR ID** | `/opd` | Can draft, can't sign |
| Anjali Desai | Front desk | `/front-desk` | Walk-ins, check-in |
| Farhan Sheikh | Pharmacist | `/pharmacy` | Move orders through the queue |
| Kavya Rao | Lab tech | `/lab` | Urgent tests first |
| Deepak Kulkarni | Admin / DPDP officer | `/audit` | Access log, WhatsApp outbox |
| Dr. Imran Qureshi, Pooja Nair | Baner **clinic** | `/opd`, `/front-desk` | Sees only clinic data (tenant isolation) |

## 6. UI test checklist

> For full end-to-end scenarios with expected results (handover → approval → rounds, booking + ABHA, walk-in, e-Rx → pharmacy/lab, queue TV, audit & isolation, layout checks), follow **[08-test-flows.md](08-test-flows.md)**.

Run `npm run db:seed` first so the data matches. It re-seeds in place, or use `db:reset` for a clean slate. Dictation scripts to read aloud are in [05](05-wispr-test-scripts.md) (IPD) and [06](06-opd-test-scripts.md) (OPD).

**Brand (every route)**
- [ ] New tab → 5-second animated intro, then the dashboard. Replay with `?splash=1` on any staff URL. **Skip intro**, Esc or a click skips it. It shows once per tab and never on `/book` or `/queue`. With *Reduce motion* on, it's a calm 1.5 s fade.
- [ ] Browser tab reads "Ward · Pulse Flow", "OPD console · Pulse Flow" and so on. The favicon is the animated pulse mark.
- [ ] Sidebar shows the animated logo: a pastel tracer runs along the heartbeat line. The top bar shows the **Pulse Flow** wordmark on wide screens. Each page has a footer reading "Pulse Flow · voice-first care…".
- [ ] With macOS *Reduce motion* on, the logo is static.

**IPD ward `/`** (Rahul / Priya / Menon)
- [ ] First visit opens the 7-step tour. The **?** button in the sidebar replays it.
- [ ] *Awaiting approval* shows Aarav's draft: a lavender correction tile, two dashed **Pending** sections, and an **Approve** button.
- [ ] Fill a Pending section and click Approve with edits. The card leaves the queue and 2 tasks appear in the checklist.
- [ ] Tick a checklist task. It strikes through and shows "✓ your name".
- [ ] Vikram (ICU-2) has a pulsing blush border, and the **Critical** filter shows only him.
- [ ] *With API key:* read script 1 or 2 into **Speak your handover** and approve the drafts.

**OPD `/opd`** (Dr. Arvind Rao)
- [ ] Mohammed Arif (GAS-003) shows an ABHA pill, **Allergy: Penicillin** and his voice-booked complaint.
- [ ] *With API key:* read script 5 and check the draft: 5 medicines, quantities, tests and advice, with Augmentin shown as a retracted correction.
- [ ] If a penicillin drug is still listed, the blush allergy box appears and signing is locked. Remove the drug to unlock it.
- [ ] Sign. A mint banner appears, **View PDF** opens the prescription, and **Call next** brings in GAS-005 (priority) before GAS-004.
- [ ] As Dr. Leela Thomas the button reads "Consultant signature needed". As a PG you can draft but not sign.

**Front desk `/front-desk`** (Anjali)
- [ ] Today's tokens are listed with status pills. *Check in* moves a booked patient to Waiting, and the no-show icon works.
- [ ] *With API key:* dictate "Ramesh Kumar, 45, male, 98220 11223, fever since 3 days". The form fills in; **Register & issue token** shows the token and a stopwatch.
- [ ] Without a key: after the error, **Fill the form by hand instead** still issues a token.

**Booking `/book?f=lotus-ridge`** (on a phone or the mobile viewport)
- [ ] The big mic works in Chrome or Safari. Tap an example chip, then **Find my doctor**.
- [ ] Emergency text ("chest pain", "vomiting blood") shows the blush **Call 108** screen.
- [ ] ABHA: mobile `9876500001` → Get OTP (the sandbox OTP is shown) → Verify → two family accounts appear → link one or create a new one.
- [ ] Tick consent and **Confirm**. A token card (e.g. PED-001) shows "WhatsApp message prepared (demo mode)".

**Queue TV `/queue?f=lotus-ridge`**
- [ ] One card per room, names masked ("Rohan M."), priority badge, and the clock ticks.
- [ ] Call a patient in `/opd` in another tab. Within 5 s the TV updates, the card pulses, and with *Announcements on* the token is spoken.

**Pharmacy `/pharmacy`** (Farhan) and **Lab `/lab`** (Kavya)
- [ ] Orders appear in every state. Start preparing → Mark ready → Dispensed. Allergy pills are visible and **Rx PDF** opens.
- [ ] Lab: the URGENT urine test is at the top in blush. Sample collected → Processing → Report ready.
- [ ] A pharmacist opening `/` is redirected to `/pharmacy`. The refusal is logged.

**Audit `/audit`** (Deepak)
- [ ] READ, CREATE, SIGN, SEND, DENIED rows each show the actor, purpose and patient. Filter by patient and by action.
- [ ] The *WhatsApp outbox* tab shows the template payloads with status *simulated*.

**Tenant isolation**
- [ ] Switch to Pooja Nair (Baner clinic). The front desk shows only clinic tokens, and the hospital patients don't exist for her.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `Can't reach database server` | `npm run db:up`, then check `DATABASE_URL` in `.env` |
| Empty dashboards or "No users in the database" | `npm run db:reset` |
| "AI isn't configured on this server" | Add `GEMINI_API_KEY` (or `ANTHROPIC_API_KEY` with `LLM_PROVIDER=anthropic`) to `.env` and restart `npm run dev` |
| "Gemini model … isn't available to this key" | Set `GEMINI_MODEL` / `GEMINI_FAST_MODEL` in `.env` to models your key can use (see ai.google.dev/gemini-api/docs/models) |
| "AI is busy or over quota" | Free-tier Gemini keys are rate-limited. Wait a minute, or use a paid key |
| Port 5432 already in use | Stop the other Postgres, or change the port in `docker-compose.yml` and `DATABASE_URL` |
| Mic button greyed out on `/book` | The browser lacks Web Speech (e.g. Firefox). Use the keyboard's own mic, or Chrome/Safari |
| Pages return 500 right after `npm run build` | `build` overwrote `.next` under a running `npm run dev`. Stop dev, run `rm -rf .next`, then `npm run dev` again |
| Holding the Wispr key puts nothing in the dictation box | 1) Make sure the **browser window is the active app** (click once anywhere on the page): Wispr types into the focused app. 2) The ward, OPD and front-desk boxes focus themselves after the splash/tour; the indicator should read *Hold Wispr key*. If it reads *Tap box to dictate*, click the box. 3) In Wispr Flow settings, check it's allowed for your browser and that macOS **Accessibility** and **Microphone** permissions are on (System Settings → Privacy & Security). 4) Try Wispr in a plain app (Notes): if it fails there too, it's a Wispr/macOS permission issue, not Pulse Flow |
| Dictation lands only 2–3 words at a time, or vanishes | Fixed: the dictation box was a React-controlled textarea, so every re-render (glow, word count, auto-refresh) overwrote text that Wispr had inserted without an input event. `DictationBox` is now uncontrolled (the browser owns the text, React reads it). If you see this again, check that nobody changed the textarea back to `value={…}` |
| Pill doesn't say *Listening…* while I hold the Wispr key | The pill is only a hint, not a switch: Wispr records at the macOS level and the page can't see it directly. It shows *Listening…* when the browser sees a modifier key (Fn, Ctrl, ⌥, ⌘) held on its own, but macOS often keeps Fn/Globe to itself, so it may stay on *Ready*. Dictation still works: **release the key**, because Wispr types the text only *after* you let go (*Transcribing…* → *Receiving text…*). Watch Wispr's own on-screen bubble to confirm it's recording |
| Live rounds (consultant) box gets one sentence, then nothing | Fixed: once focus left the rounds box, Wispr's next paste was caught by the ward's handover box hidden *behind* the modal. Only the topmost box (inside an open `aria-modal` dialog, if any) now takes focus or catches dictation, and a click on plain parts of the page puts focus back in it |
| Dictated text shows in a form field (booking, Rx editor, front desk, Pending boxes) but buttons stay disabled, or it vanishes | Fixed app-wide by `components/DictationBridge.tsx` (mounted in `app/layout.tsx`): when the focused field's text differs from what React last saw (Wispr's accessibility insertion fires no input event), it fires the missing input event. Keep it mounted; don't add `readOnly` fields expecting dictation |
| Leftover OPD dictation could be structured into the next patient's Rx | Fixed: OPD dictation is stored per appointment, and `dictateRx` refuses appointments that aren't `IN_CONSULT` with this consultant |
| "Something went wrong" / "Google's AI service is overloaded" on Structure | Gemini returned 503 *high demand* (check the dev-server log). `lib/llm.ts` now retries once on the other Gemini model (`GEMINI_MODEL` ↔ `GEMINI_FAST_MODEL`) and, if both are busy, shows a clear message within ~40 s instead of a generic error after ~45 s. The dictation stays in the box: just press the button again |
| Dictated text shows but the button stays disabled | Fixed: the box now also picks up text inserted without an input event (accessibility insertion). Refresh the page if you're on an older build |
| `LINK_SIGNING_SECRET must be set in production` | Set it in `.env` before `npm start`. Dev mode uses a fallback |
