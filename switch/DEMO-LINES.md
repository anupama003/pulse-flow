# Demo lines: what each person types

Three people, in this order. Wait for each agent's reply before the next line (5–20 seconds).

**The one rule:** start every message to an agent with `@` and its full name, typed out. Telegram's @ suggestions only show the one Switch bot, because all the agents speak through it; ignore the suggestions and type the name.

| Person | Plays | Groups |
|---|---|---|
| Anupama (host, laptop) | **Dr. Suresh Menon**, consultant | all four |
| Amulya | **Dr. Rahul Verma**, night PG | Lotus Ward, Lotus Escalations |
| Papa | **Anjali Desai**, front desk; in Lotus Pharmacy & Lab she also moves pharmacy orders | Lotus OPD Desk, Lotus Pharmacy & Lab |

## Before the take (host)

1. `npm run db:reset` in `/Users/anupama/workspace/flow`, then refresh the browser.
2. Send `!reset-all-agents` in all four groups and wait for the replies.
3. Papa sends `Hi` once in **Lotus Pharmacy & Lab** (Switch learns members from their first message).

The 07:00 and 08:00 checks run by themselves when the right message appears. If you run them by hand: `npm run switch:nudge -- --at 07:00`, then `npm run switch:nudge -- --at 08:00`.

## The take

| # | Who | Group | Message | You'll see |
|---|---|---|---|---|
| 1 | Dr. Rahul | Lotus Ward | `@lotus-ward-scribe Handover to the day team. Bed 21 Fatima Khan, pyelo with AKI, on inj ceftriaxone 1 gram BD. Patient is stable, but BP at 2 AM was 80 by 50, pulse 104. Repeat BP at 4 AM and send KFT at 8 in the morning. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, taking orally well, discharge after Menon sir's round.` | One draft per bed, bed 21 critical. Lotus Escalations gets the alert. |
| 2 | Dr. Menon | Lotus Ward | `@lotus-ward-scribe Approve 21 and 7` | Both approved under Dr. Menon's name. |
| – | automatic | Lotus Ward | 07:00 check | The coordinator reminds Dr. Rahul about ICU-2's ABG. **Nobody replies.** |
| – | automatic | Lotus Escalations | 08:00 check (about 25 s later) | The coordinator tells Dr. Menon it's still not done. |
| 3 | Dr. Rahul | Lotus Ward | `@lotus-ward-coordinator ICU-2 ABG and lactate done, sample sent to lab` | Task closed, done by Dr. Rahul. |
| 4 | Dr. Menon | Lotus Ward | `@lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05. MAP is fine, so no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.` | The new plan, waiting for the consultant. |
| 5 | Dr. Rahul | Lotus Ward | `@lotus-ward-scribe Approve ICU-2` | Refused: only the consultant approves rounds. |
| 6 | Dr. Menon | Lotus Ward | `@lotus-ward-scribe Approve ICU-2` | Approved; the registrar call stops. |
| 7 | Anjali | Lotus OPD Desk | `@lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678.` | Token and room; Lotus Escalations gets an emergency alert. |
| 8 | Dr. Menon | web app | Sidebar → **OPD console** → Ramesh Kumar (GEN-002) → paste the prescription → **Structure Rx** → **Sign** | Lotus Pharmacy & Lab: "Rx signed by Dr. Suresh Menon: GEN-002…" |
| 9 | Anjali | Lotus Pharmacy & Lab | `@lotus-fulfilment GEN-002 preparing` | GEN-002 preparing. |
| 10 | Anjali | Lotus Pharmacy & Lab | `@lotus-fulfilment GEN-002 ready, send the patient to counter 2` | GEN-002 ready. |

Prescription to paste in step 8: `Tab Pan 40 OD before breakfast for 14 days. Tab Paracetamol 650 SOS for fever. CBC and LFT. Review after 5 days.`

## If an agent doesn't answer

- The message must start with `@` and the full agent name, typed out.
- Send `!list-agents` in the group. Lotus Ward should list `lotus-ward-scribe` and `lotus-ward-coordinator`; Lotus OPD Desk `lotus-opd-desk`; Lotus Pharmacy & Lab `lotus-fulfilment`.
- If one is missing, re-add it: Switch Console → Templates → import `switch/pulse-flow-telegram.template.yaml` → pick the four groups → Create. Then `!reset-all-agents` in every group.
