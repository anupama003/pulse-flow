# OPD dictation test scripts

Two scripts to read aloud against the seeded hospital (`npm run db:reset`). They continue the [IPD scripts](05-wispr-test-scripts.md).

---

## 4. Patient voice booking: child with a skin rash

**Where:** `/book?f=lotus-ridge` on a phone. Tap the big mic (browser speech) or hold Wispr on a laptop.
**Speaker:** a parent booking for their child.

> *"Hi, I want to book an appointment for my son Vihaan, he's six years old. Since three days he has an itchy red rash on both arms and behind his knees, it gets worse at night and he keeps scratching. No fever, he's eating and playing normally. We used coconut oil but it didn't help. Can we come tomorrow morning? My number is 98765 00001."*

**Expect:**

| Step | What you should see |
|---|---|
| Triage | **No emergency screen**. It's a rash with no fever that the child isn't unwell with, so none of the 15 red-flag rules fire (unit-tested). |
| "We heard" card | *"itchy red rash on both arms and behind knees, worse at night"* · *3 days* |
| Department | **Paediatrics** pre-selected (lavender ring), because children under 14 are routed to Paeds first. A one-line reason (wording varies) and Dr. Sneha Joshi · Room 2 |
| When | **Tomorrow** + **Morning** pills selected |
| Patient | Name *Vihaan*, age *6*, gender *male*, mobile *9876500001*. "(the person who needs care)" label shows, because the parent is booking. |
| ABHA (sandbox) | Get OTP → a butter "Sandbox SMS … OTP is ######" appears → Verify → **two ABHA accounts on this mobile** (Pooja Gupta, Anaya Gupta). Choose **Create a new ABHA for someone else** → *Vihaan Gupta*, male, 2020 → mint ABHA card `99-XXXX-XXXX-XXXX · vihaan.gupta…@sbx` |
| Confirm | Token card **PED-001** for tomorrow (tomorrow's Paeds sequence starts at 1) · Paediatrics · Room 2 · ABHA *Linked* · *"WhatsApp message prepared (demo mode, not sent)"* |
| Behind the scenes | `Patient` (ABHA linked, consents stamped) · `Appointment` (ONLINE_VOICE, BOOKED) · `TokenCounter` + 1 · `MessageLog` (opd_token_v1, SIMULATED) · `AuditLog` CREATE/SEND rows with actor **PUBLIC** |

**Emergency variant:** add *"…and now he has a high fever and the spots have gone purple and don't fade when I press a glass on them"*. You get the **blush emergency screen** with *Fever with stiff neck or non-fading rash* and a big **Call 108** button. Booking is refused on the server too.

---

## 5. Consultant OPD rapid-fire e-prescription

**Where:** switch persona to **Dr. Arvind Rao (Gastro)** → `/opd`. **Mohammed Arif (GAS-003)** is already in the room: *severe acidity and stomach pain*, with a blush **Allergy: Penicillin** pill.

> *"Okay, Arif. Tab Pan 40 mg OD before breakfast for 4 weeks. Syrup Gelusil 2 teaspoons TID after food for 2 weeks. Tab Augmentin 625 BD for 5 days, actually no, scratch the Augmentin, he's penicillin allergic, make it Tab Azithromycin 500 OD for 3 days. Tab Domstal 10 mg TID before food for 5 days. Tab Sucralfate 1 gram 1-0-1 for 2 weeks. Investigations: CBC, LFT, H pylori stool antigen, and an urgent USG abdomen. Avoid spicy and oily food, no tea or coffee on an empty stomach, small frequent meals, and don't lie down for 2 hours after dinner. Review after 2 weeks with reports."*

**What it tests:** five drugs in about 40 seconds, Indian shorthand (OD/TID/BD/1-0-1, tsp), a mid-sentence correction prompted by an allergy, tests split from medicines, URGENT detection, advice vs follow-up.

**Expect in the e-Prescription draft:**

| Area | What you should see |
|---|---|
| Lavender corrections tile | ~~Tab Augmentin 625 BD 5 days~~ → *Tab Azithromycin 500 OD 3 days* |
| Medicines | 1 **Pan** TAB 40 mg · 1 tab · OD · 4 weeks · before breakfast · **Qty 28**<br>2 **Gelusil** SYP · 2 tsp · TID · 2 weeks · after food<br>3 **Azithromycin** TAB 500 mg · OD · 3 days · **Qty 3**<br>4 **Domstal** TAB 10 mg · TID · 5 days · before food · **Qty 15**<br>5 **Sucralfate** TAB 1 g · 1-0-1 · 2 weeks · **Qty 28** |
| Allergy | **No** blush allergy box, because Augmentin was retracted. If the AI leaks it, the server flags **ALLERGY** and the Sign button stays locked until you remove it or tick the override. |
| Investigations (powder pills) | CBC · LFT · H. pylori stool antigen · **USG abdomen** in blush as *urgent* |
| Advice (mint, goes on WhatsApp) | 4 lines as dictated |
| Follow-up | *Review after 2 weeks with reports* |
| Sign | Button reads **Sign & send to pharmacy** (HPR 71-0000-0000-0002) |

**After signing:**
- Mint banner: *Prescription signed for Mohammed Arif · WhatsApp: simulated, simulated* · **View PDF**.
- **Pharmacy** (switch to Farhan Sheikh): new card in *Queued* with the five items and quantities, and an **Allergy: Penicillin** pill for the pharmacist's double-check.
- **Diagnostics** (Kavya Rao): **USG abdomen URGENT** (blush, top of the list) plus 3 routine tests in *Ordered*.
- **Queue TV**: GAS-003 leaves *Now serving*. Click **Call next** and **GAS-005 Rohan M.** is next, because he's marked *SOON*, so priority beats token order.
- **Audit** (Deepak Kulkarni): a black **SIGN** row with the HPR ID and SHA-256 in the metadata, and **SEND** rows for the WhatsApp messages.

**Lock checks:**
- Switch to **Dr. Leela Thomas** (Derm, *HPR pending*). Her console shows *No HPR ID: drafting only* and the button reads **Consultant signature needed**.
- As **Dr. Priya** (Day PG) you can draft but not sign, and the server refuses it too.
