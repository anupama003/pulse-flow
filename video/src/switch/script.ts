// What people said and what the agents answered, copied from the live Telegram take on 7 Nov 2026
// (Switch room history). Two exceptions, both marked: the handover's first words name the day team
// instead of a colleague who isn't in the demo, and the coordinator's reminder and escalation use
// the wording of its earlier live run, because its session didn't answer the check in this take.

export const RAHUL = "Dr. Rahul Verma";
export const MENON = "Dr. Suresh Menon";
export const ANJALI = "Anjali Desai";
export const PF = "pulse-flow-events";

export const L = {
  handover:
    "@lotus-ward-scribe Handover to the day team. Bed 21 Fatima Khan, pyelo with AKI, on inj ceftriaxone 1 gram BD. Patient is stable, but BP at 2 AM was 80 by 50, pulse 104. Repeat BP at 4 AM and send KFT at 8 in the morning. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, taking orally well, discharge after Menon sir's round.",
  scribeStructuring: "Structuring the handover…",
  draft21:
    "🔴 Bed 21 · Fatima Khan\nS: Patient is stable, but BP at 2 AM was 80/50, pulse 104.\nB: Pyelo with AKI, on inj ceftriaxone 1 g BD.\nA: Stable per handover, despite BP 80/50 and pulse 104.\nR: Repeat BP at 4 AM, send KFT at 8 AM.\n🔴 Critical on vitals: BP 80/50, pulse 104. ⚠️ Called stable against those vitals — confirm.",
  draft7:
    "📝 Bed 7 · Meera Iyer\nS: DKA resolved, sugars 140–180 on basal-bolus, taking orally well.\nR: Discharge after Menon sir's round.\nReply \"approve 7\", \"approve 21\", \"approve all\" or \"discard 7\".",
  critAlert: "🔴 Critical: Bed 21, Fatima Khan. BP at 2 AM was 80 by 50, pulse 104.\nFrom Dr. Rahul Verma's handover. The SBAR draft is waiting for a doctor to approve it in the ward room.",
  scribeEsc: "🔴 Bed 21 · Fatima Khan — BP 80/50 and pulse 104 at 2 AM, handed over as stable.\nDraft is waiting for a doctor's approval in the ward room.",

  nudge0700: "@lotus-ward-coordinator 07:00 check: 1 late task.",
  remind: "Dr. Rahul, 1 thing from the night:\n⏰ ICU-2 Vikram Singh: STAT repeat ABG and lactate, due 6 AM, 1 hour late.\nReply \"done ICU-2\" when the ABG is done.",
  nudge0800: "@lotus-ward-coordinator 08:00 check: 1 late task.",
  escalate: "Dr. Menon, still open after a reminder to Dr. Rahul:\n⏰ ICU-2 Vikram Singh: STAT repeat ABG and lactate, due 6 AM.",
  rahulDone: "@lotus-ward-coordinator ICU-2 ABG and lactate done, sample sent to lab",
  coordDone: "✅ ICU-2 Vikram Singh: ABG and lactate, done by Dr. Rahul Verma.",

  rounds:
    "@lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05. MAP is fine, so no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.",
  roundsPlan:
    "ICU-2 · Vikram Singh — rounds draft\nS: BP better at 96/60 on norad 0.05, MAP fine.\nR: Wean off norad by 12 noon, start RT feeds.\nNew: wean off norad by 12 noon; start RT feeds. Stopped: call ICU registrar if MAP under 65. Only the consultant's approval counts — reply \"approve ICU-2\".",
  rahulApprove: "@lotus-ward-scribe Approve ICU-2",
  refused:
    "ICU-2 · Vikram Singh — not approved.\nThe draft is a rounds note from Dr. Suresh Menon, and rounds orders need the consultant's sign-off.\n📝 Still waiting: wean off noradrenaline by 12 noon, start RT feeds.",
  menonApprove: "@lotus-ward-scribe Approve ICU-2",
  roundsApproved:
    "✅ ICU-2 · Vikram Singh — rounds note approved by Dr. Suresh Menon.\nNew tasks: wean off noradrenaline by 12 noon, start RT feeds.\nThe \"call ICU registrar if MAP under 65\" task is stopped.",

  walkIn: "@lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678.",
  token:
    "🔴 GEN-005 Ramesh Patil, General Medicine, Room 1, Dr. Suresh Menon.\nChest pain flagged — send him straight in, don't make him wait.\nNo cardiology OPD here, so General Medicine first.",
  emergency: "🚨 Emergency at the front desk: GEN-005, Ramesh Patil (54y), General Medicine. Red flags: Chest pain or pressure. Moved to the top of the queue; a doctor needs to see them now.",
  opdEsc: "🔴 GEN-005 Ramesh Patil, 54M — chest pain since morning with sweating. Walk-in, red flag.\nFor Dr. Suresh Menon, General Medicine, Room 1. Patient being sent in now, not queued.",

  rxDictation: "Tab Pan 40 OD before breakfast for 14 days. Tab Paracetamol 650 SOS for fever. CBC and LFT. Review after 5 days.",
  rxSigned: "🧾 Rx signed by Dr. Suresh Menon: GEN-002 · Ramesh Kumar. 2 medicines for pharmacy; lab: CBC, LFT.",
  anjaliPreparing: "@lotus-fulfilment GEN-002 preparing",
  preparingOk: "✅ GEN-002 Ramesh Kumar — preparing",
  anjaliReady: "@lotus-fulfilment GEN-002 ready, send the patient to counter 2",
  readyOk: "✅ GEN-002 Ramesh Kumar — ready, collect at counter 2",
};
