# Pulse Flow: end-to-end test flows

Step-by-step flows to run by hand. Each one lists the persona, the clicks, and exactly what you should see. Run them in order on a fresh seed; later flows build on earlier ones.

**Before you start**

```bash
npm run db:up && npm run db:seed && npm run dev     # http://localhost:3000
```

- Switch persona with the **name pill** at the top right (each role lands on its own module).
- 🔑 marks steps that need an AI key in `.env` (`GEMINI_API_KEY`, or `ANTHROPIC_API_KEY` with `LLM_PROVIDER=anthropic`). Everything else works without it.
- Dictation scripts to read aloud: [05](05-wispr-test-scripts.md) (ward) and [06](06-opd-test-scripts.md) (OPD).
- Test each flow at **desktop width** and on a **phone** (DevTools → 375 × 812).

---

## Flow A: Layout & branding sanity (2 min)

| # | Do | Expect |
|---|---|---|
| A0 | Open `/` in a **new tab** (or `/?splash=1` to replay) | A 5-second Pulse Flow intro: the logo spins in and beats, shockwave rings expand, the letters fall in, a heartbeat line sweeps across into a wave, and status lines run with a progress bar. Then the dashboard fades in |
| A0b | During the intro press **Skip intro**, Esc or click anywhere | It leaves in under a second. Reloading the same tab doesn't replay it. `/book` and `/queue` never show it |
| A0c | After the intro, without clicking anything, hold the Wispr key and read one sentence | The text lands in **Speak your handover** (the box is focused automatically) and the word count goes up |
| A0c2 | Click the box, hold the Wispr key, then release | The pill shows **Ready · hold Wispr key** → **Listening…** (if your browser sees the hotkey) → **Transcribing…** after release → **Receiving text…** as the words land |
| A0d | Read a whole script (e.g. [script 3](05-wispr-test-scripts.md#3-the-consultant-rapid-fire)) in one hold, then wait 3 s | **Every word** is in the box (not fragments) and stays there after the lavender glow fades |
| A1 | Open `/` | Tab title "Ward · Pulse Flow". The animated logo traces in the sidebar, the **Pulse Flow** wordmark shows in the top bar on wide screens, and the footer is at the bottom |
| A2 | Visit `/opd`, `/front-desk`, `/pharmacy`, `/lab`, `/audit`, `/queue?f=lotus-ridge`, `/book?f=lotus-ridge` (use a persona that can open each) | Each tab title ends in "· Pulse Flow". **No card sticks out of the white frame**, and the footer sits below the last card |
| A3 | On `/opd`, scroll to **Dictate the prescription** | The lavender card ends inside the white frame (this was the overflow bug). The footer is visible below it |
| A4 | On `/front-desk`, click into the dictation box and type | The card doesn't shift sideways and no text is cut off at the left (fixed focus-scroll bug) |
| A5 | Phone width: open each staff page | No sideways scrolling. The module pills under the header scroll on their own, and cards stack in one column |
| A6 | macOS *Reduce motion* on → reload | The logo is static (no tracer) |

## Flow B: Night handover → approval (Dr. Rahul, Night PG)

| # | Do | Expect |
|---|---|---|
| B1 | First visit to `/` | The 7-step tour opens. Click through it, or press Esc. **?** in the sidebar replays it |
| B2 | Scroll to **Awaiting approval** | Aarav (P-4) draft shows a lavender correction tile (~~Gave ibuprofen~~ → paracetamol), butter uncertainties and two dashed **Pending** sections |
| B3 | Type into the Assessment and Recommendation Pending boxes | The boxes stay open while you type, and each label turns into a mint **Added by you** pill |
| B4 | Click **Approve with edits** | The draft leaves the queue, "To approve" drops to 0, and 2 new tasks appear in **Ward checklist** |
| B5 | 🔑 Read [script 2](05-wispr-test-scripts.md#2-the-messy-edge-case) into **Speak your handover** → **Structure handover** | The review split screen shows raw text on the left and Vikram's draft on the right with a blush ring, reasons BP 88/58 · HR 132 · SpO2 89% · Lactate 5.2, and corrections listed |

## Flow C: Day team picks up (Dr. Priya, Day PG)

| # | Do | Expect |
|---|---|---|
| C1 | Switch to Priya | The ward stays the same. Her name shows in the persona pill |
| C2 | Tick **Repeat ABG and lactate** | Instant strike-through, a mint check, "✓ Dr. Priya Raghavan". The progress % goes up |
| C3 | Click the **Critical** tile | Only Vikram Singh is listed. Click **All patients** to reset |
| C4 | Open any patient → **Live rounds** | The modal slides up in the centre (bottom sheet on a phone) and fits the screen. Esc closes it |

## Flow D: Consultant rounds sign-off (Dr. Menon)

| # | Do | Expect |
|---|---|---|
| D1 | 🔑 As Priya, open Arjun (Bed 12) → Live rounds → read [script 3](05-wispr-test-scripts.md#3-the-consultant-rapid-fire) → **Update care plan** | A draft appears under **Awaiting consultant sign-off**. The approve button reads **Consultant sign-off** and is locked |
| D1b | In Live rounds, dictate one sentence, click the patient name, then dictate two more | All three sentences are in **Capture the consultant's orders**. The ward's **Speak your handover** box stays empty |
| D2 | Switch to Dr. Menon, reopen Arjun | **Your sign-off**. ⊖ cancelled orders in blush, ⊕ new tasks in mint |
| D3 | Approve | Old orders vanish from the checklist. New ones are tagged *From rounds* |

## Flow E: Patient books by voice + ABHA (public, phone)

| # | Do | Expect |
|---|---|---|
| E1 | Open `/book?f=lotus-ridge` on a phone (or 375 px) | A lavender "What's bothering you?" card, a big ink mic, and the Pulse Flow mark in the header |
| E1b | Click the complaint box and dictate with Wispr (don't type) | **Find my doctor** enables as soon as the words appear |
| E2 | Tap the "itchy rash" example → **Find my doctor** | 🔑 The form is pre-filled with Paediatrics, tomorrow and morning. Without a key there's an error and a **Fill in the form myself** link that opens the form |
| E3 | Type "my son has chest pain and can't breathe" → Find my doctor | The blush **This may need emergency care** screen with **Call 108**. You can't book |
| E4 | Back to the form: name *Vihaan Gupta*, age 6, male, mobile `9876500001` | Confirm stays disabled until you tick the consent box |
| E5 | ABHA: mobile `9876500001` → **Get OTP** | A butter "Sandbox SMS… OTP is ######" box. A **SANDBOX** badge is visible |
| E6 | Enter the OTP → **Verify** | Two accounts: Pooja Gupta, Anaya Gupta |
| E7 | **Create a new ABHA for someone else** → name, *male*, 2020 → Create | A mint card `99-XXXX-XXXX-XXXX · vihaan.gupta…@sbx` |
| E8 | Tick consent → **Confirm Paediatrics token** | A token card **PED-00x** for tomorrow, ABHA *Linked*, "WhatsApp message prepared (demo mode)" |
| E9 | Wrong OTP 3 times | "Incorrect OTP. N attempt(s) left", then you're asked to request a new one |

## Flow F: Front-desk walk-in (Anjali Desai)

| # | Do | Expect |
|---|---|---|
| F1 | Switch to Anjali | Lands on `/front-desk`. The sidebar shows only Front desk, Queue TV and Booking |
| F2 | 🔑 Dictate "Ramesh Kumar, 45, male, 98220 11223, fever since 3 days" → **Fill the form** | Fields fill in and General Medicine is pre-selected |
| F3 | Without a key: same text → error → **Fill the form by hand instead** | The form opens with the complaint pre-filled |
| F4 | Complete it → **Register & issue token** | A mint token card (e.g. GEN-005) with a stopwatch "x.x s from first word" |
| F5 | Find **Arjun Deshmukh** (booked online, tomorrow) | Not in today's list (correct: he's tomorrow) |
| F6 | Click **Check in** on any *Booked online* row (book one for today in Flow E first) | The status changes to *Waiting* |
| F7 | Click the no-show icon on a Waiting row | The status changes to *No-show* |

## Flow G: OPD consult → e-Rx → fulfilment (Dr. Arvind Rao)

| # | Do | Expect |
|---|---|---|
| G1 | Switch to Dr. Arvind Rao → `/opd` | Mohammed Arif (GAS-003) is in the room with an ABHA pill and **Allergy: Penicillin**. The queue shows full tokens (GAS-005, GAS-004) |
| G2 | 🔑 Read [script 5](06-opd-test-scripts.md#5-consultant-opd-rapid-fire-e-prescription) → **Structure Rx** | Draft: 5 medicines with quantities, a corrections tile for Augmentin → Azithromycin, investigation pills, advice and follow-up |
| G3 | Add a medicine *Augmentin* by hand | A blush allergy box appears and **Sign** is locked. Remove the row (or tick the override) to unlock it |
| G4 | Leave a duration empty | The field shows "missing" in butter. Signing is still allowed (review flag only) |
| G5 | **Sign & send to pharmacy** | A mint banner "Prescription signed…", "WhatsApp: simulated". **View PDF** opens an A4 Rx with HPR ID and SHA-256 |
| G5b | Dictate a few words into the Rx box but don't structure them, then sign the draft | After **Call next patient**, the new patient's dictation box is empty (no carry-over) |
| G6 | **Call next patient** | **GAS-005 Rohan** (SOON) is called before GAS-004 |
| G7 | Switch to Dr. Leela Thomas → `/opd` | "No HPR ID: drafting only". The sign button reads **Consultant signature needed** |

## Flow H: Pharmacy & diagnostics (Farhan, Kavya)

| # | Do | Expect |
|---|---|---|
| H1 | Switch to Farhan → `/pharmacy` | 4 columns. Arif's new order is in *Queued* with an allergy pill and quantities |
| H2 | **Start preparing** → **Mark ready** → **Dispensed** | The card moves column by column. The wait time stays on one line |
| H3 | Farhan opens `/` in the address bar | Redirected to `/pharmacy` (ward is not allowed for this role) |
| H4 | Switch to Kavya → `/lab` | **USG abdomen URGENT** (blush) at the top. Sample collected → Processing → Report ready |

## Flow I: Queue TV (any browser, a second tab)

| # | Do | Expect |
|---|---|---|
| I1 | Open `/queue?f=lotus-ridge` in a second window | A room card per department, names masked ("Rohan M."), and a ticking clock |
| I2 | Click **Announcements on** | The button turns mint |
| I3 | In the first window, Dr. Rao clicks **Call next** | Within ~5 s the Gastro card pulses, *Now serving* updates, and the token is spoken aloud |

## Flow J: Audit & tenant isolation (Deepak, Pooja)

| # | Do | Expect |
|---|---|---|
| J1 | Switch to Deepak → `/audit` | READ/CREATE/SIGN/SEND/DENIED rows with actor, purpose and patient |
| J2 | Filter **Action = DENIED** | Shows Farhan's blocked ward attempt from H3 |
| J3 | Filter by **Mohammed Arif** | Every access to his record: the consultant reads, the SIGN, pharmacy updates, PUBLIC reads from the booking |
| J4 | **WhatsApp outbox** tab | `opd_token_v1` / `rx_document_v1` payloads, status *simulated* |
| J5 | Switch to **Pooja Nair (Baner clinic)** | Front desk shows only clinic tokens (GEN-001 Vijay More). No hospital patients anywhere |
| J6 | Switch to **Dr. Imran Qureshi** → `/pharmacy` and `/opd` | Pharmacy shows only the clinic's order (Shalini Pawar, adapalene gel). The OPD queue has only clinic patients. Isolation holds |

## Flow K: Edge cases worth a quick poke

| # | Do | Expect |
|---|---|---|
| K1 | Refresh mid-dictation on `/` | Your dictation text is still in the box (autosaved locally) |
| K2 | 🔑 Ward dictation: "Bed 7 Meera is stable, BP 70 over 40" | Blush **Critical**, **Auto-escalated by vitals check**, a butter "Dictated as stable…" line |
| K3 | 🔑 Ward dictation: "Bed 21 Fatima, afebrile overnight." | Only S is filled. B, A and R show dashed **Pending** |
| K4 | Open `/api/rx/rx-sanjay/pdf` in a private window | 403 (no session, no signed link) |
| K5 | Two tabs as two consultants approve the same draft | The second gets "This draft was already reviewed." |

---

**Reset between runs:** `npm run db:seed` re-seeds in place. `npm run db:reset` wipes everything (dev databases only).
**Automated checks:** `npm test` (type-check + 28 unit tests) and `npm run test:db` (6 integration tests).
