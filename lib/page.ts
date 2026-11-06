import "server-only";
import type { Shell } from "@/components/AppShell";
import type { Permission } from "./rbac";
import { ForbiddenError, sessionUser, shellData, withStaff, type SessionUser } from "./session";

/** For staff pages: load the shell + page data, or a friendly "not for your role" result. */
export async function staffPage<T>(
  perm: Permission,
  purpose: string,
  load: (u: SessionUser) => Promise<T>,
): Promise<{ shell: Shell; user: SessionUser } & ({ ok: true; data: T } | { ok: false; message: string })> {
  const user = await sessionUser();
  const s = await shellData(user);
  const shell: Shell = {
    me: { id: user.id, name: user.name, role: user.role, facilityName: user.facilityName, facilityType: user.facilityType, hprId: user.hprId },
    users: s.users,
  };
  try {
    return { shell, user, ok: true, data: await withStaff(perm, purpose, load) };
  } catch (e) {
    if (e instanceof ForbiddenError) return { shell, user, ok: false, message: e.message };
    throw e;
  }
}
