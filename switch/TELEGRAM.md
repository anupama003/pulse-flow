# Running Pulse Flow on Telegram (3 people)

This is the exact setup for a three-person team recording the Flip the Switch demo on Telegram. Everything below runs on **one laptop** (the "host": Pulse Flow + Switch Console + the agents). The other two people only need Telegram on their phones.

Telegram works differently from Slack in one important way: **bots can't create groups.** You create the four groups in Telegram, add the Switch bot, and Switch turns each group into a room. That's why there's a separate [`pulse-flow-telegram.template.yaml`](./pulse-flow-telegram.template.yaml): it creates the agents and adds them to your groups, instead of creating rooms.

## The cast

One Telegram account is one staff member. Pick names that match the demo hospital's staff, so the agents recognise everyone without extra setup.

| Person | Telegram display name | Pulse Flow staff | Does in the demo |
|---|---|---|---|
| You (host) | **Dr. Suresh Menon** | `u-menon`, consultant | Rounds feedback, approves notes, gets escalations, signs the Rx in the web app |
| Member 2 | **Dr. Rahul Verma** | `u-rahul`, night PG | Dictates the 3 AM handover, answers the coordinator's chase |
| Member 3 | **Anjali Desai** | `u-anjali`, front desk | Registers the walk-in, tries to approve a note (and is refused) |

The pharmacist's part ("DER-001 ready") is done in the web app at `/pharmacy` as Farhan, or by member 3 after you remap them (step 7).

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
| **Lotus Ward** | you, Rahul, Anjali, the bot |
| **Lotus Escalations** | you, the bot |
| **Lotus OPD Desk** | you, Anjali, the bot |
| **Lotus Pharmacy & Lab** | you, Anjali, the bot |

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

In Telegram there's one bot for all agents: **you talk to an agent by starting your message with its name**, e.g. `lotus-ward-scribe` followed by your handover. Replies arrive from the bot, prefixed with the agent's name.

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
PULSE_FLOW_CHAT_HANDLES=anupama_handle=u-menon,rahul_pf_demo=u-rahul,anjali_pf_demo=u-anjali
```

To let member 3 play the pharmacist for one scene, change `anjali_pf_demo=u-anjali` to `anjali_pf_demo=u-farhan` and restart the agents in Switch Console (they read `.env` when they start). Change it back afterwards. Do this between takes, not on camera: one person is one role.

Restart `npm run dev`. Open **Audit → Switch rooms** as Deepak (admin) to watch every post and agent action.

## 8. Run the demo

```bash
npm run db:reset                          # fresh demo hospital before each take
npm run dev
npm run switch:nudge -- --watch           # the coordinator's alarm clock (every 15 min, 8 AM brief)
```

1. **Lotus Ward, Rahul** (hold Wispr Flow, or paste):
   > lotus-ward-scribe Bed 21 Fatima Khan, pyelonephritis with AKI on IV ceftriaxone, she's stable, BP 80 by 50 at 2 AM, heart rate 104, recheck BP at 4 and repeat KFT at 8. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, eating well, discharge after consultant review.

   Two SBAR drafts appear; bed 21 is 🔴 because the vitals rule overrode "stable". **Lotus Escalations** gets the alert at the same time.
2. **Lotus Ward, Anjali**: `lotus-ward-scribe approve all` → refused: front desk can't approve clinical notes.
3. **Lotus Ward, you**: `lotus-ward-scribe approve all` → live on the ward screen, under your name.
4. **Coordinator:** run `npm run switch:nudge -- --at 06:45` (a follow-up check as if it were 6:45 this morning, when the demo hospital's night shift was ending). In Lotus Ward the coordinator asks **Dr. Rahul** by name: ICU-2's STAT ABG was due at 6 and is 45 min late, and bed P-4's draft has been waiting over an hour. Rahul replies:
   > lotus-ward-coordinator ICU-2 ABG and lactate done

   ✅ The task closes as Rahul. Run the same command again: the draft nobody approved is now "nudged 1× already", so the coordinator escalates it to you in **Lotus Escalations**. Add `--brief` to also post the ☀️ ward brief there.
5. **Lotus Ward, you** (rounds):
   > lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05, MAP fine now so drop the ICU registrar call, wean norad off by noon, start enteral feeds.

   A rounds draft that only you can approve (Rahul can try; he's refused). Approve it: the registrar-call task is stopped and the new ones appear on the ward screen.
6. **Lotus OPD Desk, Anjali**:
   > lotus-opd-desk walk-in Ramesh Patil 54 male, chest pain since morning and sweating, 9812345678, ok for WhatsApp

   A token, plus 🚨 in Escalations, though nobody typed "emergency".
7. **Web app** `/opd` as Dr. Rao (switch persona) → call next → dictate → sign. **Lotus Pharmacy & Lab** gets 🧾 and the fulfilment agent lists the order. As pharmacist: `lotus-fulfilment DER-001 preparing`, then `ready`.
8. **Web app** `/audit` → **Switch rooms** as Deepak: every agent action under the person it acted for.

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
