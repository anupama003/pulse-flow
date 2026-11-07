# Pulse Flow on Switch

Indian hospitals already run on chat. The night PG hands over twelve patients in the ward WhatsApp group at 3 AM, the front desk messages the doctor about a walk-in with chest pain, and the pharmacist asks "is GAS-014's Rx signed yet?" in another group. It works until it doesn't: a "stable" patient with a BP of 80/50 gets buried under forty messages, nothing is tied to a patient record, and there's no audit trail.

[Switch](https://www.switchagents.ai) turns a team's chat channels into rooms where people and AI agents work together. This folder puts **three Pulse Flow agents** into the hospital's own chat app (Slack, Discord, Telegram, Mattermost or Teams) so the team keeps chatting the way it already does, but every message that matters becomes a structured, approved, audit-logged record.

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
| **ward-scribe** | ward, escalations | A whole shift handover, dictated with Wispr Flow; or a consultant's rounds feedback ("ICU-2 rounds: … no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds.") | Calls `submit_handover` / `submit_rounds`, posts one SBAR draft per bed with 🔴 critical flags (including ones the vitals rule caught when the doctor said "stable"), waits for "approve 7" / "approve all" from a doctor (rounds: only the consultant), then calls `approve_handover_note` as that doctor. Escalates critical beds to consultants. |
| **opd-desk** | opd-desk, escalations | "walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai." (the front desk speaks Hinglish) | Picks the department, asks for anything missing, calls `register_walk_in`, replies with the token and room. Pulse Flow re-screens red flags itself, so an emergency is escalated even if the agent called it routine. |
| **fulfilment** | pharmacy & lab | "GEN-002 preparing", "GEN-002 ready, send the patient to counter 2" | Moves pharmacy and lab orders along their allowed steps, as the person who said it. Reacts to Pulse Flow's "🧾 Rx signed" posts by listing the new order with allergies. |
| **pulse-flow-events** | escalations, pharmacy & lab | (nobody; it's Pulse Flow itself) | Posts 🔴 critical patients and 🚨 emergency walk-ins to escalations and 🧾 signed prescriptions to pharmacy & lab as they happen, from the web app or from another agent. |

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
   This creates `switch/agents/{ward-scribe,opd-desk,fulfilment}/` with a `.mcp.json` that starts Pulse Flow's tool server, a `.claude/settings.json` that pre-approves only that agent's tools, and the shared [agent rules](./agent-rules.md) as `CLAUDE.md`. It prints the path you'll need in step 3.

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

3. **Deploy the rooms.** In Switch Console, import [`pulse-flow-hospital.template.yaml`](./pulse-flow-hospital.template.yaml). Set `team` (e.g. `lotus`), `pulse_flow_dir` (the path from step 1) and your chat app. Switch creates the three agents, four rooms, their links and a "How this room works" doc in the ward room. Each agent says hello.

4. **Point Pulse Flow's alerts at the rooms.** Put the room ids Switch Console shows into `.env`:
   ```bash
   SWITCH_ROOM_WARD=...
   SWITCH_ROOM_ESCALATIONS=...
   SWITCH_ROOM_OPD=...
   SWITCH_ROOM_FULFILMENT=...
   ```
   Restart `npm run dev`. Until these are set, alerts are *simulated*: built and shown in **Audit → Switch rooms**, not sent.

5. **Map chat names to staff** if they don't match the demo staff names (they won't, on your own Slack):
   ```bash
   PULSE_FLOW_CHAT_HANDLES=anupama=u-menon,teammate=u-rahul,frontdesk=u-anjali,frontdesk=u-farhan@fulfilment
   ```
   An `@agent` suffix limits a mapping to that agent's group (here the front-desk account counts as the pharmacist only in the pharmacy room). Staff ids are in [`lib/fixtures.ts`](../lib/fixtures.ts): `u-rahul` night PG, `u-menon` consultant, `u-anjali` front desk, `u-farhan` pharmacist, `u-kavya` lab.

## Try it: a 3-minute script

1. **#lotus-ward**, as the night PG, hold the Wispr Flow key and say (or paste):
   > @lotus-ward-scribe Handover to the day team. Bed 21 Fatima Khan, pyelo with AKI, on inj ceftriaxone 1 gram BD. Patient is stable, but BP at 2 AM was 80 by 50, pulse 104. Repeat BP at 4 AM and send KFT at 8 in the morning. Bed 7 Meera Iyer, DKA resolved, sugars 140 to 180 on basal-bolus, taking orally well, discharge after Menon sir's round.

   The ward scribe posts one SBAR draft per bed. Bed 21 is 🔴 critical: the vitals rule overrode "stable". **#lotus-escalations** gets the alert from Pulse Flow at the same moment.
2. As the consultant, reply **@lotus-ward-scribe Approve 21 and 7**. The notes go live on the ward screen (`/`) under his name, and the tasks appear. Try "approve all" as the front desk first: the agent tells you your role can't approve.
3. **#lotus-ward**, as the consultant: "@lotus-ward-scribe ICU-2 rounds: BP better at 96 by 60 on norad 0.05. MAP is fine, so no need to call the ICU registrar. Wean off norad by 12 noon and start RT feeds." A rounds draft with new tasks and the "call ICU registrar" task stopped. "Approve ICU-2" from the night PG is refused; only the consultant can approve it.
4. **#lotus-opd-desk**, as the front desk: "@lotus-opd-desk walk-in: Ramesh Patil, 54 saal, male. Subah se seene mein dard hai aur pasina aa raha hai. Mobile 98123 45678." You get token GEN-005, Room 1, Dr. Suresh Menon, "send him straight in", and 🚨 lands in escalations, even though nobody typed "emergency".
5. In the web app, as the consultant: sidebar → **OPD console** → Ramesh Kumar (GEN-002) → paste "Tab Pan 40 OD before breakfast for 14 days. Tab Paracetamol 650 SOS for fever. CBC and LFT. Review after 5 days." → **Structure Rx** → **Sign**. **#lotus-fulfilment** gets 🧾 "Rx signed by Dr. Suresh Menon: GEN-002 · Ramesh Kumar…". Reply "@lotus-fulfilment GEN-002 preparing", then "@lotus-fulfilment GEN-002 ready, send the patient to counter 2" as the pharmacist; try "GEN-002 dispensed" straight from queued and the agent tells you the next allowed step.
6. Sidebar → **Audit log** (opens as Deepak, facility admin) → **Switch rooms**: every post and every agent action, under the person it acted for.

## Check it without a Switch server

```bash
npm run test:switch   # 18 unit tests: room messages, the Switch protocol request, actor matching, templates in sync
npm run test:agents   # 11 integration tests on a seeded DB: RBAC, rounds, the real MCP server over stdio
npm run switch:mcp    # start the tool server by hand (it waits for an MCP client on stdin)
```

## Files

| | |
|---|---|
| [`pulse-flow-hospital.template.yaml`](./pulse-flow-hospital.template.yaml) | Switch template: agents, rooms, links, room doc (Slack, Discord, Mattermost, Teams) |
| [`pulse-flow-telegram.template.yaml`](./pulse-flow-telegram.template.yaml) · [`TELEGRAM.md`](./TELEGRAM.md) | Telegram: the same agents joining groups you create (generated by `npm run switch:templates`) |
| [`agent-rules.md`](./agent-rules.md) | Rules every Pulse Flow agent follows (copied as `CLAUDE.md`) |
| [`mcp/server.ts`](./mcp/server.ts) | Pulse Flow tool server (MCP, stdio, 14 tools) |
| [`toolsets.ts`](./toolsets.ts) | Which tools each agent gets |
| [`setup.ts`](./setup.ts) · [`register.ts`](./register.ts) | `npm run switch:setup` · `npm run switch:register` |
| [`../lib/agents/tools.ts`](../lib/agents/tools.ts) | The tools, their schemas and permissions |
| [`../server/services/Switch.ts`](../server/services/Switch.ts) | Room events → Switch agent protocol |

## Limits, honestly

- Chat identity is relayed by the agent and matched by name or handle. That's fine for a pilot; production should bind chat accounts to staff accounts through the hospital's SSO.
- Patient names go into staff rooms, as they do in today's WhatsApp groups. Self-host Switch with Mattermost if data must stay on the hospital's servers.
- The events agent uses the documented `POST /agents/{id}/message` route. It's covered by unit tests against the documented request shape; check the first live post in Audit → Switch rooms (`sent` vs `failed`) when you connect a real server.
