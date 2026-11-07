# Demo lines: what each person types

Three people, in this order. Wait for each agent's reply before the next line (5–20 seconds).

**The one rule:** start every message to an agent with `@` and its full name, typed out. Telegram's @ suggestions only show the one Switch bot, because all the agents speak through it; ignore the suggestions and type the name. A message without the tag (for example a bare "approve all") is ignored.

Doctors speak English, as handovers and consultant dictation must be, with the short forms Indian wards use (pyelo, inj, KFT, RT feeds, "80 by 50"). Only the front desk speaks Hinglish, the way the OPD counter does.

| Person | Plays | Groups |
|---|---|---|
| Host (laptop) | **Dr. Suresh Menon**, consultant | all four |
| Member 2 | **Dr. Rahul Verma**, night PG | Lotus Ward, Lotus Escalations |
| Member 3 | **Anjali Desai**, front desk; in Lotus Pharmacy & Lab her account also moves pharmacy orders | Lotus OPD Desk, Lotus Pharmacy & Lab |

## Before the take (host)

1. `npm run db:reset` in the Pulse Flow folder, then refresh the browser.
2. Send `!reset-all-agents` in all four groups and wait for the replies.
3. Everyone posts once (for example `Hi`) in each group they'll use, so Switch knows them.

## The take

| # | Who | Group | Message | You'll see |
|---|---|---|---|---|
| 1 | Dr. Rahul | Lotus Ward | `@lotus-ward-scribe Handover to the day team. Bed 21 Fatima Khan, pyelo with AKI, on inj ceftriaxone 1 gram BD. Patient is stable, but BP at 2 AM was 80 by 50, pulse 104. Repeat BP at 4 AM and send KFT at 8 in the morning. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, taking orally well, discharge after Menon sir's round.` | One draft per bed; bed 21 critical because the BP overrode "stable". Lotus Escalations gets the alert. |
| 2 | Dr. Menon | Lotus Ward | `@lotus-ward-scribe Approve 21 and 7` | Both approved under Dr. Menon's name. |
| 3 | Dr. Menon | Lotus Ward | `@lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05. MAP is fine, so no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.` | The new plan: two new tasks, the registrar call stopped, waiting for the consultant. |
| 4 | Dr. Rahul | Lotus Ward | `@lotus-ward-scribe Approve ICU-2` | Refused: only the consultant approves rounds. |
| 5 | Dr. Menon | Lotus Ward | `@lotus-ward-scribe Approve ICU-2` | Approved. |
| 6 | Anjali | Lotus OPD Desk | `@lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678.` | Token GEN-005, Room 1, "send him straight in". Lotus Escalations gets an emergency alert. |
| 7 | Dr. Menon | web app | Sidebar → **OPD console** → Ramesh Kumar (GEN-002) → paste the prescription below → **Structure Rx** → **Sign** | Lotus Pharmacy & Lab: "Rx signed by Dr. Suresh Menon: GEN-002…" |
| 8 | Anjali | Lotus Pharmacy & Lab | `@lotus-fulfilment GEN-002 preparing` | GEN-002 preparing. |
| 9 | Anjali | Lotus Pharmacy & Lab | `@lotus-fulfilment GEN-002 ready, send the patient to counter 2` | GEN-002 ready, collect at counter 2. |
| 10 | Dr. Menon | web app | Sidebar → **Audit log** (opens as Deepak) → **Switch rooms** | Every agent action, under the person it acted for. |

Prescription for step 7: `Tab Pan 40 OD before breakfast for 14 days. Tab Paracetamol 650 SOS for fever. CBC and LFT. Review after 5 days.`

## If an agent doesn't answer

- The message must start with `@` and the full agent name, typed out.
- Send `!list-agents` in the group. Lotus Ward should list `lotus-ward-scribe`; Lotus OPD Desk `lotus-opd-desk`; Lotus Pharmacy & Lab `lotus-fulfilment`; Lotus Escalations `lotus-ward-scribe` and `lotus-opd-desk`.
- If one is missing, re-add it: Switch Console → Templates → import `switch/pulse-flow-telegram.template.yaml` → pick the four groups → Create. Then `!reset-all-agents` in every group.
- An older setup may still have `lotus-ward-coordinator`. Delete it in Switch Console; it no longer has any tools.
