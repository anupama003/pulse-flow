# Practice take: every role, every feature, in order

Run this once end to end before recording. Tick each line. If a line fails, note it and carry on; fix afterwards. The exact chat lines are in [DEMO-LINES.md](./DEMO-LINES.md).

| Who | Plays | Where |
|---|---|---|
| Host | Dr. Suresh Menon, consultant | laptop: web app and all four Telegram groups |
| Member 2 | Dr. Rahul Verma, night PG | Lotus Ward, Lotus Escalations |
| Member 3 | Anjali Desai, front desk (and pharmacy updates) | Lotus OPD Desk, Lotus Pharmacy & Lab |

## 0. Setup (host, 5 minutes)

- [ ] `PULSE_FLOW_CHAT_HANDLES` in `.env` maps each Telegram handle: host → `u-menon`, member 2 → `u-rahul`, member 3 → `u-anjali` and `u-anjali`'s handle again → `u-farhan@fulfilment`.
- [ ] `npm run db:reset`; the app keeps running, refresh the browser.
- [ ] `!reset-all-agents` in all four groups; wait for each reply.
- [ ] Everyone has posted once in each group they'll use.
- [ ] The web app header says **Switch on**.

## Part A: the Telegram story (record this)

**A1. Handover** (Lotus Ward)
- [ ] Dr. Rahul: the handover line, dictated with Wispr Flow or pasted.
- [ ] Scribe: one draft per bed, bed 21 critical with the reason.
- [ ] Lotus Escalations: the critical-patient alert for bed 21.
- [ ] Dr. Menon: `@lotus-ward-scribe Approve 21 and 7` → approved under his name.
- [ ] Web, Ward → Tasks: the new tasks from beds 21 and 7.

**A2. Rounds** (Lotus Ward)
- [ ] Dr. Menon: the ICU-2 rounds line.
- [ ] Scribe: the new plan (wean norad by noon, start RT feeds, registrar call stopped).
- [ ] Dr. Rahul: `@lotus-ward-scribe Approve ICU-2` → refused.
- [ ] Dr. Menon: `@lotus-ward-scribe Approve ICU-2` → approved.
- [ ] Web, Ward → Tasks: "call ICU registrar" is gone; the new tasks are there.

**A3. Walk-in** (Lotus OPD Desk)
- [ ] Anjali: the Ramesh Patil line in Hinglish.
- [ ] OPD desk: token GEN-005, Room 1, "send him straight in".
- [ ] Lotus Escalations: emergency alert from Pulse Flow.
- [ ] Web, sidebar → **Front desk**: Ramesh Patil in today's tokens, flagged as a priority.

**A4. Prescription to pharmacy**
- [ ] Web, sidebar → **OPD console** (as Dr. Menon): Ramesh Kumar, GEN-002, in consultation.
- [ ] Paste the prescription → **Structure Rx** → **Sign**.
- [ ] Lotus Pharmacy & Lab: "Rx signed by Dr. Suresh Menon: GEN-002…".
- [ ] Anjali: `GEN-002 preparing`, then `GEN-002 ready, send the patient to counter 2`.
- [ ] Web, sidebar → **Pharmacy**: GEN-002 under "Ready for pickup".

**A5. The record**
- [ ] Web, sidebar → **Audit log** → **Switch rooms**: every alert marked "sent", and each agent action under the person it was for.

## Part B: web app features (quick checks, no Telegram)

- [ ] **Ward, Handover tab:** paste a short handover → **Make notes** → drafts appear with any critical flag.
- [ ] **Ward, To approve:** check a draft against what was dictated, fill anything marked Pending, approve.
- [ ] **Ward, Patients:** tap ICU-2 → live rounds → dictate a rounds note → draft for the consultant.
- [ ] **Ward, Tasks:** tick a task; your name appears on it.
- [ ] **Front desk:** say or paste "Sunita Kale, 38, female, 9822012345, headache since 2 days" → **Fill the form** → register.
- [ ] **Pharmacy:** move an order Queued → Preparing → Ready → Dispensed.
- [ ] **Diagnostics:** move a test Ordered → Sample collected → Processing → Report ready.
- [ ] **Queue TV:** opens in a new tab with the waiting tokens.
- [ ] **Patient booking:** describe the problem by voice, get a doctor and a token.
- [ ] **Audit log → Access log:** every view and change from this run, with who and why.

## Part C: without Switch (optional, 2 minutes)

- [ ] Comment out `SWITCH_URL` in `.env`, stop the app (Ctrl+C) and run `npm run dev` again.
- [ ] The header says **Switch off**; the ward screen says nobody is messaged.
- [ ] A handover with a critical patient in the web app → "Not sent: Switch is off."
- [ ] Put `SWITCH_URL` back and restart before recording.

## Before the real recording

- [ ] `npm run db:reset`, refresh the browser, `!reset-all-agents` in all four groups.
