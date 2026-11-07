# Practice take: every role, every feature, in order

Run this once end to end before recording. Tick each line. If a line fails, note it and carry on; fix afterwards.

App: **http://localhost:3000** (host's laptop). The exact chat lines are in [DEMO-LINES.md](./DEMO-LINES.md).

| Who | Plays | Where |
|---|---|---|
| Host | Dr. Suresh Menon, consultant | laptop: terminal, web app, all four Telegram groups |
| Member 2 | Dr. Rahul Verma, night PG | Lotus Ward |
| Member 3 | Dr. Priya (Lotus Ward), Anjali (OPD Desk), Farhan (Pharmacy & Lab) | phone |

## 0. Setup (host, 5 minutes)

- [ ] Member 3's Telegram display name is **Dr. Priya Raghavan**; yours is **Dr. Suresh Menon**.
- [ ] Member 3 has posted once in Lotus OPD Desk and in Lotus Pharmacy & Lab (Switch learns members from their first message).
- [ ] Switch Console: re-import `switch/pulse-flow-telegram.template.yaml`, so the coordinator has the remind-then-escalate rule.
- [ ] Terminal, in `/Users/anupama/workspace/flow`: `npm run db:reset`. The app keeps running; refresh the browser.
- [ ] Send `!reset-all-agents` in all four groups and wait for each reply.
- [ ] Web app header says **Switch on**.

## Part A: the Telegram story (record this)

**A1. Handover** (Lotus Ward)
- [ ] Rahul: handover line (Wispr or paste).
- [ ] Scribe: one draft per bed, bed 21 marked critical, ends with `Reply "approve 21"…`.
- [ ] Lotus Escalations: critical-patient alert for bed 21.
- [ ] Priya: `Approve 21 and 7` → both approved under her name.
- [ ] Web, Ward → Tasks: the new tasks from beds 21 and 7 are there.

**A2. Late task, then the consultant**
- [ ] Host terminal: `npm run switch:nudge -- --at 07:00`
- [ ] Lotus Ward: Pulse Flow's `07:00 check: 1 late task`, then the coordinator reminds Dr. Rahul about ICU-2's ABG.
- [ ] Nobody replies.
- [ ] Host terminal: `npm run switch:nudge -- --at 08:00`
- [ ] Lotus Escalations: the coordinator tells Dr. Menon it's still not done.
- [ ] Priya: `ICU-2 ABG and lactate done, sample sent to lab` → done by Dr. Priya.
- [ ] Web, Ward → Tasks: the ABG task is ticked with Priya's name.

**A3. Rounds** (Lotus Ward)
- [ ] Host: the ICU-2 rounds line.
- [ ] Scribe: updated plan (wean norad, RT feeds, registrar call stopped) and asks the consultant to approve.
- [ ] Optional: Rahul `Approve ICU-2` → refused, only the consultant approves rounds.
- [ ] Host: `Approve ICU-2` → approved.
- [ ] Web, Ward → Tasks: "call ICU registrar" is gone; the new tasks are there.

**A4. Walk-in** (Lotus OPD Desk)
- [ ] Anjali: the Ramesh Patil line in Hinglish.
- [ ] OPD desk: token, room, doctor, "send him straight in".
- [ ] Lotus Escalations: emergency alert from Pulse Flow.
- [ ] Web, sidebar → **Front desk** (opens as Anjali): Ramesh Patil is in today's tokens, flagged as an emergency.

**A5. Prescription to pharmacy**
- [ ] Web, sidebar → **OPD console** (opens as Dr. Menon): Ramesh Kumar, GEN-002, is in consultation.
- [ ] Dictate the prescription (the placeholder text works) → **Structure Rx** → check → **Sign**.
- [ ] Lotus Pharmacy & Lab: "Rx signed by Dr. Suresh Menon: GEN-002…".
- [ ] Farhan: `GEN-002 preparing`, then `GEN-002 ready, send the patient to counter 2`.
- [ ] Web, sidebar → **Pharmacy** (opens as Farhan): GEN-002 is under "Ready for pickup".

**A6. The record**
- [ ] Web, sidebar → **Audit log** (opens as Deepak) → **Switch rooms**: the 07:00 and 08:00 checks, every alert marked "sent", and each agent action under the person it was for.

## Part B: web app features (quick checks, no Telegram)

- [ ] **Ward, Handover tab:** paste a short handover → **Make notes** → drafts appear below with any critical flag. Approve one; it moves to the record.
- [ ] **Ward, To approve:** P-4's seeded draft shows the self-correction ("gave ibuprofen… no, paracetamol"). Fill the missing fields, approve.
- [ ] **Ward, Patients:** tap ICU-2 → rounds window → dictate a rounds note → draft for the consultant.
- [ ] **Ward, Tasks:** tick a task; your name appears on it.
- [ ] **Front desk:** "Register a walk-in" → say or paste "Sunita Kale, 38, female, 9822012345, headache since 2 days" → **Fill the form** → register → new token.
- [ ] **Pharmacy:** move an order Queued → Preparing → Ready → Dispensed with the buttons.
- [ ] **Diagnostics:** move a test Ordered → Sample collected → Report ready.
- [ ] **Queue TV:** opens in a new tab with the waiting tokens.
- [ ] **Patient booking:** opens the public booking page; book with the sandbox ABHA flow.
- [ ] **Audit log → Access log:** every view and change from this run, with who and why.

## Part C: the same morning without Switch (optional, 2 minutes)

- [ ] Comment out the `SWITCH_URL` line in `/Users/anupama/workspace/flow/.env`, stop the app (Ctrl+C) and run `npm run dev` again.
- [ ] Header says **Switch off**; the ward screen says nobody is messaged.
- [ ] Handover with a critical patient in the web app → "Not sent: Switch is off."
- [ ] `npm run switch:nudge -- --at 07:00` → lists the late task and says nothing was sent.
- [ ] Put `SWITCH_URL` back and restart before recording.

## Before the real recording

- [ ] `npm run db:reset`, refresh the browser, `!reset-all-agents` in all four groups.
