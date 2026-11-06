// `npm run switch:register`: registers the agent Pulse Flow posts its events as (critical
// patients, signed prescriptions, emergency walk-ins), using the Switch agent protocol.
//
// Needs, in .env or the environment:
//   SWITCH_URL                the Switch server address (Switch Console shows it)
//   SWITCH_REGISTRATION_KEY   an API key of type "registration" (Gateway → API Keys)
// Prints the SWITCH_AGENT_ID / SWITCH_AGENT_API_KEY lines to add to .env. The key is shown once.

const AGENT_NAME = process.env.SWITCH_EVENTS_AGENT_NAME?.trim() || "pulse-flow-events";
const REQUEST_TIMEOUT_MS = 10_000;

export function registrationBody(name: string) {
  return {
    name,
    display_name: "Pulse Flow",
    description: "Posts Pulse Flow clinical events into hospital rooms: critical patients, signed prescriptions, emergency walk-ins.",
    connector_type: "pulse-flow",
    integration_profile: {
      connection_model: "always_on",
      message_exchange: true,
      pre_invocation_mediation: [],
      post_invocation_mediation: [],
      event_reporting: [],
    },
  };
}

async function main() {
  const baseUrl = process.env.SWITCH_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SWITCH_REGISTRATION_KEY?.trim();
  if (!baseUrl || !key) {
    console.error("✗ Set SWITCH_URL and SWITCH_REGISTRATION_KEY in .env first (see switch/README.md).");
    process.exit(1);
  }

  const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch((e: unknown) => e);
  if (!(health instanceof Response) || !health.ok) {
    console.error(`✗ No Switch server answering at ${baseUrl}/health. Is Switch Console running, and is SWITCH_URL its server address?`);
    process.exit(1);
  }

  const res = await fetch(`${baseUrl}/agents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(registrationBody(AGENT_NAME)),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 409) {
    console.error(`✗ An agent named "${AGENT_NAME}" already exists. Reuse its id and key, or set SWITCH_EVENTS_AGENT_NAME to register another.`);
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`✗ Switch refused the registration (${res.status}): ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const { id, api_key } = (await res.json()) as { id: string; api_key: string };

  // Let room members (not only the owner) see and address it.
  await fetch(`${baseUrl}/agents/${encodeURIComponent(id)}/ops/update_agent_detail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${api_key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: id, addressing: "anyone" }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }).catch(() => undefined);

  console.log(`✓ Registered "${AGENT_NAME}". Add these to .env (the key is shown only once):

SWITCH_AGENT_ID=${id}
SWITCH_AGENT_API_KEY=${api_key}

Then deploy the template, and set SWITCH_ROOM_WARD / _ESCALATIONS / _OPD / _FULFILMENT to the room ids Switch Console shows.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("✗ Registration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
