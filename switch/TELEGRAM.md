# Running Pulse Flow on Telegram (3 people)

This is the exact setup for a three-person team recording the Flip the Switch demo on Telegram. Everything below runs on **one laptop** (the "host": Pulse Flow + Switch Console + the agents). The other two people only need Telegram on their phones.

Telegram works differently from Slack in one important way: **bots can't create groups.** You create the four groups in Telegram, add the Switch bot, and Switch turns each group into a room. That's why there's a separate [`pulse-flow-telegram.template.yaml`](./pulse-flow-telegram.template.yaml): it creates the agents and adds them to your groups, instead of creating rooms.

## The cast

One Telegram account is one staff member. Pick names that match the demo hospital's staff, so the agents recognise everyone without extra setup.

| Person | Telegram display name | Pulse Flow staff | Does in the demo |
|---|---|---|---|
| You (host) | **Dr. Suresh Menon** | `u-menon`, consultant | Gets the critical alert and the escalation, dictates rounds, signs the Rx in the web app |
| Member 2 | **Dr. Rahul Verma** | `u-rahul`, night PG | Hands over the night to the day PG |
| Member 3 | **Dr. Priya Raghavan** | `u-priya`, day PG (in Lotus Ward) | Takes the handover and approves it, closes the late task |

Member 3 also plays **Anjali Desai** (front desk) in Lotus OPD Desk and **Farhan Sheikh** (pharmacist) in Lotus Pharmacy & Lab. One mapping in `.env` covers all three roles (step 7), so nothing is remapped between scenes. Anjali is not in Lotus Ward.

## 1. Everyone: a Telegram username and a display name

Switch identifies people by their Telegram **@username**, so each of you needs one.

- **Set or change your username:** Telegram → Settings → *Edit* (or tap your profile) → **Username** → e.g. `rahul_pf_demo`. It must be unique on Telegram.
- **Rename your display name for the demo:** Settings → *Edit* → First name `Dr. Rahul`, Last name `Verma`. This is what everyone sees in the groups and on video. You can rename back after recording.

Send the host your three @usernames.

## 2. Host: create the Switch bot (2 minutes)

1. In Telegram, open **@BotFather** → send `/newbot` → display name `Lotus Ridge Hospital` → username ending in `bot`, e.g. `lotus_ridge_pf_bot`. **Copy the token**; BotFather shows it once.
2. **Turn off Group Privacy now, before adding the bot anywhere:** `/mybots` → your bot → *Bot Settings* → *Group Privacy* → **Turn off**. If you skip this, the bot only sees messages that tag it, and you'd have to remove and re-add it to every group.
3. Optional polish: `/mybots` → your bot → *Edit Bot* → *Edit Botpic* (the Pulse Flow logo from `public/`) and *Edit About*.
   - **Renaming the bot later:** `/mybots` → bot → *Edit Bot* → **Edit Name** changes the display name. The @username can't be changed; make a new bot if you need a new one.

## 3. Host: Pulse Flow and Switch Console

```bash
npm run setup            # Pulse Flow + demo hospital (see the main README)
npm run switch:setup     # writes the four agents' working folders; prints your pulse_flow_dir
```

