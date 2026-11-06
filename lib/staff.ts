import "server-only";
import { runWithCtx, type RequestCtx } from "./context";
import { audit, base } from "./db";
import { can, ROLE_LABEL, type Permission, type Role } from "./rbac";

// Staff identity + permission checks with no Next.js dependency, so the web app (lib/session.ts)
// and the Switch agents' tool server (switch/mcp) enforce exactly the same RBAC, tenancy and audit.

export class ForbiddenError extends Error {}

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  title: string | null;
  hprId: string | null;
  facilityId: string;
  facilityName: string;
  facilityType: "HOSPITAL" | "CLINIC";
  departmentId: string | null;
}

export async function loadStaff(id: string): Promise<SessionUser | null> {
  const u = await base.user.findUnique({ where: { id }, include: { facility: true } });
  if (!u) return null;
  return {
    id: u.id, name: u.name, role: u.role, title: u.title, hprId: u.hprId, departmentId: u.departmentId,
    facilityId: u.facilityId, facilityName: u.facility.name, facilityType: u.facility.type,
  };
}

/** Runs `fn` as `u`, if their role has `perm`. Tenant- and audit-scoped; refusals are audit-logged. */
export async function runAsStaff<T>(
  u: SessionUser,
  perm: Permission,
  ctx: Pick<RequestCtx, "purpose" | "route">,
  fn: (u: SessionUser) => Promise<T>,
): Promise<T> {
  const full: RequestCtx = { facilityId: u.facilityId, actorId: u.id, actorRole: u.role, ...ctx };
  if (!can(u.role, perm)) {
    await audit("DENIED", "Permission", { meta: { perm }, ctx: full });
    throw new ForbiddenError(`${ROLE_LABEL[u.role]} can't ${perm.replace(":", " → ")}.`);
  }
  return runWithCtx(full, () => fn(u));
}
