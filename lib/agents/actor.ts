import "server-only";
import { base } from "../db";
import { UserError } from "../result";
import { loadStaff, type SessionUser } from "../staff";

// Who a Switch agent is acting for. Agents never act as themselves: every tool call names the
// staff member whose chat message asked for it, and that person's role decides what is allowed.
//
// A chat display name ("Dr Suresh Menon", "suresh.menon") is matched to a Pulse Flow user in the
// agent's facility. PULSE_FLOW_CHAT_HANDLES maps chat handles that don't look like the staff name:
//   PULSE_FLOW_CHAT_HANDLES="anupama=u-menon,night-pg=u-rahul"
// A mapping can be limited to one agent with "@agent", so one person can play a different role in
// another group (the day PG on the ward, the front desk at the OPD counter):
//   PULSE_FLOW_CHAT_HANDLES="teammate=u-priya,teammate=u-anjali@opd-desk,teammate=u-farhan@fulfilment"
// Production would bind chat accounts to staff accounts through the hospital's SSO instead.

const normalize = (s: string) =>
  s.toLowerCase().replace(/^\s*@/, "").replace(/\bdr\.?\s+/g, "").replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

export function chatHandleMap(raw = process.env.PULSE_FLOW_CHAT_HANDLES ?? "", agent = process.env.PULSE_FLOW_AGENT?.trim() ?? ""): Map<string, string> {
  const entries = raw
    .split(",")
    .map((pair) => pair.split("=").map((x) => x.trim()))
    .filter((kv): kv is [string, string] => kv.length === 2 && !!kv[0] && !!kv[1])
    .map(([handle, target]) => {
      const [userId, onlyFor] = target.split("@").map((x) => x.trim());
      return { handle: normalize(handle), userId, onlyFor: onlyFor || null };
    });
  // Unscoped mappings first, then this agent's own, so an "@agent" mapping wins for that agent.
  const forThisAgent = [...entries.filter((e) => !e.onlyFor), ...entries.filter((e) => e.onlyFor === agent)];
  return new Map(forThisAgent.map((e) => [e.handle, e.userId]));
}

/** Pure matcher (unit-tested): exact id, mapped handle, full name, then a unique first-name/surname match. */
export function matchStaff(who: string, staff: { id: string; name: string }[], handles: Map<string, string>): string | null {
  const q = normalize(who);
  if (!q) return null;
  const byId = staff.find((s) => s.id === who.trim());
  if (byId) return byId.id;
  const mapped = handles.get(q);
  if (mapped && staff.some((s) => s.id === mapped)) return mapped;
  const exact = staff.filter((s) => normalize(s.name) === q);
  if (exact.length === 1) return exact[0].id;
  const words = q.split(" ");
  const partial = staff.filter((s) => {
    const parts = normalize(s.name).split(" ");
    return words.every((w) => parts.includes(w));
  });
  return partial.length === 1 ? partial[0].id : null;
}

export async function resolveActor(who: string, facilityId: string): Promise<SessionUser> {
  const staff = await base.user.findMany({ where: { facilityId }, select: { id: true, name: true } });
  const id = matchStaff(who, staff, chatHandleMap());
  const u = id ? await loadStaff(id) : null;
  if (!u) {
    throw new UserError(
      `"${who}" doesn't match exactly one staff member here. Ask them to say their full name, ` +
        `or add their chat handle to PULSE_FLOW_CHAT_HANDLES. Staff: ${staff.map((s) => s.name).join(", ")}.`,
    );
  }
  return u;
}
