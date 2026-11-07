# Demo lines: what each person types

One page per person. Send each teammate their section; they can keep it open on their phone while recording.

The lines are written the way an Indian ward actually talks: English clinical terms, Hindi in between, short forms (pyelo, inj, KFT, RT feeds). Speak them with Wispr Flow or paste them. The agents understand the mix; the commands that matter (bed numbers, "approve", order ids) are kept unambiguous.

**The one rule:** to talk to an agent, start the message with `@` and its name. Anything without a tag is ordinary chat, and the agents ignore it.

**Wait for the agent's reply before the next line.** Replies take 5–20 seconds; Telegram shows a "Worked for…" card from Switch first, then the answer.

## The cast

| Person | Plays | Telegram groups |
|---|---|---|
| **Host** (laptop) | **Dr. Suresh Menon**, consultant (MD Medicine), does rounds after OPD | all four |
| **Member 2** | **Dr. Rahul Verma**, night PG covering the ward and casualty calls | Lotus Ward |
| **Member 3** | **Anjali Desai**, front desk (and the pharmacist in scene 6) | Lotus Ward, Lotus OPD Desk, Lotus Pharmacy & Lab |

Your Telegram @username must be mapped to your role in `.env` (`PULSE_FLOW_CHAT_HANDLES`, see [TELEGRAM.md](./TELEGRAM.md) step 7), or the agents won't know who you are.

## Before every take (host)

```bash
npm run db:reset
npm run dev
```

Then send `!reset-all-agents` in **Lotus Ward**, **Lotus Escalations**, **Lotus OPD Desk** and **Lotus Pharmacy & Lab**, and wait for each agent's "reset" reply. Don't run `npm run switch:nudge -- --watch` while recording.

---

## Dr. Rahul Verma (member 2): Lotus Ward

**Scene 1, the night handover, around 3 AM.** Hold Wispr Flow and say it, or paste:

```
@lotus-ward-scribe Sir, night handover. Bed 21 Fatima Khan, pyelo with AKI, inj ceftriaxone 1 gram BD chal raha hai. Patient stable hai, but 2 baje BP 80 by 50 tha, pulse 104. 4 baje BP repeat karna hai, aur subah 8 baje KFT bhejna hai. Bed 7 Meera Iyer, DKA resolved, sugars 140 se 180 on basal-bolus, khana theek kha rahi hai, Menon sir ke round ke baad discharge.
```

You'll see: two short drafts. Bed 21 is marked critical even though you said "stable hai", because the BP rule overrode it. Don't approve them; that's Dr. Menon's line.

**Scene 3, the coordinator asks you.** After the host runs the 06:45 check, the coordinator writes "Dr. Rahul, 2 things from the night: ICU-2 … P-4 …". Reply:

```
@lotus-ward-coordinator ICU-2 ka ABG aur lactate ho gaya, sample lab mein de diya
```

You'll see: the ICU-2 task marked done by Dr. Rahul. If it asks you to confirm instead, send `@lotus-ward-coordinator done ICU-2`. Leave P-4 alone; that's what gets escalated.

That's all for Rahul.

---

## Anjali Desai (member 3)

**Scene 2, Lotus Ward: try to approve (you'll be refused, on purpose).**

```
@lotus-ward-scribe bed 21 ka note approve kar dijiye, sir ne bola tha
```

You'll see: the front desk can't approve clinical notes, and who can.

**Scene 5, Lotus OPD Desk: a walk-in at the counter.**

```
@lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678.
```

You'll see: a token, room and doctor, and "send him straight in". Lotus Escalations gets an emergency alert from Pulse Flow, though you never typed "emergency".

**Scene 6, Lotus Pharmacy & Lab: you're the pharmacist now.** The host remaps you to Farhan (pharmacist) between takes. Then, one message at a time:

```
@lotus-fulfilment DER-001 ki dawai nikal rahe hain
```

```
@lotus-fulfilment DER-001 ready hai, patient ko counter 2 pe bhej do
```

You'll see: DER-001 moved to preparing, then to ready. (Optional: `@lotus-fulfilment DER-001 de diya` before preparing shows the agent refusing to skip a step.)

---

## Dr. Suresh Menon (host)

**Scene 2, Lotus Ward: approve Rahul's two notes** (after Anjali is refused):

```
@lotus-ward-scribe 21 aur 7 dono approve. 21 ka BP 4 baje phir se check karna.
```

You'll see: both approved, under your name. Name the beds; don't say "approve all": that would also approve P-4's waiting note, and scene 3 needs it.

**Scene 3, terminal: wake the coordinator.**

```bash
npm run switch:nudge -- --at 06:45
```

Pulse Flow posts `@lotus-ward-coordinator 06:45 check: 1 late task, 1 note waiting for approval.`, and the coordinator asks Rahul. **After Rahul replies**, run the next check, half an hour later:

```bash
npm run switch:nudge -- --at 07:15
```

You'll see, in **Lotus Escalations**: "Dr. Menon, still open after a reminder to Dr. Rahul: P-4 Aarav Sharma: handover note waiting…". Close it from **Lotus Ward**:

```
@lotus-ward-scribe P-4 approve
```

(Repeating 06:45 instead of 07:15 makes the coordinator hold off, because its reminder went out seconds ago.)

**Scene 4, Lotus Ward: rounds after OPD.**

```
@lotus-ward-scribe ICU-2 rounds: BP ab better hai, 96 by 60 on norad 0.05. MAP theek hai, toh ICU registrar ko call karne ki zarurat nahi. Norad 12 baje tak wean off karo, aur RT feeds start karo.
```

You'll see: the updated plan (new tasks, the registrar call stopped) and a request for your approval. Then:

```
@lotus-ward-scribe ICU-2 approve
```

**Scene 6, web app: sign a prescription.** In `/opd`, switch to Dr. Arvind Rao (name pill, top right) → **Call next** → dictate → **Sign**. Pulse Flow posts the signed prescription in Lotus Pharmacy & Lab. Then Anjali plays the pharmacist.

**Scene 7, web app: the record.** `/audit` → **Switch rooms**, as Deepak (facility admin): every agent action, under the person it acted for.

---

## Optional: the same morning without Switch

Shows what Switch adds. Stop Switch Console (or comment out the `SWITCH_*` lines in `.env`), restart `npm run dev`, and run:

```bash
npm run switch:nudge -- --at 06:45
```

- The header says **Switch off**, and the ward screen says nobody is messaged and no agent follows up.
- A critical handover in the web app shows "Not sent: Switch is off. Only people looking at this screen will know."
- The check prints the late items and says nothing was sent. Nobody asks Rahul, and nobody tells Dr. Menon.

---

## If an agent doesn't answer

- Did the message start with `@` and the exact agent name? Agents only wake on their tag.
- Wait 30 seconds. The first message after a reset starts a new session, which is slower.
- Send `!list-agents` in that group to check the agent is in it.
- More fixes: [TELEGRAM.md → If something doesn't work](./TELEGRAM.md#if-something-doesnt-work).
