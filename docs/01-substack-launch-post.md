# The 3 AM WhatsApp Problem: How We Built Pulse Flow, a Voice-First Hospital OS, Without Touching a Keyboard

*Pulse Flow turns a tired doctor's voice into a structured clinical handover in seconds. We built it for the VMake Devs × Wispr "No Hands" hackathon, and we built it without typing.*

---

## It's 3 AM. Bed 14's potassium is 6.1.

The night-duty PG resident who knows that has been awake for 22 hours. She's admitted nine patients, run two codes and eaten half a samosa. In four hours she hands the ward to someone who has never met any of these patients.

How does that handover actually happen?

Not through the hospital management system. That's a 2009-era form with fourteen dropdowns, a session timeout and a login screen that hates you.

It happens on **WhatsApp**.

> *"bed 14 ramesh k+ 6.1 gave calcium gluconate insulin dextrose repeat kft at 6 also bed 9 fever spike 101 blood cultures sent pls f/u. bed 3 stable. bed 22 family wants to talk to cons. CHECK CBC AT 4AM bed 17"*

That's one message. Above it are 46 others: a meme, someone asking whose charger is in the duty room, a 2-minute-38-second voice note, a blurry photo of an ECG and three thumbs-up reactions.

Buried in there is "check CBC at 4 AM for bed 17." Nobody checks it.

## 80% of serious medical errors start here

This isn't a quirky Indian-hospital problem. It's the most dangerous moment in medicine, everywhere.

**An estimated 80% of serious medical errors involve miscommunication between caregivers during patient handovers** (Joint Commission estimate). It's not usually about bad drugs or bad surgeons. It's about bad *handoffs*: lost context, missing tasks, and a critical lab value that sat in a chat thread no one scrolled back to.

The fix has been known for decades. It's called **SBAR**:

- **S**ituation: what's happening right now
- **B**ackground: the clinical context
- **A**ssessment: what I think is going on
- **R**ecommendation: what needs to happen next

The WHO recommends it and every nursing school teaches it. Almost nobody uses it at 3 AM, because writing a clean SBAR note for 30 patients after a 24-hour shift takes about as much energy as running a marathon in a lead apron.

So doctors do what humans do. They take the path of least resistance, which is a chat app.

## The second failure point: morning rounds

At 9 AM the consultant sweeps through the ward. Twelve beds in forty minutes, with orders fired off at the bedside:

> *"Stop the ceftriaxone, start pip-taz. Get a repeat echo. If creatinine's still up tomorrow, nephro consult. And someone call the family."*

Four orders in eleven seconds. The junior resident is trying to hold a clipboard, a pen, a phone and their dignity while acting as a human stenographer. By bed 6 the orders from bed 2 are a blur.

**Two moments decide whether a patient gets what they need: the shift handover and the bedside round.** Both run on memory, scraps of paper and chat threads.

## Enter Pulse Flow

![Pulse Flow logo](../public/pulse-flow-logo.svg)

Pulse Flow is a voice-first hospital OS. It has one rule:

**Doctors never touch a keyboard.**

We built it on top of **Wispr Flow**, OS-level voice dictation that works in any text field. Hold a hotkey, talk like a human, release. The words land in the app, and Pulse Flow does the rest.

### Mode 1: The Shift Brain Dump

The night PG opens Pulse Flow, holds the Wispr key and just… talks.

> *"Okay so bed 14, Ramesh, 62 male, CKD stage 4, came in with hyperkalemia, potassium was 6.1 at 2 AM, I gave calcium gluconate and insulin-dextrose, repeat was 5.4, need a repeat KFT at 6. Bed 17, Lakshmi, post-op day 2 lap chole, she's fine but check CBC at 4 AM because Hb was borderline. Bed 9 spiked to 101.4, BP 88 over 54, heart rate 118, I sent blood cultures and started fluids, she needs to be seen first thing…"*

It's rambling and messy, the way people talk when they're exhausted. They're also the words of the person who knows these patients best.

They hit our backend, where an LLM running a locked-down **clinical extraction prompt** turns the ramble into:

