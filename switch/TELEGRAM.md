# Running Pulse Flow on Telegram (3 people)

This is the exact setup for a three-person team recording the Flip the Switch demo on Telegram. Everything below runs on **one laptop** (the "host": Pulse Flow + Switch Console + the agents). The other two people only need Telegram on their phones.

Telegram works differently from Slack in one important way: **bots can't create groups.** You create the four groups in Telegram, add the Switch bot, and Switch turns each group into a room. That's why there's a separate [`pulse-flow-telegram.template.yaml`](./pulse-flow-telegram.template.yaml): it creates the agents and adds them to your groups, instead of creating rooms.

## The cast

One Telegram account is one staff member. Pick names that match the demo hospital's staff, so the agents recognise everyone without extra setup.

| Person | Telegram display name | Pulse Flow staff | Does in the demo |
|---|---|---|---|
| You (host) | **Dr. Suresh Menon** | `u-menon`, consultant | Gets the critical alert, approves the handover, dictates and approves rounds, signs the Rx in the web app |
| Member 2 | **Dr. Rahul Verma** | `u-rahul`, night PG | Hands over the night; tries to approve the rounds and is refused |
| Member 3 | **Anjali Desai** | `u-anjali`, front desk | Registers the walk-in in Lotus OPD Desk; moves the pharmacy order in Lotus Pharmacy & Lab |

In Lotus Pharmacy & Lab, Anjali's account also moves pharmacy orders: one mapping in `.env` makes her the pharmacist (Farhan, `u-farhan`) there and only there (step 7), so nothing is remapped between scenes. Anjali is not in Lotus Ward or Lotus Escalations.

Doctors speak English, with Indian ward shorthand ("pyelo", "inj", "KFT", "80 by 50", "Menon sir's round"). Only the front desk speaks Hinglish, at the OPD counter. Pharmacy lines are English.

## 1. Everyone: a Telegram username and a display name

