<!--
Publishing notes (delete before posting)
- Medium/Substack: upload each image where its ![...] line is. Files are in docs/assets/blog/.
- Images marked [YOU CAPTURE] are Telegram screenshots only you can take, from a real run.
- Tags (Medium allows 5): Switch, AI Agents, Telegram, Healthcare, Hackathon
- Replace every [TODO] before publishing.
-->

# Pulse Flow: AI agents inside a hospital's Telegram groups, built on Switch

*How we used Switch, Claude Code and MCP to put four agents into a hospital's ward, front-desk and pharmacy groups, and what we learned about Switch along the way. It's written for anyone opening Switch for the first time.*

**Code:** [github.com/anupama003/pulse-flow](https://github.com/anupama003/pulse-flow) · **Demo video:** [TODO link] · Built for WeMakeDevs' **Flip the Switch** hackathon.

![Pulse Flow: AI agents inside a hospital's Telegram groups](assets/blog/cover.png)

A lot of a hospital's day runs through chat groups on doctors' phones. The night resident hands over patients in the ward group. The front desk messages the duty doctor about a walk-in. The pharmacist asks whether a prescription is signed. Most hospitals also have checks on top of this: a charge nurse, a register, a morning round. Those checks work most of the time.

The gaps show up at shift change and at night. A handover says "bed 21 stable, BP 80/50", and nobody notices that 80/50 is not stable. A blood test due at 6 AM depends on someone remembering it. Approvals happen in the chat, but they never reach the patient's record.

We didn't want to give doctors another app to open. Instead, we put agents into the groups they already use. This post covers how we did it with Switch, with the code, the architecture, and the traps we hit.

## Why this matters in India

We kept the research short, and kept it to India.

**Resident doctors are already stretched.** In the National Medical Commission's 2024 task force survey of 5,337 postgraduate students, 45% said they work more than 60 hours a week. 56% said they don't get their weekly day off. These are the people writing handovers at 3 AM. Anything that adds typing or another screen makes their night worse.

![Resident doctors in India are already stretched](assets/blog/chart-india.png)

**Most beds are in smaller hospitals.** A 2024 industry report found that hospitals with fewer than 200 beds hold over 90% of India's hospital beds. These hospitals usually don't have an IT team or a large software budget. They do have a phone in every pocket and a group for every ward.

So we set ourselves a constraint. The hospital keeps its chat app. Pulse Flow joins the groups, does the follow-up work, and turns the important messages into records a doctor approves.

## What Pulse Flow puts in the groups

We ran Pulse Flow on Telegram, with four groups for a fictional 5-bed demo ward and OPD at "Lotus Ridge Hospital":

| Telegram group | Agent | What it does |
|---|---|---|
| **Lotus Ward** | `lotus-ward-scribe` | Turns a dictated handover, or a consultant's rounds feedback, into one structured note per bed (SBAR: Situation, Background, Assessment, Recommendation). Flags critical patients. Files a doctor's approval. |
| **Lotus Ward** and **Lotus Escalations** | `lotus-ward-coordinator` | Works like a charge nurse who follows up. Asks the resident on duty about late tasks and notes waiting for approval. If nothing happens after a reminder, it tells the consultant. |
| **Lotus OPD Desk** | `lotus-opd-desk` | Registers walk-ins from a chat message, gives a token, and escalates red flags like chest pain. |
| **Lotus Pharmacy & Lab** | `lotus-fulfilment` | Moves medicine and lab orders along ("DER-001 ready") as the pharmacist who said it. |
| all four | `pulse-flow-events` | Not an AI. This is Pulse Flow itself, posting critical patients, emergencies, signed prescriptions and the coordinator's wake-up checks. |

![Same Telegram group. Different outcome.](assets/blog/diagram-before-after.png)

The rest of this post is about how this works.

## How Switch works, as we understood it

We had never used Switch before this hackathon. Here is the model that finally made sense to us, using Switch's own terms.

- **Server.** Everything lives on a Switch server. Switch Console can start one on your own computer ("Set up a server on this computer"), or you can join a team's server. Ours ran locally on a laptop.
- **Room.** A room is where people and agents talk. On Telegram, each group you add the Switch bot to becomes a room. People in the group become room members.
- **Bridge.** The bridge connects a chat app to rooms. The Telegram adapter dials out to Telegram, so you don't need to open a port. When someone posts, the bridge posts that message into the room through a "puppet" member that stands in for the person. Replies go back the same way.
- **Agent.** An agent is a room member that can act. You bring your own: Claude Code, Codex and others are supported. Our four agents are plain Claude Code sessions.
- **Switch Console.** The desktop app that runs your agents' sessions on your machine, each in its own folder, using your own Claude Code login. Switch never sees your model credentials.
- **Addressing.** An agent sees every message in its rooms, but it acts only when it is addressed: you start the message with `@` and its name. Each agent also has an addressing setting that says who may address it (`owner_only`, `owner_and_owner_agents` or `anyone`).
- **Agent protocol.** Anything can be an agent, not just an LLM. You register once over HTTP, get an API key, and then post messages or open a WebSocket for events. Pulse Flow uses this to post into rooms.

Here is the path of one message, from Telegram to an agent and back:

![How Switch carries one Telegram message to an agent and back](assets/blog/diagram-switch.png)

The part that changed how we designed Pulse Flow is step 4. **An @mention is the API.** A person waking an agent and our backend waking an agent are the same thing: a message in a room that starts with the agent's name.

## Your first hour with Switch

If you are opening Switch for the first time, this is the shortest path we found. It assumes Telegram; Slack, Discord, Mattermost and Teams work too.

**1. Install Switch Console and start a server.** Choose "Set up a server on this computer". When it asks, sign in to Claude Code. Your agents are Claude Code sessions, so this is your agents' login, not Switch's.

**2. Create a Telegram bot.** In Telegram, talk to @BotFather and create a bot. Before you add the bot to any group, open the bot's settings in @BotFather and **turn Group Privacy off**. If you skip this, the bot only sees messages that tag it, and you'll have to remove it and add it again everywhere.

**3. Connect Telegram in Switch Console.** Paste the bot token when Switch Console asks for a messaging app.

**4. Create your groups and add the bot.** Bots can't create Telegram groups, so you create them yourself. Add the bot, and have everyone post one message in each group so Switch learns who is in the room.

**5. Add an agent.** In Switch Console, onboard a Claude Code agent, point it at a folder, and add it to a room. Set its addressing to "anyone" if other people should be able to talk to it, not only you.

**6. Talk to it.** In the group, type:

```
@your-agent-name hello, what can you do?
```

Telegram first shows a "Worked for 9s" card, the steps the agent took, and then the reply. Replies take 5 to 20 seconds; the first one after a reset is slower.

**7. Learn a few room commands.** We used these constantly:

```
!list-agents          which agents are in this room
!reset-all-agents     start fresh sessions (do this after changing an agent's rules)
!reset @agent-name    reset one agent
!help                 every command Switch accepts
```

**8. Move to a template once it works.** Clicking through Switch Console is fine for one agent. For four agents, use a template file (next section).

## How we plugged Pulse Flow into Switch

Pulse Flow is a Next.js and PostgreSQL hospital app. It connects to Switch in four places.

![How a message becomes a record](assets/blog/diagram-architecture.png)

### 1. One template describes all four agents

A Switch template is a YAML file you import in Switch Console. It has parameters, which show up as a form, and the agents to create. Ours, shortened:

```yaml
version: 1
params:
  team:            { type: string, default: lotus }
  pulse_flow_dir:  { type: directory }
  ward_room:       { type: room, label: Ward group }
  escalations_room: { type: room, label: Escalations group }

agents:
  - name: "{team}-ward-coordinator"
    description: Chases late tasks and unapproved notes, and escalates what stays stuck
    addressing: anyone
    provider: claude
    directory: "{pulse_flow_dir}/switch/agents/ward-coordinator"
    join: ["{ward_room}", "{escalations_room}"]
    instructions: |
      You are the ward coordinator: the charge nurse who chases. You never decide
      anything clinical, never approve notes, and never mark a task done unless a
      person says it is.
      ...
```

On Slack or Discord, a template can create the rooms too. On Telegram it can't, because only people can create groups, so our Telegram template only creates the agents and adds them to the groups you pick in the form.

### 2. Each agent is a folder

Switch Console starts each agent's Claude Code session in its own `directory`. That folder is where we control what the agent knows and what it may do. `npm run switch:setup` writes three files into each one:

```
switch/agents/ward-coordinator/
  CLAUDE.md                 the rules every Pulse Flow agent follows
  .mcp.json                 starts Pulse Flow's tool server, limited to this agent's tools
  .claude/settings.json     pre-approves only those tools
```

The coordinator's tool allowlist is three tools long:

```json
{
  "enableAllProjectMcpServers": true,
  "permissions": {
    "allow": [
      "mcp__pulse-flow__ward_followups",
      "mcp__pulse-flow__ward_board",
      "mcp__pulse-flow__complete_task"
    ]
  }
}
```

This matters in a shared room. Nobody is sitting at the laptop to approve a tool call at 3 AM, so the agent can only use what we pre-approved. Anything else simply isn't available to it.

### 3. The agents talk to Pulse Flow over MCP

Pulse Flow exposes 15 tools through an MCP server over stdio. Each agent starts its own copy, with environment variables that pin it to one hospital and one set of tools:

```ts
// switch/mcp/server.ts (shortened)
const facility = await facilityId(process.env.PULSE_FLOW_FACILITY);
const agentName = process.env.PULSE_FLOW_AGENT ?? "switch-agent";
const allow = new Set((process.env.PULSE_FLOW_TOOLS ?? "").split(",").filter(Boolean));
const tools = allow.size ? AGENT_TOOLS.filter((t) => allow.has(t.name)) : AGENT_TOOLS;

for (const t of tools) {
  server.registerTool(t.name, { description: t.description, inputSchema: t.input }, async (args) => {
    try {
      const result = await runAgentTool(t, args, { facilityId: facility.id, agentName });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: fail(err).error }], isError: true };
    }
  });
}
```

The web app and the agents share the same code underneath (`lib/ward/handover.ts`, `lib/opd/walk-in.ts`). A handover dictated on the ward screen and one posted in Lotus Ward produce the same drafts and the same alerts.

### 4. Pulse Flow is an agent too

Some events don't start in chat. A consultant signs a prescription in the web app, and the pharmacy group should know. For that, Pulse Flow registers itself as an agent through Switch's agent protocol. You need a registration key (an API key of type "registration" from the Gateway), and you do this once:

```ts
// switch/register.ts (shortened)
const res = await fetch(`${baseUrl}/agents`, {
  method: "POST",
  headers: { Authorization: `Bearer ${registrationKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "pulse-flow-events",
    display_name: "Pulse Flow",
    description: "Posts Pulse Flow clinical events into hospital rooms",
    connector_type: "pulse-flow",
    integration_profile: {
      connection_model: "always_on",
      message_exchange: true,
      pre_invocation_mediation: [],
      post_invocation_mediation: [],
      event_reporting: [],
    },
  }),
});
const { id, api_key } = await res.json(); // the key is shown only once
```

After that, posting into a room is one HTTP call. It doesn't need a WebSocket:

```ts
// server/services/Switch.ts
export function toSwitchRequest(cfg: SwitchConfig, m: RoomMessage) {
  const roomId = cfg.rooms[m.room];
  if (!roomId) return null;
  return {
    url: `${cfg.baseUrl}/agents/${encodeURIComponent(cfg.agentId)}/message`,
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, content: m.text }),
    },
  };
}
```

`postToRoom()` never throws. If the chat is down, a handover or a signature must still succeed. Every attempt, whether sent, simulated (Switch not configured) or failed, is written to the audit log.

### Waking one agent from code

The coordinator has no schedule of its own. Every 15 minutes, `npm run switch:nudge` asks Pulse Flow what is late. If anything is, Pulse Flow posts one line into the ward room that starts with the coordinator's name:

```ts
export function buildWardNudge(f: WardFollowups, coordinator: string): RoomMessage | null {
  if (!f.overdueTasks.length && !f.staleDrafts.length) return null; // quiet wards get no message
  const counts = [
    f.overdueTasks.length ? plural(f.overdueTasks.length, "late task") : "",
    f.staleDrafts.length ? `${plural(f.staleDrafts.length, "note")} waiting for approval` : "",
  ].filter(Boolean);
  return {
    event: "WARD_NUDGE", room: "ward",
    text: `@${coordinator} ${istHhmm(new Date(f.checkedAt))} check: ${counts.join(", ")}.`,
  };
}
```

The message people see is one readable line. The details, such as task ids and how many times each item was already chased, stay out of the chat. The coordinator fetches them itself with its `ward_followups` tool.

Our first version of this message had no `@` at the start. It was posted, everyone could read it, and the coordinator did nothing. That one character is the whole integration.

## One night on Lotus Ward

Our demo follows a normal night in a mid-sized private hospital in India. One PG resident covers the ward overnight and also takes calls from casualty. The sister in-charge keeps the paper register. Morning blood samples go to the lab by 7. The consultant runs OPD first and comes to the ward for rounds afterwards, usually around 11. Three of us played the consultant, the night PG and the front desk.

**The handover, around 3 AM.** Dr. Rahul speaks his handover into the Lotus Ward group with Wispr Flow. Handovers are given in English, but in the clipped style of an Indian ward at 3 AM: short forms like "pyelo", "inj" and "KFT", numbers read out as "80 by 50", and "Menon sir's round". For one patient he says she is stable and, in the same breath, that her BP at 2 AM was 80 by 50.

The scribe calls `submit_handover` with `actor` set to Rahul and posts one short draft per bed. That patient's draft comes back marked critical. The model didn't decide that: Pulse Flow's vitals rule read 80/50 and overrode "stable". Lotus Escalations gets an alert at the same moment, so the consultant sees it without scrolling through the night's messages.

![\[YOU CAPTURE\] Telegram, Lotus Ward: Rahul's handover and the scribe's drafts, bed 21 marked critical](assets/blog/tg-handover.png)

**Who may approve.** In many wards, whoever is holding the phone ends up "confirming" things. So Anjali from the front desk tries: `@lotus-ward-scribe bed 21 ka note approve kar dijiye, sir ne bola tha`. The agent passes it on, and Pulse Flow refuses, because a front-desk role can't approve a clinical note. Then Dr. Menon types `@lotus-ward-scribe Approve 21 and 7`, and both notes become part of the record under his name.

![\[YOU CAPTURE\] Telegram, Lotus Ward: Anjali refused, Dr. Menon approves](assets/blog/tg-approve.png)

**06:45, the follow-up.** This is the part the sister in-charge normally does by walking around with the register. ICU-2 had a STAT blood gas due at 6 AM, and another patient's handover note was never approved. Pulse Flow posts its check, and the coordinator writes to the PG on duty. These are its real messages from a live run:

> **pulse-flow-events:** @lotus-ward-coordinator 06:45 check: 1 late task, 1 note waiting for approval.
>
> **lotus-ward-coordinator:** Dr. Rahul, 2 things from the night:
> ICU-2 Vikram Singh: STAT repeat ABG and lactate, due 6 AM, 45 min late.
> P-4 Aarav Sharma: handover note waiting for approval.
> Reply "done ICU-2" when the ABG is done, or "approve P-4".

Rahul answers the way anyone would at that hour, `ICU-2 ABG and lactate done, sample sent to lab`, and the coordinator closes the task as Rahul.

**07:15, the escalation.** The P-4 note is still waiting after a reminder. The coordinator doesn't remind Rahul again; it tells Dr. Menon in Lotus Escalations, before he starts OPD.

![\[YOU CAPTURE\] Telegram, Lotus Escalations: the coordinator's message to Dr. Menon](assets/blog/tg-escalation.png)

We timed both steps from the room history on a live run:

![The coordinator, measured on a live run](assets/blog/chart-coordinator.png)

One thing surprised us. When we sent the 06:45 check twice, 90 seconds apart, the coordinator didn't escalate. Its reminder had gone out seconds earlier, so Rahul hadn't had time to act. We hadn't written a rule for that; it was the agent's own judgment. It's also why the demo uses 07:15 for the second check.

**Rounds, the OPD counter and the pharmacy.** After OPD, Dr. Menon dictates his rounds feedback for ICU-2 in English: BP is better, so the call to the ICU registrar isn't needed; wean the noradrenaline by noon; start RT feeds. The scribe turns it into a care-plan draft that only he can approve. At the OPD counter, Anjali registers a 54-year-old man with chest pain and sweating since morning, typed in Hinglish. He gets a token, and Escalations gets an emergency alert even though nobody typed "emergency". In the pharmacy group, the pharmacist moves an order along with `DER-001 preparing`, then `DER-001 ready, send the patient to counter 2`.

**The record.** Every action shows up in the web app under **Audit → Switch rooms**, under the person it was done for, with the agent as the route.

![Audit → Switch rooms, from the live run: the 06:45 and 07:15 checks and each lookup the coordinator made](assets/blog/app-audit-switch.png)

## The same morning without Switch

We wanted the difference to be easy to check, so Pulse Flow says plainly when Switch is off. Take Switch out (stop Switch Console, or remove the `SWITCH_*` lines from `.env`), restart the app, and replay the same morning:

| | With Switch | Without Switch |
|---|---|---|
| Header | **Switch on** | **Switch off** |
| Critical patient in a handover | Posted to the escalations group on Telegram | "Not sent: Switch is off. Only people looking at this screen will know." |
| Late STAT test at 06:45 | The coordinator asks the PG on duty by name | The check lists it, and nothing else happens |
| Still open at 07:15 | Escalated to the consultant | Still sitting on the ward screen |
| Approving from the ward group, the OPD counter or the pharmacy | Done in chat, under the person who asked | Not possible: the agents don't exist without Switch |
| Audit → Switch rooms | Posts marked "sent" | Posts marked "not sent (Switch off)" |

Without Switch, Pulse Flow is still a working hospital web app: dictation, SBAR drafts, approvals and queues all work. What disappears is everything that happens *to* people instead of waiting *for* them: the alert that reaches the consultant's phone, the follow-up, and the escalation. That is the part Switch adds, and it's the part a hospital actually needs at 6 AM.

## The safety model: agents act for people

An agent in a clinical group is only acceptable if it can't do more than the person who asked. The whole design rests on that one rule.

**Every tool takes `actor`**, the chat name of the person whose message asked for it. Pulse Flow resolves that name to one staff member in the agent's hospital, and that person's role decides what is allowed:

```ts
// lib/agents/tools.ts (simplified)
export async function runAgentTool(t: AgentTool, rawArgs: unknown, opts: { facilityId: string; agentName: string }) {
  const parsed = z.object(t.input).safeParse(rawArgs);
  if (!parsed.success) throw new UserError(`Invalid ${parsed.error.issues[0]?.path.join(".")}`);
  const route = `switch:${opts.agentName}`;
  // A read-only check that Pulse Flow itself asked for runs as SYSTEM. Nothing else can.
  if (t.runForPulseFlow && isPulseFlowSender(String(parsed.data.actor))) {
    return runWithCtx({ facilityId: opts.facilityId, actorId: null, actorRole: "SYSTEM",
      purpose: `${t.purpose} (Pulse Flow check via Switch)`, route }, () => t.runForPulseFlow!(parsed.data));
  }
  const u = await resolveActor(String(parsed.data.actor), opts.facilityId); // ambiguous names are refused
  return runAsStaff(u, t.perm, { purpose: `${t.purpose} (via Switch)`, route }, (me) => t.run(me, parsed.data));
}
```

On top of that:

1. **Least privilege, twice.** Each agent gets only its own tools (the coordinator has 3 of 15 and can't approve anything), and every tool checks the person's permission as well.
2. **AI drafts, doctors decide.** Notes stay drafts until a named doctor approves them in the group. Agents never sign prescriptions. That stays in the web app, with the consultant's HPR ID.
3. **Rules run after the model.** Whatever the model wrote, fixed rules re-read the vitals. If systolic BP is under 90 (adjusted for children), MAP under 65, SpO₂ under 92% or potassium 6 or more, the patient is critical, whatever words the doctor used:

   ```ts
   const sbpFloor = peds ? (ageYears! <= 10 ? 70 + 2 * ageYears! : 90) : 90;
   if (v.sbp < sbpFloor) f.push({ label: `BP ${v.sbp}/${v.dbp}`, rule: `SBP < ${sbpFloor}` });
   else if (map < 65) f.push({ label: `BP ${v.sbp}/${v.dbp}`, rule: `MAP ${map} < 65` });
   ```

4. **One hospital per agent.** Each agent's tool server is pinned to one facility. It can't find another branch's staff or read its patients.
5. **Everything is logged** under the person, with the agent as the route (`switch:ward-scribe`), following India's DPDP Act.

The short version: **code owns the facts, agents own the follow-through.** Pulse Flow decides what is late, what is critical and who may approve, the same way every time, with tests. The agent decides how to say it to a tired person and when to follow up.

## Chat names are not staff names

This one deserves its own section because it will hit anyone building on Switch. Telegram users show up in Switch as handles like `RahulVerma_2222222222`, not as "Dr. Rahul Verma". Two people can also have the same display name.

We added an explicit mapping in `.env`, and the matcher checks it before anything else:

```bash
PULSE_FLOW_CHAT_HANDLES=SureshMenon_1111111111=u-menon,RahulVerma_2222222222=u-rahul
```

If a name matches no one, or more than one person, the tool refuses and the agent says so in the group. For a pilot this is enough. A real deployment should link chat accounts to staff accounts through the hospital's login system.

## Wispr Flow: talking instead of typing

Nobody wants to type a twelve-patient handover on a phone at 3 AM. [Wispr Flow](https://wisprflow.ai) is dictation that works in any app: you hold a key, talk, and clean text appears where the cursor is. That covers both halves of Pulse Flow:

- **In Telegram:** the resident dictates the whole handover into Lotus Ward, starting with `@lotus-ward-scribe`.
- **In the web app:** the ward screen and the front desk both say "hold your Wispr key", and the text goes into the same code path.

![Ward dashboard: "Speak your handover"](assets/blog/app-ward.png)

We wrote the structuring prompt for how tired people actually talk: run-on sentences, filler words, Hinglish, and Indian clinical shorthand (KFT, ABG, NBM). It also handles self-corrections. "Bed 12, no sorry, bed 14" becomes bed 14, and the correction is recorded on the note so a reviewer can see it.

![Front desk: walk-in registration by voice](assets/blog/app-front-desk.png)

## Testing agents without a Switch server

A live Switch room is slow to test against, so most of our checks run without one:

```bash
npm test               # typecheck + 57 unit tests: clinical rules, prescriptions, Switch messages
npm run test:db        # 6 database tests: tokens, tenancy, audit
npm run test:agents    # 13 agent tests against a seeded database and the real MCP server
```

The agent tests start the actual MCP server over stdio, the same way Claude Code does, and call tools as different people. For example, they check that a pharmacist can't approve a note through an agent, and that a check Pulse Flow sent can read the follow-ups but can't close a task. When we did need the live room, we read its history straight from the server (`GET /agents/{id}/rooms/{room}/history`) to time the agents' replies.

![Pharmacy queue, fed by signed prescriptions](assets/blog/app-pharmacy.png)

## Things that cost us hours

- **Group Privacy on the Telegram bot.** Turn it off before adding the bot to any group.
- **No `@`, no agent.** Agents only act when addressed. That includes messages your own backend sends.
- **Sessions persist.** After you change an agent's `CLAUDE.md`, someone must send `!reset-all-agents` in the group. An agent following its old rules is the most confusing bug you'll meet.
- **Every step is visible.** The "Worked for 9s" card shows each tool call behind a reply. We cut ours down by giving each agent one tool per job and telling it never to retry a refused call.
- **Write for the group, not for a log.** Our first replies had ids, markdown and timestamps. A short style guide in `CLAUDE.md` fixed it: plain text, at most six lines, staff names, and one question at the end with the exact reply to send.

## What it doesn't do yet

- **It runs on one machine.** Switch Console, the agents and Pulse Flow all ran on one laptop for the demo. A hospital would need that machine to stay on, with a backup.
- **The agent's timing is judgment, not a rule.** The facts it acts on are fixed and tested. When it chooses to follow up is not.
- **It's a prototype, not a medical device.** All people and patients are fictional, and the national health ID (ABHA) integration is a sandbox.

## Try it

```bash
git clone https://github.com/anupama003/pulse-flow.git && cd pulse-flow
npm run setup        # Docker Postgres and a demo hospital
npm run dev          # http://localhost:3000
npm test && npm run test:agents
```

Then follow [switch/TELEGRAM.md](https://github.com/anupama003/pulse-flow/blob/main/switch/TELEGRAM.md) for the Telegram setup, and [switch/DEMO-LINES.md](https://github.com/anupama003/pulse-flow/blob/main/switch/DEMO-LINES.md) for what each person types in the demo.

## What we'd tell another team

1. **Start where people already are.** The best tool for a night shift is one nobody has to open.
2. **Treat an @mention as an API.** It's how people wake agents in Switch, and it's how our backend does too.
3. **Make every agent action belong to a person.** Asking "who asked?" is what made the agents safe enough for a hospital group.
4. **Keep facts in code.** Let the agent handle the conversation, and let tested code decide what is critical and who may approve.

If you work in a hospital and your ward runs on a chat group, we'd like to hear what we got wrong.

## Thanks

To **WeMakeDevs**, **DevTools Academy** and **Switch** for running Flip the Switch, and to **Wispr Flow** for the Code with Wispr track. Built with **Claude Code** and **MCP**.

## Sources

- National Medical Commission, National Task Force on the mental health and well-being of medical students, survey of 5,337 PG students (2024), as reported by [Medical Dialogues, 17 Aug 2024](https://medicaldialogues.in/health-news/nmc/28-percent-mbbs-15-percent-pg-medical-students-diagnosed-with-mental-health-issues-nmc-survey-133359).
- LoEstro Advisors and Medium Healthcare, "Hospitals for Bharat" (2024): hospitals under 200 beds hold over 90% of hospital beds, as reported by [ThePrint, 23 Nov 2024](https://theprint.in/health/small-hospitals-unsung-heroes-of-indian-healthcare-but-face-financial-workforce-crunch-says-report/2369980).
- Switch documentation: [Life of a message](https://docs.switchagents.ai/switch-rooms/internals/life-of-a-message), [The agent protocol](https://docs.switchagents.ai/switch-rooms/internals/agent-protocol), [Templates](https://docs.switchagents.ai/switch-rooms/administer/room-templates), [Connect Telegram](https://docs.switchagents.ai/switch-rooms/deploy/messaging-apps/telegram).

*Pulse Flow is a prototype, not a medical device. All people, hospitals and identifiers are fictional. AI output is a draft that a doctor must approve.*