- **One SBAR card per patient**, matched to the right bed
- **A to-do list**: "Repeat KFT at 6 AM, Bed 14", "CBC at 4 AM, Bed 17", each tagged with its patient, time and source
- **A critical flag**: Bed 9's BP of 88/54 and HR of 118 with fever trips `isCritical: true`, and the card *glows red* on the incoming doctor's dashboard

The extractor has one more rule we care about more than any feature: **it never invents medical data.** If you didn't say a value, it doesn't appear. If you said "BP was low-ish," it records "low-ish" and doesn't make up a number. A hallucinated potassium level is worse than a missing one.

### Mode 2: Live Rounds

The day PG carries a tablet on rounds. At each bed they tap the patient card and the **Live Rounds** sheet slides up. They hold the Wispr key and let the consultant talk.

The AI already has that patient's care plan: current SBAR plus open tasks. It **merges** the consultant's verbal orders into it:

- "Stop ceftriaxone" closes the matching open task
- "Start pip-taz" and "repeat echo" become new action items tagged `source: ROUNDS`
- "Nephro consult if creatinine still up" becomes a conditional task, kept as a condition and not turned into a confirmed order
- The Recommendation section updates to match

The ward checklist updates as the team walks to the next bed. Nobody needs a clipboard or a stenographer.

## The Action Board

Every task from every handover and every round flows into one **unified task list**: a sticky sidebar of pending items across the ward, each with a checkbox. Tap it and the item strikes through. Critical patients float to the top with pulsing rose-red borders. Stable patients get a calm emerald glow.

The incoming doctor doesn't scroll through 46 WhatsApp messages. They open one screen and see who's sick, what's pending and who said it.

## How it's built

We wanted this to feel like Linear, not like hospital software.

- **Next.js App Router** with **Server Actions**: the transcript goes straight from the textarea to a typed server function, with no API layer to babysit
- **Claude** with **schema-enforced structured outputs**: the model has to return JSON matching our SBAR schema, and Zod validates it again on our side before anything touches the database
- **PostgreSQL + Prisma** for handovers, SBAR notes, patients and action items, with every task traced back to the raw dictation it came from
- **Optimistic UI** with `useOptimistic` and `useTransition`: checkboxes strike through instantly and the server catches up
- **Tailwind + Framer Motion** for a dark, glassy interface built for a 3 AM ward and a sunlit corridor alike

Every SBAR card links back to the **raw transcript** it came from, shown side by side in the live review screen. The AI's output is a draft until a doctor has reviewed it. The doctor stays in charge, and the AI handles the paperwork.

## "I would use this every single day to leave work on time."

That's what one resident said after we put the prototype in front of them.

Not "this is cool" or "nice demo." They talked about **leaving work on time**, which is the real cost for doctors stuck on 14- to 24-hour shifts. Every minute spent writing handover notes is a minute not sleeping, not eating and not seeing family, and every task that gets lost in a chat is a risk to a patient.

## We built this without typing

Here's the meta part.

**This project was built hands-free.** The product spec, the architecture, the database schema, the clinical extraction prompt and the UI were all *spoken* through Wispr Flow to an AI coding partner, not typed. We used the same workflow we're asking doctors to trust: hold a key, think out loud, let the machine do the structuring.

If voice can carry a full-stack app from idea to working dashboard, it can carry a handover for 30 patients.

## What's next

- **HMS write-back**: push the reviewed SBAR notes into existing hospital systems so the record lives where the auditors look
- **Shift-change sign-off**: the incoming doctor acknowledges each handover, so there's a clear transfer of responsibility
- **Multilingual dictation**: Hinglish, Tamil-English and the code-switched mix real Indian wards actually speak
- **Privacy-first deployment**: on-prem and in-region options built for India's DPDP Act and hospital data policies

The keyboard was never the right interface for a doctor at 3 AM. Voice is how they already work, and now the software can keep up.

**Pulse Flow. Speak the handover. Leave on time.**

*(Formerly SBAR Sync. Same product, now covering the whole patient journey: booking, OPD, pharmacy, lab and WhatsApp.)*

---

*Built for the VMake Devs × Wispr "No Hands" Challenge. Pulse Flow is a prototype and not a certified medical device. Every AI-generated note needs clinician review before anyone acts on it.*
