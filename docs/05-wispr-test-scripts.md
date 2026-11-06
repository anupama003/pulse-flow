# Wispr dictation test scripts

Three scripts to read aloud with Wispr Flow against the seeded ward (`npm run db:seed`). Read them at a natural pace, filler words included, since that's the point. Each one names the exact pills, colours and tiles you should see.

> All patients are fictional. Bed numbers match [`lib/fixtures.ts`](../lib/fixtures.ts).

---

## 1. The perfect handover

**Persona:** Dr. Rahul (Night PG) · **Where:** *Speak your handover* card · **Patient E:** Fatima Khan, Bed 21

> *"Bed 21, Fatima Khan, 52 year old lady. Situation: she's afebrile for the last eight hours, BP 124 over 76, heart rate 82, saturating 98 percent on room air, urine output about 60 ml an hour. Background: admitted yesterday with acute pyelonephritis and AKI, creatinine was 2.1 on admission, she's on IV ceftriaxone day 2. Assessment: clinically improving, still awaiting the urine culture and the repeat creatinine. Recommendation: please chase the urine culture sensitivity this morning, repeat KFT at 8 AM, and if creatinine is coming down, we can plan to switch to oral antibiotics after the consultant sees her."*

**Expect:**

| Widget | What you should see |
|---|---|
| Review & approve | **1 DraftCard**, Bed 21 ink pill, **Medicine** powder-blue pill, butter **Awaiting approval** |
| Status | Mint **Stable** pill, no blush ring |
| SBAR tiles | All four filled: S and B in powder blue, A in lavender, R in mint. No **Pending** tiles. |
| Corrections / uncertainties | None |
| On approval | ⊕ *Chase urine culture sensitivity* · ⊕ *Repeat KFT* (8 AM, HIGH) · ⊕ *If creatinine is coming down: plan switch to oral antibiotics after consultant review* |
| After **Approve** | Fatima's card loses the "Awaiting approval" pill. New rows appear on the ward checklist, tagged *From handover*. |

---

## 2. The messy edge case

**Persona:** Dr. Rahul (Night PG) · **Where:** *Speak your handover* card · **Patient A:** Vikram Singh, ICU-2

> *"Okay so, um, ICU 2, Vikram. So I'd say he's okay-ish, actually, no, he's not, let me start again. He's the pneumonia guy, septic shock, day 2 of meropenem. So at 4 AM his pressure dropped to 78 over 46, MAP was like 56, so I went up on the norad to point 15, he's now 92 over 58, sorry, I mean 88 over 58. Heart rate 132. Sats 89 on 8 litres, so he's needing more oxygen. Lactate came back 5.2, up from 4.6. Plan is, uh, start another fluid bolus, 500, no wait, hold the fluids, his chest is wet, start Lasix instead, no, scratch that, don't start Lasix with this pressure, just hold fluids and get the ICU registrar to see him now. Also repeat ABG at 6. Oh and I forgot, background, he's a diabetic, sugars have been 250 to 300."*

**What it tests:** two value corrections, a three-step order correction, a "stable-ish" adjective against critical numbers, SBAR out of order (Background comes last), and an order that was revoked twice.

**Expect:**

| Widget | What you should see |
|---|---|
| Card | **Blush ring that pulses**, **Critical** pill, reason pills **BP 88/58** · **HR 132** · **SpO2 89%** · **Lactate 5.2** (the last value of each) |
| Corrections tile (lavender) | ~~Start fluid bolus 500~~ → *Hold fluids* · ~~Start Lasix~~ → *Hold fluids; ICU registrar review* · ~~BP 92/58~~ → *88/58* · ~~"he's okay-ish"~~ → *withdrawn* |
| Uncertainties (butter) | Possibly *"Dictated as stable…"*, if "okay-ish" survives in Assessment. Otherwise none from rules. |
| SBAR | B = pneumonia, septic shock, meropenem day 2, **diabetic, sugars 250–300** (moved from the end to the right place). A = *"Not okay"* (the doctor's own words, not "worsening" made up by the AI) |
| On approval | ⊕ *Hold IV fluids* · ⊕ *ICU registrar to review now* (STAT) · ⊕ *Repeat ABG* (6 AM). **No** "Start fluid bolus" and **no** "Start Lasix". |
| If the AI leaks a retracted order | It's stripped before saving and a butter line explains it: *Removed "Start Lasix": you retracted it…* |

---

## 3. The consultant rapid-fire

**Persona:** Dr. Menon (Consultant) · **Where:** Bed 12 card → stethoscope → *Live rounds* · **Patient C:** Arjun Nair, POD 1

> *"Right, Arjun. Drain's settling, good. Stop the ceftriaxone and metronidazole, start pip-taz 4.5 grams IV 8 hourly. He can start sips of water today, so he's off NBM, sips only. Continue the pantoprazole. Get a chest physio review, he's COPD, I don't want him collapsing a lobe. Repeat CBC and CRP tomorrow morning. If the drain output goes above 300 in 24 hours or he spikes a fever, CT abdomen with contrast and call me. Hourly urine output can go to 4-hourly now. Mobilise him out of bed this evening. Next."*

**What it tests:** merging with the existing plan (cancel, complete and modify), conditional orders, no duplication of tasks that already exist, and consultant-only sign-off.

**Expect:**

| Widget | What you should see |
|---|---|
| Rounds modal | Under **Your sign-off**: one DraftCard, tagged *Live rounds · dictated by Dr. Suresh Menon* |
| On approval: ⊖ Stop (blush) | ~~Continue IV ceftriaxone and metronidazole~~ · ~~Keep NBM until surgical review~~ · ~~Hourly urine output monitoring~~ |
| On approval: ⊕ New (mint) | *Start pip-taz 4.5 g IV 8-hourly* · *Sips of water only* · *Chest physio review* · *Repeat CBC and CRP* (tomorrow morning) · *If drain output > 300 in 24 h or fever spike: CT abdomen with contrast and call consultant* (kept **conditional**) · *4-hourly urine output* · *Mobilise out of bed* (this evening) |
| Not duplicated | Pantoprazole isn't re-added, because "continue" matches the existing plan. |
| SBAR | R updated to the consultant's plan. Status stays mint **Stable**. |
| Sign-off rule | Switch to Priya: the button turns into a locked **Consultant sign-off**. As Menon it reads **Approve +7**. |
| After approval | The three old rows disappear from the checklist (cancelled). The new rows are tagged *From rounds*. The action board's High and Routine columns refill. |

---

## Bonus one-liners for each edge case

| Edge case | Say | Expect |
|---|---|---|
| Correction | *"Bed 7 Meera, start IV fluids, no wait, hold fluids, start Lasix instead."* | Tasks: Hold IV fluids, Start Lasix |
| Missing info | *"Bed 21 Fatima, afebrile overnight."* | Only S filled. B, A and R show dashed **Pending** tiles. |
| Contradiction | *"Bed 7 Meera is stable, BP 70 over 40."* | Blush **Critical**, **Auto-escalated by vitals check**, a butter "Dictated as stable…" line, and Meera's card shows *Critical · unconfirmed* |
