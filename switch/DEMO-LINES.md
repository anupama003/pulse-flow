# Demo lines: what each person types

One page per person. Send each teammate their section; they can keep it open on their phone while recording.

Doctors speak English, as handovers and consultant dictation must be, with the short forms Indian wards use (pyelo, inj, KFT, RT feeds). The front desk speaks the way the OPD counter does, in Hinglish. Speak the lines with Wispr Flow or paste them. Bed numbers and order ids are kept explicit so the agents can't misread them.

**The one rule:** to talk to an agent, start the message with `@` and its name. Anything without a tag is ordinary chat, and the agents ignore it.

**Wait for the agent's reply before the next line.** Replies take 5–20 seconds; Telegram shows a "Worked for…" card from Switch first, then the answer.

## The cast

| Person | Plays | Telegram groups |
|---|---|---|
| **Host** (laptop) | **Dr. Suresh Menon**, consultant | all four |
| **Member 2** | **Dr. Rahul Verma**, night PG | Lotus Ward |
| **Member 3** | **Dr. Priya Raghavan**, day PG, in Lotus Ward; **Anjali** (front desk) in Lotus OPD Desk; **Farhan** (pharmacist) in Lotus Pharmacy & Lab | Lotus Ward, Lotus OPD Desk, Lotus Pharmacy & Lab |

One line in `.env` maps member 3 to all three roles, one per group:

```bash
PULSE_FLOW_CHAT_HANDLES=<host>=u-menon,<member2>=u-rahul,<member3>=u-priya,<member3>=u-anjali@opd-desk,<member3>=u-farhan@fulfilment
```

## Before every take (host)

```bash
npm run db:reset
npm run dev
```

Then send `!reset-all-agents` in **Lotus Ward**, **Lotus Escalations**, **Lotus OPD Desk** and **Lotus Pharmacy & Lab**, and wait for each agent's "reset" reply. Don't run `npm run switch:nudge -- --watch` while recording.

## The story in one line each

1. **Handover:** Rahul hands the night over to Priya in Lotus Ward. Priya approves it. Dr. Menon gets the critical patient in Lotus Escalations.
2. **Late task:** at 7:00 the coordinator reminds Rahul about a late blood gas. Nobody does it, so at 8:00 it tells Dr. Menon. Priya does it and says so.
3. **Rounds:** Dr. Menon dictates rounds for ICU-2 and approves the new plan.
4. **Walk-in:** Anjali registers a chest-pain patient at the OPD desk; it's escalated as an emergency.
5. **Pharmacy:** a prescription is signed in the web app; Farhan moves an order to ready.
6. **Record:** the audit log shows every action under the person it was done for.

---

## Dr. Rahul Verma (member 2): Lotus Ward

**Scene 1, the handover.** Hold Wispr Flow and say it, or paste:

```
@lotus-ward-scribe Handover to Dr. Priya. Bed 21 Fatima Khan, pyelo with AKI, on inj ceftriaxone 1 gram BD. Patient is stable, but BP at 2 AM was 80 by 50, pulse 104. Repeat BP at 4 AM and send KFT at 8 in the morning. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, taking orally well, discharge after Menon sir's round.
```

You'll see: one short draft per bed. Bed 21 is marked critical even though you said "stable", because the BP rule overrode it. Priya approves them, not you.

**Scene 2.** The coordinator reminds you about ICU-2 at 7:00. **Don't reply**: you're busy in casualty, which is why it goes to Dr. Menon next.

**Scene 3 (optional).** After Dr. Menon's rounds draft appears, try:

```
@lotus-ward-scribe Approve ICU-2
```

You'll see: refused. Only the consultant approves a rounds plan.

---

## Member 3

### As Dr. Priya Raghavan, in Lotus Ward

**Scene 1, take the handover.** After the scribe posts the drafts:

```
@lotus-ward-scribe Approve 21 and 7
```

You'll see: both approved, under your name.

**Scene 2, close the late task.** After the coordinator's message to Dr. Menon appears in Lotus Escalations:

```
@lotus-ward-coordinator ICU-2 ABG and lactate done, sample sent to lab
```

You'll see: ICU-2 marked done by Dr. Priya. If it asks you to confirm instead, send `@lotus-ward-coordinator done ICU-2`.

### As Anjali, in Lotus OPD Desk

**Scene 4, a walk-in at the counter.**

```
@lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678.
```

You'll see: a token, room and doctor, and "send him straight in". Lotus Escalations gets an emergency alert from Pulse Flow, though you never typed "emergency".

### As Farhan, in Lotus Pharmacy & Lab

**Scene 5, after the host signs a prescription.** One message at a time:

```
@lotus-fulfilment DER-001 preparing
```

```
@lotus-fulfilment DER-001 ready, send the patient to counter 2
```

You'll see: DER-001 moved to preparing, then to ready.

---

## Dr. Suresh Menon (host)

**Scene 1.** Watch **Lotus Escalations**: Pulse Flow posts bed 21 as critical the moment the handover is written. You don't need to type anything.

**Scene 2, terminal: the 7:00 check.**

```bash
npm run switch:nudge -- --at 07:00
```

Pulse Flow posts `@lotus-ward-coordinator 07:00 check: 1 late task.` and the coordinator reminds Rahul in Lotus Ward. Wait a few seconds with no reply, then run the 8:00 check:

```bash
npm run switch:nudge -- --at 08:00
```

You'll see, in **Lotus Escalations**: "Dr. Menon, ICU-2 Vikram Singh: STAT repeat ABG and lactate, due 6 AM, still not done an hour after the reminder." Then Priya closes it.

**Scene 3, Lotus Ward: rounds.**

```
@lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05. MAP is fine, so no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.
```

You'll see: the updated plan (new tasks, the registrar call stopped) and a request for your approval. Then:

```
@lotus-ward-scribe Approve ICU-2
```

**Scene 5, web app: sign a prescription.** Click **OPD console** in the left sidebar. It opens your own OPD (General Medicine) with Ramesh Kumar, GEN-002, already in consultation. Dictate the prescription → **Sign**. Pulse Flow posts the signed prescription in Lotus Pharmacy & Lab. Then Farhan moves the order.

**Scene 6, web app: the record.** Click **Audit log** in the sidebar (it opens as Deepak, the facility admin) → **Switch rooms**: every agent action, under the person it acted for.

Every page is in the left sidebar. A page your current role can't open says "as …" under its name, and one click switches to that colleague: Pharmacy as Farhan, Diagnostics as Kavya, Front desk as Anjali.

---

## Optional: the same morning without Switch

Shows what Switch adds. Stop Switch Console (or comment out the `SWITCH_*` lines in `.env`), restart `npm run dev`, and run:

```bash
npm run switch:nudge -- --at 07:00
```

- The header says **Switch off**, and the ward screen says nobody is messaged and no agent follows up.
- A critical handover in the web app shows "Not sent: Switch is off. Only people looking at this screen will know."
- The check prints the late task and says nothing was sent. Nobody reminds Rahul, and nobody tells Dr. Menon.

---

## If an agent doesn't answer

- Did the message start with `@` and the exact agent name? Agents only wake on their tag.
- Wait 30 seconds. The first message after a reset starts a new session, which is slower.
- Send `!list-agents` in that group to check the agent is in it.
- More fixes: [TELEGRAM.md → If something doesn't work](./TELEGRAM.md#if-something-doesnt-work).
