// What people say and what the agents answer, scene by scene. Human lines are the demo lines in
// switch/DEMO-LINES.md. Agent replies are copied from the live Telegram run (shortened where long).

export const RAHUL = "Dr. Rahul Verma";
export const MENON = "Dr. Suresh Menon";
export const ANJALI = "Anjali Desai";
export const PF = "pulse-flow-events";

export const L = {
  handover:
    "@lotus-ward-scribe Handover to the day team. Bed 21 Fatima Khan, pyelo with AKI, on inj ceftriaxone 1 gram BD. Patient is stable, but BP at 2 AM was 80 by 50, pulse 104. Repeat BP at 4 AM and send KFT at 8 in the morning. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, taking orally well, discharge after Menon sir's round.",
  scribeStructuring: "Structuring the handover…",
  draft21:
    "Bed 21 · Fatima Khan — CRITICAL\nBP 80/50 at 2 AM, HR 104. Said \"stable\": the vitals rule overrode it.\nTasks: repeat BP at 4 AM · KFT at 8 AM",
  draft7: "Bed 7 · Meera Iyer\nDKA resolved, sugars 140–180 on basal-bolus, eating well.\nTask: discharge after consultant review\n\nReply \"approve 21\", \"approve all\" or \"discard 21\".",
  critAlert: "Critical: Bed 21, Fatima Khan. BP 80/50. The doctor didn't call it critical; the vitals rule did.\nFrom Dr. Rahul Verma's handover. The draft is waiting for a doctor's approval in the ward room.",
  menonApprove21: "@lotus-ward-scribe Approve 21 and 7",
  scribeApproved: "Approved under Dr. Suresh Menon's name:\nBed 21 · Fatima Khan\nBed 7 · Meera Iyer",

  nudge0700: "@lotus-ward-coordinator 07:00 check: 1 late task.",
  remind: "Dr. Rahul, ICU-2 Vikram Singh: STAT repeat ABG and lactate was due at 6 AM, now 1 hour late.\nReply \"done ICU-2\" once it's done.",
  nudge0800: "@lotus-ward-coordinator 08:00 check: 1 late task.",
  escalate: "Dr. Menon, ICU-2 Vikram Singh: STAT repeat ABG and lactate, due 6 AM, still not done an hour after the reminder to Dr. Rahul.",
  rahulDone: "@lotus-ward-coordinator ICU-2 ABG and lactate done, sample sent to lab",
  coordDone: "ICU-2 ABG and lactate, done by Dr. Rahul Verma.",

  rounds:
    "@lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05. MAP is fine, so no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.",
  roundsPlan:
    "ICU-2 · Vikram Singh — rounds draft\n+ Wean off noradrenaline by 12 noon\n+ Start RT feeds\n− Call ICU registrar if MAP < 65 (stopped)\nOnly Dr. Menon can approve this plan.",
  rahulApprove: "@lotus-ward-scribe Approve ICU-2",
  refused: "Only the consultant can approve a rounds plan. Dr. Menon, reply \"approve ICU-2\" when you're ready.",
  menonApprove: "@lotus-ward-scribe Approve ICU-2",
  roundsApproved: "ICU-2 rounds plan approved by Dr. Suresh Menon. Registrar call stopped; 2 new tasks on the ward.",

  walkIn: "@lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678.",
  token: "Registered Ramesh Patil, 54 M, in General Medicine.\nToken GEN-005 · Room 2 · Dr. Suresh Menon\nChest pain with sweating is a red flag: send him straight in.",
  emergency: "Emergency at the front desk: GEN-005, Ramesh Patil (54y), General Medicine. Red flags: chest pain, sweating. Moved to the top of the queue; a doctor needs to see him now.",

  rxDictation: "Tab Pan 40 OD before breakfast for 14 days. Tab Paracetamol 650 SOS for fever. CBC and LFT. Review after 5 days.",
  rxSigned: "Rx signed by Dr. Suresh Menon: GEN-002 · Ramesh Kumar. 2 medicines for pharmacy; lab: CBC, LFT.",
  anjaliPreparing: "@lotus-fulfilment GEN-002 preparing",
  preparingOk: "GEN-002 · Ramesh Kumar: preparing.",
  anjaliReady: "@lotus-fulfilment GEN-002 ready, send the patient to counter 2",
  readyOk: "GEN-002 · Ramesh Kumar: ready for pickup at counter 2.",
};
