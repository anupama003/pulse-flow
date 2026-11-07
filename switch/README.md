# Pulse Flow on Switch

Indian hospitals already run on chat. The night PG hands over twelve patients in the ward WhatsApp group at 3 AM, the front desk messages the doctor about a walk-in with chest pain, and the pharmacist asks "is GAS-014's Rx signed yet?" in another group. It works until it doesn't: a "stable" patient with a BP of 80/50 gets buried under forty messages, nothing is tied to a patient record, and there's no audit trail.

[Switch](https://www.switchagents.ai) turns a team's chat channels into rooms where people and AI agents work together. This folder puts **four Pulse Flow agents** into the hospital's own chat app (Slack, Discord, Telegram, Mattermost or Teams) so the team keeps chatting the way it already does, but every message that matters becomes a structured, approved, audit-logged record.

```
 Chat app (Slack / Discord / Telegram / Mattermost / Teams)
 ┌──────────────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────────┐
 │ #lotus-ward  │ │ #lotus-       │ │ #lotus-      │ │ #lotus-      │
 │              │ │  escalations  │ │  opd-desk    │ │  fulfilment  │
 │ PGs · ward-  │ │ consultants · │ │ front desk · │ │ pharmacy ·   │
 │ scribe       │ │ ward-scribe · │ │ opd-desk     │ │ lab ·        │
 │              │ │ opd-desk      │ │              │ │ fulfilment   │
 └──────┬───────┘ └───────▲───────┘ └──────┬───────┘ └──────▲───────┘
        │   Switch rooms (mirrored)  ▲  links ▲              │
        ▼                            │        │              │
 Claude Code agents (Switch Console) │        │              │
        │ MCP: pulse-flow tools      │        │              │
        ▼                            │        │              │
 Pulse Flow (Next.js + Postgres) ────┴── room events ────────┘
 RBAC · tenancy · DPDP audit log · clinical rules · drafts → human approval
```

## What each agent does

| Agent | Room(s) | People say… | The agent… |
|---|---|---|---|
| **ward-scribe** | ward, escalations | A whole shift handover, dictated with Wispr Flow; or a consultant's rounds feedback ("ICU-2: wean the norad, stop the 6 AM ABG") | Calls `submit_handover` / `submit_rounds`, posts one SBAR draft per bed with 🔴 critical flags (including ones the vitals rule caught when the doctor said "stable"), waits for "approve 7" / "approve all" from a doctor (rounds: only the consultant), then calls `approve_handover_note` as that doctor. Escalates critical beds to consultants. |
| **ward-coordinator** | ward, escalations | (Pulse Flow wakes it every 15 min with what's late) | The charge nurse who chases: asks the PG on duty by name about late tasks and waiting notes, escalates to the patient's consultant if nobody acted after the first nudge, closes a task when someone says it's done. Never decides anything clinical. |
| **opd-desk** | opd-desk, escalations | "walk-in Ramesh Patil 54 male, chest pain since morning" | Picks the department, asks for anything missing, calls `register_walk_in`, replies with the token and room. Pulse Flow re-screens red flags itself, so an emergency is escalated even if the agent called it routine. |
| **fulfilment** | fulfilment | "GAS-014 ready", "CBC for GAS-014 sample collected" | Moves pharmacy and lab orders along their allowed steps, as the person who said it. Reacts to Pulse Flow's "🧾 Rx signed" posts by listing the new order with allergies. |
| **pulse-flow-events** | all four | (nobody; it's Pulse Flow itself) | Posts 🔴 critical patients, 🚨 emergency walk-ins and 🧾 signed prescriptions into the right room as they happen, from the web app or from another agent; wakes the coordinator (`npm run switch:nudge`) and posts the consultant's ☀️ 8 AM ward brief. |

The web app and the agents share one code path ([`lib/ward/handover.ts`](../lib/ward/handover.ts), [`lib/ward/rounds.ts`](../lib/ward/rounds.ts), [`lib/opd/walk-in.ts`](../lib/opd/walk-in.ts)), so a handover dictated on the ward screen and one posted in the ward room produce the same drafts and the same alerts.

## Safety model: agents act *for* people, never *as* themselves

- **Every tool takes `actor`**, the chat name of the person who asked. Pulse Flow resolves it to one staff member in the agent's facility ([`lib/agents/actor.ts`](../lib/agents/actor.ts)), ambiguous names are refused, and that person's role decides what's allowed. A pharmacist can't approve a handover through an agent any more than in the web app.
- **Least privilege twice:** each agent only gets its own tools (`PULSE_FLOW_TOOLS`, set by [`toolsets.ts`](./toolsets.ts)), and every tool also checks the person's role.
- **AI drafts, clinicians decide.** Handover notes stay `DRAFT` until a doctor approves them in the room. Prescriptions are never signed by an agent: that stays in the OPD console with the consultant's HPR ID.
- **Deterministic rules run after any model.** Whether Pulse Flow's server LLM or the agent's own Claude Code structured the handover, [`lib/sbar/clinical-rules.ts`](../lib/sbar/clinical-rules.ts) re-reads the vitals and overrides "stable" when SBP < 90, SpO₂ < 92 %, K⁺ ≥ 6 and so on.
- **Everything is audit-logged** under the human, with the agent as the route (`switch:ward-scribe`). See **Audit → Switch rooms** in the web app.
- **Tenant isolation:** each agent is pinned to one facility (`PULSE_FLOW_FACILITY`); it can't resolve or read another branch's staff or patients.

## Set it up (about 15 minutes)

> **On Telegram?** Follow [TELEGRAM.md](./TELEGRAM.md) instead: Telegram groups have to be created by people, so it uses [`pulse-flow-telegram.template.yaml`](./pulse-flow-telegram.template.yaml), and the guide covers a three-person cast, renaming, and creating the agents step by step.

**You need:** Pulse Flow running locally (`npm run setup`, see the main [README](../README.md)), [Switch Console](https://docs.switchagents.ai/switch-rooms/getting-started) with Claude Code signed in, and a chat app connected in Switch Console (Slack, Discord, Telegram, Mattermost or Teams). No Gemini key is needed for the agents: Claude Code structures the handover itself when the server has no AI key.

1. **Write the agents' working folders.**
   ```bash
   npm run switch:setup
   ```
   This creates `switch/agents/{ward-scribe,ward-coordinator,opd-desk,fulfilment}/` with a `.mcp.json` that starts Pulse Flow's tool server, a `.claude/settings.json` that pre-approves only that agent's tools, and the shared [agent rules](./agent-rules.md) as `CLAUDE.md`. It prints the path you'll need in step 3.

2. **Register the events agent** (what Pulse Flow posts as). In Switch's Gateway, create an API key of type *registration*, then add to `.env`:
   ```bash
   SWITCH_URL=http://localhost:8008        # your Switch server address, as Switch Console shows it
   SWITCH_REGISTRATION_KEY=...
   ```
   and run:
   ```bash
   npm run switch:register
   ```
   Copy the printed `SWITCH_AGENT_ID` and `SWITCH_AGENT_API_KEY` into `.env`.

3. **Deploy the rooms.** In Switch Console, import [`pulse-flow-hospital.template.yaml`](./pulse-flow-hospital.template.yaml). Set `team` (e.g. `lotus`), `pulse_flow_dir` (the path from step 1) and your chat app. Switch creates the four agents, four rooms, their links and a "How this room works" doc in the ward room. Each agent says hello.

4. **Point Pulse Flow's alerts at the rooms.** Put the room ids Switch Console shows into `.env`:
   ```bash
   SWITCH_ROOM_WARD=...
   SWITCH_ROOM_ESCALATIONS=...
   SWITCH_ROOM_OPD=...
   SWITCH_ROOM_FULFILMENT=...
   ```
   Also set `SWITCH_COORDINATOR_AGENT=lotus-ward-coordinator` (your `team` + `-ward-coordinator`), then start the coordinator's clock:
   ```bash
   npm run switch:nudge -- --watch    # a follow-up check every 15 min, the ward brief at 08:00 IST
   ```
   Restart `npm run dev`. Until these are set, alerts are *simulated*: built and shown in **Audit → Switch rooms**, not sent.

5. **Map chat names to staff** if they don't match the demo staff names (they won't, on your own Slack):
   ```bash
   PULSE_FLOW_CHAT_HANDLES=anupama=u-menon,teammate=u-rahul
   ```
   Staff ids are in [`lib/fixtures.ts`](../lib/fixtures.ts): `u-rahul` night PG, `u-priya` day PG, `u-menon` consultant, `u-anjali` front desk, `u-farhan` pharmacist, `u-kavya` lab.

## Try it: a 3-minute script

1. **#lotus-ward**, as the night PG, hold the Wispr Flow key and say (or paste):
   > Bed 21 Fatima Khan, pyelonephritis with AKI on IV ceftriaxone, she's stable, BP 80 by 50 at 2 AM, heart rate 104, recheck BP at 4 and repeat KFT at 8. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, eating well, discharge after consultant review.

   The ward scribe posts two SBAR drafts. Bed 21 is 🔴 critical: "the doctor said stable; the vitals rule overrode it." **#lotus-escalations** gets the alert at the same moment.
2. As the day PG, reply **approve all**. The notes go live on the ward screen (`/`) and the tasks appear. Try it as the front desk first: the agent tells you your role can't approve.
3. **#lotus-opd-desk**: "walk-in Ramesh Patil 54 male, chest pain since morning and sweating". You get a token, and 🚨 lands in escalations, even though nobody typed "emergency".
4. In the web app, sign a prescription in `/opd` as a consultant. **#lotus-fulfilment** gets 🧾 "Rx signed…", and the fulfilment agent lists the medicines with allergies. For an order already in the queue, reply "DER-001 preparing", then "DER-001 ready" as the pharmacist; try "DER-001 dispensed" straight from queued and the agent tells you the next allowed step.
5. Run `npm run switch:nudge -- --at 06:45` (a check as if it were 6:45 this morning, when the demo hospital's night shift was ending). The coordinator asks the night PG by name about ICU-2's STAT ABG (due 6, 45 min late) and a draft waiting over an hour. Reply "ICU-2 ABG and lactate done" as the PG → ✅. Then run `npm run switch:nudge -- --at 07:15` (half an hour later; the coordinator won't escalate a reminder sent seconds ago): the untouched draft is escalated to the consultant. Add `--brief` for the ☀️ ward brief in escalations.
6. **#lotus-ward**, as the consultant: "ICU-2 rounds: BP better at 96 by 60 on norad 0.05, MAP fine now so drop the ICU registrar call, wean norad off by noon, start enteral feeds." A rounds draft only the consultant can approve; approving it stops the registrar-call task.
7. Open **Audit → Switch rooms** as Deepak (facility admin): every post and every agent action, under the person it acted for.

## Check it without a Switch server

```bash
npm run test:switch   # 25 unit tests: room messages, the Switch protocol request, actor matching, deadlines and nudges, templates in sync
npm run test:agents   # 13 integration tests on a seeded DB: RBAC, rounds, coordinator, the real MCP server over stdio
npm run switch:mcp    # start the tool server by hand (it waits for an MCP client on stdin)
```

## Files

| | |
|---|---|
| [`pulse-flow-hospital.template.yaml`](./pulse-flow-hospital.template.yaml) | Switch template: agents, rooms, links, room doc (Slack, Discord, Mattermost, Teams) |
| [`pulse-flow-telegram.template.yaml`](./pulse-flow-telegram.template.yaml) · [`TELEGRAM.md`](./TELEGRAM.md) | Telegram: the same agents joining groups you create (generated by `npm run switch:templates`) |
| [`nudge.ts`](./nudge.ts) · [`../lib/ward/followups.ts`](../lib/ward/followups.ts) | `npm run switch:nudge`: what's late, the coordinator's wake-up, the ward brief |
| [`agent-rules.md`](./agent-rules.md) | Rules every Pulse Flow agent follows (copied as `CLAUDE.md`) |
| [`mcp/server.ts`](./mcp/server.ts) | Pulse Flow tool server (MCP, stdio) |
| [`toolsets.ts`](./toolsets.ts) | Which tools each agent gets |
| [`setup.ts`](./setup.ts) · [`register.ts`](./register.ts) | `npm run switch:setup` · `npm run switch:register` |
| [`../lib/agents/tools.ts`](../lib/agents/tools.ts) | The tools, their schemas and permissions |
| [`../server/services/Switch.ts`](../server/services/Switch.ts) | Room events → Switch agent protocol |

## Limits, honestly

- Chat identity is relayed by the agent and matched by name or handle. That's fine for a pilot; production should bind chat accounts to staff accounts through the hospital's SSO.
- Patient names go into staff rooms, as they do in today's WhatsApp groups. Self-host Switch with Mattermost if data must stay on the hospital's servers.
- The events agent uses the documented `POST /agents/{id}/message` route. It's covered by unit tests against the documented request shape; check the first live post in Audit → Switch rooms (`sent` vs `failed`) when you connect a real server.