Switch identifies people by the Telegram **@username** it sees on their first message, so each of you needs one before you post anything. Renaming your display name later doesn't change it.

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
npm run switch:setup     # writes the three agents' working folders; prints your pulse_flow_dir
```

Install [Switch Console](https://docs.switchagents.ai/switch-rooms/getting-started), choose **Set up a server on this computer**, and sign in to Claude Code when it asks (the agents are Claude Code sessions).

Connect Telegram: Switch Console → **Home** → **Messaging apps** → **Connect** → **Telegram** → paste the bot token and the bot username. Switch starts polling at once, so a bad token shows an error immediately.

## 4. Host: create the four groups (and how to rename them)

In Telegram, create four groups. Add the bot and the teammates listed below (the host is in all of them):

| Group name | Members |
|---|---|
| **Lotus Ward** | you, Rahul, the bot |
| **Lotus Escalations** | you, Rahul, the bot |
| **Lotus OPD Desk** | you, Anjali, the bot |
| **Lotus Pharmacy & Lab** | you, Anjali, the bot |

Telegram: *New Group* → pick members → name it. To **rename a group** later: open it → tap the group name at the top → **Edit** (pencil) → change the name → Save. Switch keeps the same room when you rename (it tracks the group, not the name), but rename *before* step 6 so the template's room picker shows the final names.

Then **each of you posts one message in every group you're in** (e.g. "hi"). Switch creates the room when the bot joins, and learns who's in it from the messages.

**Link your accounts:** Switch Console → Home → **Link account** (or *Messaging apps* → *Link my account*) → search your Telegram name → **This is me**. The host must do this. Teammates who can't open the Console: if an agent ignores them later, link them as server admin from the same screen.

## 5. Host: register the events agent

This is the agent Pulse Flow posts as: critical patients and emergencies in Lotus Escalations, signed prescriptions in Lotus Pharmacy & Lab. In the Switch Gateway (`SWITCH_URL` in your browser) → **API Keys** → create a key of type **registration**, then in `.env`:

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
| team | `lotus` (agents become `lotus-ward-scribe`, `lotus-opd-desk`, `lotus-fulfilment`) |
| pulse_flow_dir | the path `npm run switch:setup` printed |
| events_agent | `pulse-flow-events` |
| Ward group / Escalations group / OPD desk group / Pharmacy & lab group | pick your four Telegram rooms |

**Create.** Switch makes the three Claude Code agents and adds each to its groups: `lotus-ward-scribe` to Lotus Ward and Lotus Escalations, `lotus-opd-desk` to Lotus OPD Desk and Lotus Escalations, `lotus-fulfilment` to Lotus Pharmacy & Lab. Then add **pulse-flow-events** to the rooms in Switch Console (each room → members → add agent).

If an older setup still has a `lotus-ward-coordinator` agent in Switch Console, delete it there. It no longer has tools.

Check in any group: send `!list-agents`. You should see the Pulse Flow agents for that group.

In Telegram there's one bot for all agents: **you talk to an agent by starting your message with @ and its name**, e.g. `@lotus-ward-scribe` followed by your handover. Replies arrive from the bot, prefixed with the agent's name. Because every agent speaks through that one bot, Telegram's @ suggestions only show the bot: type `@lotus-ward-scribe` (or the other names) in full.

## 7. Host: point Pulse Flow at the rooms, map the cast

Copy each room's id from Switch Console (room → details) into `.env`:

```bash
SWITCH_ROOM_WARD=...
SWITCH_ROOM_ESCALATIONS=...
SWITCH_ROOM_OPD=...
SWITCH_ROOM_FULFILMENT=...
```

If your display names match the staff names (step 1), the agents already know who's who. To be safe, also map the @usernames:

```bash
PULSE_FLOW_CHAT_HANDLES=<host_handle>=u-menon,<rahul_handle>=u-rahul,<anjali_handle>=u-anjali,<anjali_handle>=u-farhan@fulfilment
```

An `@agent` suffix limits a mapping to that agent's group: `@fulfilment` makes Anjali the pharmacist (Farhan) in Lotus Pharmacy & Lab only; everywhere else she's the front desk. Use the @usernames Switch saw on each person's first message (step 1). After editing `.env`, send `!reset-all-agents` in every group (agents read `.env` when they start).

Restart `npm run dev`. Open **Audit → Switch rooms** as Deepak (admin) to watch every post and agent action.

## 8. Run the demo: who types what

**Each person's exact lines, on one page: [DEMO-LINES.md](./DEMO-LINES.md).** Send it to your teammates.

**The one rule in chat:** every message to an agent must start with `@` and its full name. Everything else is ordinary chat between people, and agents ignore it: an untagged "approve all" does nothing.

| Who's who | |
|---|---|
| **Pulse Flow** (`pulse-flow-events`) | The hospital system. It posts critical patients and emergencies in Lotus Escalations and signed prescriptions in Lotus Pharmacy & Lab. Nobody replies to it. |
| **Ward scribe** (`@lotus-ward-scribe`) | Turns a dictated handover into one SBAR draft per bed and flags critical patients; turns consultant rounds into a care-plan draft only the consultant can approve; files approvals. |
| **OPD desk** (`@lotus-opd-desk`) | Registers walk-ins, gives tokens, flags red flags. |
| **Fulfilment** (`@lotus-fulfilment`) | Moves pharmacy and lab orders. |

Before each take:

```bash
npm run db:reset
npm run dev
```

Then send `!reset-all-agents` in all four groups, and have each person post once in each group they'll use.

**Scene 1: handover** (Lotus Ward, Lotus Escalations)
- **Rahul types** (hold Wispr Flow, or paste):
  > @lotus-ward-scribe Handover to the day team. Bed 21 Fatima Khan, pyelo with AKI, on inj ceftriaxone 1 gram BD. Patient is stable, but BP at 2 AM was 80 by 50, pulse 104. Repeat BP at 4 AM and send KFT at 8 in the morning. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, taking orally well, discharge after Menon sir's round.
- **Scribe replies:** one short draft per bed. Bed 21 is critical because the vitals rule overrode "stable":
  > 🔴 Critical on vitals: BP 80/50, pulse 104. ⚠️ Called stable against those vitals — confirm.
- **Lotus Escalations** gets a critical-patient alert from Pulse Flow about bed 21, for Dr. Menon.
- **You type:** `@lotus-ward-scribe Approve 21 and 7` → **scribe:** both approved, under your name.

**Scene 2: consultant rounds** (Lotus Ward)
- **You type:**
  > @lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05. MAP is fine, so no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.
- **Scribe replies:** a rounds draft (new tasks, the "call ICU registrar" task stopped) that only the consultant can approve.
- **Rahul types:** `@lotus-ward-scribe Approve ICU-2` → refused:
  > ICU-2 · Vikram Singh — not approved. The draft is a rounds note from Dr. Suresh Menon, and rounds orders need the consultant's sign-off.
- **You type:** `@lotus-ward-scribe Approve ICU-2` →
  > ✅ ICU-2 · Vikram Singh — rounds note approved by Dr. Suresh Menon. New tasks: wean off noradrenaline by 12 noon, start RT feeds. The "call ICU registrar if MAP under 65" task is stopped.

**Scene 3: walk-in** (Lotus OPD Desk)
- **Anjali types:**
  > @lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678.
- **OPD desk replies:**
  > 🔴 GEN-005 Ramesh Patil, General Medicine, Room 1, Dr. Suresh Menon. Chest pain flagged — send him straight in, don't make him wait.
- **Lotus Escalations** gets an emergency alert from Pulse Flow, though nobody typed "emergency".

**Scene 4: pharmacy** (web app, then Lotus Pharmacy & Lab)
- In the web app: sidebar → **OPD console** → **Ramesh Kumar (GEN-002)** → paste:
  > Tab Pan 40 OD before breakfast for 14 days. Tab Paracetamol 650 SOS for fever. CBC and LFT. Review after 5 days.

  → **Structure Rx** → **Sign**. **Pulse Flow posts** "Rx signed by Dr. Suresh Menon: GEN-002 · Ramesh Kumar…" in Lotus Pharmacy & Lab.
- **Anjali types:** `@lotus-fulfilment GEN-002 preparing` → `✅ GEN-002 Ramesh Kumar — preparing`
- Then: `@lotus-fulfilment GEN-002 ready, send the patient to counter 2` → `✅ GEN-002 Ramesh Kumar — ready, collect at counter 2`

**Scene 5: the record:** sidebar → **Audit log** (opens as Deepak, facility admin) → **Switch rooms**: every agent action under the person it acted for.


## If something doesn't work

| Symptom | Fix |
|---|---|
| The bot sees nothing unless tagged | Group Privacy was on when it joined. Turn it off in BotFather, then remove and re-add the bot to each group. |
| An agent doesn't answer | Start the message with the agent's full name, typed out (Telegram's @ suggestions only show the bot; `!list-agents` shows the names). Switch Console must stay open: agents run inside it. |
| An agent is missing from a group | Switch Console → **Templates** → import `switch/pulse-flow-telegram.template.yaml` → pick the four groups → **Create**. |
| "doesn't match exactly one staff member" | Add the person's @username to `PULSE_FLOW_CHAT_HANDLES`, or set their Telegram display name to the staff name. |
| Alerts show `simulated` in Audit → Switch rooms | `SWITCH_URL`, `SWITCH_AGENT_ID`, `SWITCH_AGENT_API_KEY` or a `SWITCH_ROOM_*` is missing. Restart `npm run dev` after editing `.env`. |
| Alerts show `failed` | Read the error in Audit → Switch rooms. Usually the events agent isn't a member of that room (step 6). |
| Messages split in two | Telegram's 4,096-character limit. Dictate up to ~6 patients per message. |
| Two machines both polling | One bot token per Switch server. Make a second bot for a second laptop. |