Install [Switch Console](https://docs.switchagents.ai/switch-rooms/getting-started), choose **Set up a server on this computer**, and sign in to Claude Code when it asks (the agents are Claude Code sessions).

Connect Telegram: Switch Console → **Home** → **Messaging apps** → **Connect** → **Telegram** → paste the bot token and the bot username. Switch starts polling at once, so a bad token shows an error immediately.

## 4. Host: create the four groups (and how to rename them)

In Telegram, create four groups. Add the bot and both teammates to each (the host is in all of them):

| Group name | Members |
|---|---|
| **Lotus Ward** | you, Rahul, Priya (member 3), the bot |
| **Lotus Escalations** | you, the bot |
| **Lotus OPD Desk** | you, member 3 (as Anjali), the bot |
| **Lotus Pharmacy & Lab** | you, member 3 (as Farhan), the bot |

Telegram: *New Group* → pick members → name it. To **rename a group** later: open it → tap the group name at the top → **Edit** (pencil) → change the name → Save. Switch keeps the same room when you rename (it tracks the group, not the name), but rename *before* step 6 so the template's room picker shows the final names.

Then **each of you posts one message in Lotus Ward** (e.g. "hi"). Switch creates the room when the bot joins, and learns who's in it from the messages.

**Link your accounts:** Switch Console → Home → **Link account** (or *Messaging apps* → *Link my account*) → search your Telegram name → **This is me**. The host must do this. Teammates who can't open the Console: if an agent ignores them later, link them as server admin from the same screen.

## 5. Host: register the events agent

This is the agent Pulse Flow posts critical alerts, emergencies, signed prescriptions and the coordinator's nudges as. In the Switch Gateway (`SWITCH_URL` in your browser) → **API Keys** → create a key of type **registration**, then in `.env`:

```bash
SWITCH_URL=http://localhost:8008          # the server address Switch Console shows
SWITCH_REGISTRATION_KEY=...
```

```bash
npm run switch:register                   # prints SWITCH_AGENT_ID and SWITCH_AGENT_API_KEY → paste into .env
```

## 6. Host: create the agents (the template)

Switch Console → **Templates** → **Import** → `switch/pulse-flow-telegram.template.yaml`, then fill the form:

| Field | Value |
|---|---|
| team | `lotus` (agents become `lotus-ward-scribe`, `lotus-ward-coordinator`, `lotus-opd-desk`, `lotus-fulfilment`) |
| pulse_flow_dir | the path `npm run switch:setup` printed |
| events_agent | `pulse-flow-events` |
| Ward group / Escalations group / OPD desk group / Pharmacy & lab group | pick your four Telegram rooms |

**Create.** Switch makes the four Claude Code agents and adds each to its groups. Then add **pulse-flow-events** to all four rooms in Switch Console (each room → members → add agent).

Check in any group: send `!list-agents`. You should see the Pulse Flow agents for that group.

In Telegram there's one bot for all agents: **you talk to an agent by starting your message with @ and its name**, e.g. `@lotus-ward-scribe` followed by your handover. Replies arrive from the bot, prefixed with the agent's name.

## 7. Host: point Pulse Flow at the rooms, map the cast

Copy each room's id from Switch Console (room → details) into `.env`:

```bash
SWITCH_ROOM_WARD=...
SWITCH_ROOM_ESCALATIONS=...
SWITCH_ROOM_OPD=...
SWITCH_ROOM_FULFILMENT=...
SWITCH_COORDINATOR_AGENT=lotus-ward-coordinator
```

If your display names match the staff names (step 1), the agents already know who's who. To be safe, also map the @usernames:

```bash
PULSE_FLOW_CHAT_HANDLES=anupama_handle=u-menon,rahul_pf_demo=u-rahul,member3_handle=u-priya,member3_handle=u-anjali@opd-desk,member3_handle=u-farhan@fulfilment
```

`@opd-desk` and `@fulfilment` limit a mapping to that agent's group: member 3 is Dr. Priya in Lotus Ward, Anjali at the OPD desk and Farhan in the pharmacy. After editing `.env`, send `!reset-all-agents` in every group (agents read `.env` when they start).

Restart `npm run dev`. Open **Audit → Switch rooms** as Deepak (admin) to watch every post and agent action.

## 8. Run the demo: who types what

**Each person's exact lines, on one page: [DEMO-LINES.md](./DEMO-LINES.md).** Send it to your teammates.

**The one rule in chat:** to talk to an agent, start the message with `@` and its name. Everything else is ordinary chat between people, and agents ignore it.

| Who's who | |
|---|---|
| **Pulse Flow** (`pulse-flow-events`) | The hospital system. It posts alerts and, for the coordinator, a one-line "07:00 check" that wakes it. Nobody replies to it. |
| **Ward scribe** (`@lotus-ward-scribe`) | Turns a dictated handover or rounds note into drafts; files approvals. |
| **Ward coordinator** (`@lotus-ward-coordinator`) | Chases late tasks: asks the PG first, tells the consultant if it's still open next time. |
| **OPD desk** (`@lotus-opd-desk`) | Registers walk-ins. |
| **Fulfilment** (`@lotus-fulfilment`) | Moves pharmacy and lab orders. |

Before each take (don't run `--watch` while recording: it would post real-time checks in the middle):

```bash
npm run db:reset
npm run dev
```

**Scene 1: handover, night PG to day PG** (Lotus Ward)
- **Rahul types** (hold Wispr Flow, or paste):
  > @lotus-ward-scribe Handover to Dr. Priya. Bed 21 Fatima Khan, pyelo with AKI, on inj ceftriaxone 1 gram BD. Patient is stable, but BP at 2 AM was 80 by 50, pulse 104. Repeat BP at 4 AM and send KFT at 8 in the morning. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, taking orally well, discharge after Menon sir's round.
- **Scribe replies:** one short draft per bed, bed 21 marked critical (the BP overrode "stable"), ending with `Reply "approve 21", "approve all" or "discard 21".`
- **Lotus Escalations** gets one critical-patient line from Pulse Flow about bed 21, for Dr. Menon.
- **Priya types:** `@lotus-ward-scribe Approve 21 and 7` → **scribe:** both approved, under her name.

**Scene 2: a late task, then the consultant** (terminal, Lotus Ward, Lotus Escalations)

One task from the night is late: ICU-2's STAT blood gas, due at 6 AM.
- **You run:** `npm run switch:nudge -- --at 07:00`
- **Pulse Flow posts:** `@lotus-ward-coordinator 07:00 check: 1 late task.`
- **Coordinator posts** in Lotus Ward:
  > Dr. Rahul, ICU-2 Vikram Singh: STAT repeat ABG and lactate was due at 6 AM, now 1 hour late.
  > Reply "done ICU-2" once it's done.
- **Nobody replies** (Rahul is in casualty).
- **You run:** `npm run switch:nudge -- --at 08:00`. Still not done, so the coordinator tells the consultant in **Lotus Escalations**:
  > Dr. Menon, ICU-2 Vikram Singh: STAT repeat ABG and lactate, due 6 AM, still not done an hour after the reminder.
- **Priya types** in Lotus Ward once it's done: `@lotus-ward-coordinator ICU-2 ABG and lactate done, sample sent to lab` → **coordinator:** done by Dr. Priya.

**Scene 3: consultant rounds** (Lotus Ward)
- **You type:**
  > @lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05. MAP is fine, so no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.
- **Scribe replies:** the updated plan (new tasks, the registrar call stopped) and asks you to approve.
- **You type:** `@lotus-ward-scribe Approve ICU-2`. (If Rahul tries first, he's refused: only the consultant approves rounds.)

**Scene 4: walk-in** (Lotus OPD Desk)
- **Anjali (member 3) types:**
  > @lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678.
- **OPD desk replies:** token, room and doctor, and "send him straight in". **Lotus Escalations** gets an emergency alert from Pulse Flow, though nobody typed "emergency".

**Scene 5: pharmacy** (web app, then Lotus Pharmacy & Lab)
- In the web app, `/opd` as Dr. Rao → call next → dictate → sign. **Pulse Flow posts** the signed prescription in Lotus Pharmacy & Lab.
- **Farhan (member 3) types:** `@lotus-fulfilment DER-001 preparing`, then `@lotus-fulfilment DER-001 ready, send the patient to counter 2` → DER-001 ready.

**Scene 6: the record** — web app `/audit` → **Switch rooms** as Deepak: every agent action under the person it acted for.

## If something doesn't work

| Symptom | Fix |
|---|---|
| The bot sees nothing unless tagged | Group Privacy was on when it joined. Turn it off in BotFather, then remove and re-add the bot to each group. |
| An agent doesn't answer | Start the message with the agent's exact name (`!list-agents`). Switch Console must stay open: agents run inside it. |
| "doesn't match exactly one staff member" | Add the person's @username to `PULSE_FLOW_CHAT_HANDLES`, or set their Telegram display name to the staff name. |
| Alerts show `simulated` in Audit → Switch rooms | `SWITCH_URL`, `SWITCH_AGENT_ID`, `SWITCH_AGENT_API_KEY` or a `SWITCH_ROOM_*` is missing. Restart `npm run dev` after editing `.env`. |
| Alerts show `failed` | Read the error in Audit → Switch rooms. Usually the events agent isn't a member of that room (step 6). |
| Messages split in two | Telegram's 4,096-character limit. Dictate up to ~6 patients per message. |
| Two machines both polling | One bot token per Switch server. Make a second bot for a second laptop. |
