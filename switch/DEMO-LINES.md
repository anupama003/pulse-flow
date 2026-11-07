# Demo lines: what each person types

One page per person. Send each teammate their section; they can keep it open on their phone while recording.

**The one rule:** to talk to an agent, start the message with `@` and its name. Copy each line exactly, including the `@`. Anything without a tag is ordinary chat, and the agents ignore it.

**Wait for the agent's reply before the next line.** Replies take 5–20 seconds; Telegram shows a "Worked for…" card from Switch first, then the answer.

## The cast

| Person | Plays | Telegram groups |
|---|---|---|
| **Host** (laptop) | **Dr. Suresh Menon**, consultant | all four |
| **Member 2** | **Dr. Rahul Verma**, night PG | Lotus Ward |
| **Member 3** | **Anjali Desai**, front desk (and the pharmacist in scene 6) | Lotus Ward, Lotus OPD Desk, Lotus Pharmacy & Lab |

Your Telegram @username must be mapped to your role in `.env` (`PULSE_FLOW_CHAT_HANDLES`, see [TELEGRAM.md](./TELEGRAM.md) step 7), or the agents won't know who you are.

## Before every take (host)

```bash
npm run db:reset
npm run dev
```

Then send `!reset-all-agents` in **Lotus Ward**, **Lotus Escalations**, **Lotus OPD Desk** and **Lotus Pharmacy & Lab**, and wait for each agent's "reset" reply. Don't run `npm run switch:nudge -- --watch` while recording.

---

## Dr. Rahul Verma (member 2) — Lotus Ward

**Scene 1, the night handover.** Hold Wispr Flow and say it, or paste:

```
@lotus-ward-scribe Bed 21 Fatima Khan, pyelonephritis with AKI on IV ceftriaxone, she's stable, BP 80 by 50 at 2 AM, heart rate 104, recheck BP at 4 and repeat KFT at 8. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, eating well, discharge after consultant review.
```

You'll see: two short drafts. Bed 21 is 🔴 because the BP overrode "stable". Don't approve them; that's Dr. Menon's line.

**Scene 3, the coordinator asks you.** After the host runs the 06:45 check, the coordinator writes "Dr. Rahul, 2 things from the night: ⏰ ICU-2 … 📝 P-4 …". Reply:

```
@lotus-ward-coordinator done ICU-2
```

You'll see: `✅ ICU-2 ABG and lactate, done by Dr. Rahul.` Leave P-4 alone; that's what gets escalated.

That's all for Rahul.

---

## Anjali Desai (member 3)

**Scene 2, Lotus Ward: try to approve (you'll be refused, on purpose).**

```
@lotus-ward-scribe approve 21
```

You'll see: the front desk can't approve clinical notes.

**Scene 5, Lotus OPD Desk: a walk-in.**

```
@lotus-opd-desk walk-in Ramesh Patil 54 male, chest pain since morning and sweating, 9812345678, ok for WhatsApp
```

You'll see: a token, room and doctor, and "send him straight in". Lotus Escalations gets a 🚨 from Pulse Flow, though you never typed "emergency".

**Scene 6, Lotus Pharmacy & Lab: you're the pharmacist now.** The host remaps you to Farhan (pharmacist) between takes. Then, one message at a time:

```
@lotus-fulfilment DER-001 preparing
```

```
@lotus-fulfilment DER-001 ready
```

You'll see: `✅ DER-001 preparing.`, then `✅ DER-001 ready.` (Optional: `@lotus-fulfilment DER-001 dispensed` before "preparing" shows the agent refusing to skip a step.)

---

## Dr. Suresh Menon (host)

**Scene 2, Lotus Ward: approve Rahul's two notes** (after Anjali is refused):

```
@lotus-ward-scribe approve 21 and 7
```

You'll see: ✅ both approved, under your name. Use the bed numbers, not "approve all": "approve all" would also approve P-4's waiting note, and scene 3 needs it.

**Scene 3, terminal: wake the coordinator.**

```bash
npm run switch:nudge -- --at 06:45
```

Pulse Flow posts `@lotus-ward-coordinator 06:45 check: 1 late task, 1 note waiting for approval.`, and the coordinator asks Rahul. **After Rahul replies "done ICU-2"**, run the next check, half an hour later:

```bash
npm run switch:nudge -- --at 07:15
```

You'll see, in **Lotus Escalations**: "Dr. Menon, still open after a reminder to Dr. Rahul: 📝 P-4 Aarav Sharma: handover note waiting…". Close it from **Lotus Ward**:

```
@lotus-ward-scribe approve P-4
```

(Repeating 06:45 instead of 07:15 makes the coordinator hold off, because its reminder went out seconds ago.)

**Scene 4, Lotus Ward: consultant rounds.**

```
@lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05, MAP fine now so drop the ICU registrar call, wean norad off by noon, start enteral feeds.
```

You'll see: the updated plan (new tasks, the registrar call stopped) and a request for your approval. Then:

```
@lotus-ward-scribe approve ICU-2
```

**Scene 6, web app: sign a prescription.** In `/opd`, switch to Dr. Arvind Rao (name pill, top right) → **Call next** → dictate → **Sign**. Pulse Flow posts 🧾 in Lotus Pharmacy & Lab. Then Anjali plays the pharmacist.

**Scene 7, web app: the record.** `/audit` → **Switch rooms**, as Deepak (facility admin): every agent action, under the person it acted for.

---

## If an agent doesn't answer

- Did the message start with `@` and the exact agent name? Agents only wake on their tag.
- Wait 30 seconds. The first message after a reset starts a new session, which is slower.
- Send `!list-agents` in that group to check the agent is in it.
- More fixes: [TELEGRAM.md → If something doesn't work](./TELEGRAM.md#if-something-doesnt-work).
