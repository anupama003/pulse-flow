import "server-only";
import { cookies, headers } from "next/headers";
import { runWithCtx } from "./context";
import { base } from "./db";
import type { Permission } from "./rbac";
import { loadStaff, runAsStaff, type SessionUser } from "./staff";

// Prototype "auth": a cookie holding which demo staff member is using the device.
// Replace with real SSO (NextAuth / hospital IdP + HPR login) before any real patient data.

export const USER_COOKIE = "pulse-flow-user";
export const DEFAULT_USER = "u-rahul";

export { ForbiddenError, type SessionUser } from "./staff";

export async function sessionUser(): Promise<SessionUser> {
  const id = (await cookies()).get(USER_COOKIE)?.value ?? DEFAULT_USER;
  const u = (await loadStaff(id)) ?? (await loadStaff(DEFAULT_USER));
  if (!u) throw new Error("No users in the database. Run `npm run db:reset`.");
  return u;
}

async function route() {
  return (await headers()).get("next-url") ?? (await headers()).get("referer") ?? undefined;
}

/** Runs `fn` as the signed-in staff member, if their role has `perm`. Tenant- and audit-scoped. */
export async function withStaff<T>(perm: Permission, purpose: string, fn: (u: SessionUser) => Promise<T>): Promise<T> {
  return runAsStaff(await sessionUser(), perm, { purpose, route: await route() }, fn);
}

/** Public surfaces (patient booking page, waiting-room TV): scoped to one facility, actor "PUBLIC". */
export async function withPublic<T>(facilityId: string, purpose: string, fn: () => Promise<T>): Promise<T> {
  return runWithCtx({ facilityId, actorId: null, actorRole: "PUBLIC", purpose, route: await route() }, fn);
}

/** Data for the staff shell: me + everyone I can switch to (grouped by facility in the UI). */
export async function shellData(u: SessionUser) {
  const users = await base.user.findMany({ include: { facility: true }, orderBy: [{ facilityId: "asc" }, { createdAt: "asc" }] });
  return {
    me: u,
    users: users.map((x) => ({ id: x.id, name: x.name, role: x.role, title: x.title, facilityName: x.facility.name })),
  };
}
export type ShellData = Awaited<ReturnType<typeof shellData>>;

export async function resolveFacility(slug?: string | null) {
  return (slug && (await base.facility.findUnique({ where: { slug } }))) || (await base.facility.findFirst({ orderBy: { createdAt: "asc" } }));
}
