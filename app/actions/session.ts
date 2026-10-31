"use server";

import { cookies } from "next/headers";
import { audit, base } from "@/lib/db";
import { homeFor } from "@/lib/rbac";
import type { ActionResult } from "@/lib/types";
import { USER_COOKIE } from "@/lib/session";

/** Demo-only persona switch. Returns the landing page for the new role. */
export async function switchUser(userId: string): Promise<ActionResult<{ home: string }>> {
  const user = await base.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Unknown user." };
  (await cookies()).set(USER_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
  await audit("LOGIN", "User", {
    entityId: user.id,
    ctx: { facilityId: user.facilityId, actorId: user.id, actorRole: user.role, purpose: "Persona switch (prototype)" },
  });
  return { ok: true, data: { home: homeFor(user.role) } };
}
