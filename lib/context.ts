import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context: who is acting, for which facility, and why.
 * Every patient-data query reads this (lib/db.ts) for tenant isolation + DPDP audit logging.
 */
export interface RequestCtx {
  facilityId: string;
  actorId: string | null;
  /** Role name, or "PUBLIC" for the booking page / waiting-room TV */
  actorRole: string;
  /** Purpose of processing (DPDP §4/§7), e.g. "OPD consultation" */
  purpose: string;
  route?: string;
}

const als = new AsyncLocalStorage<RequestCtx>();

// Await INSIDE the context: Prisma queries are lazy thenables, so `() => db.x.findMany()` would
// otherwise execute after als.run() returned, outside the context (and be refused by lib/db.ts).
export const runWithCtx = <T>(ctx: RequestCtx, fn: () => Promise<T>): Promise<T> => als.run(ctx, async () => await fn());
export const getCtx = (): RequestCtx | undefined => als.getStore();

export function requireCtx(): RequestCtx {
  const ctx = als.getStore();
  if (!ctx) throw new Error("No request context: wrap the call in withStaff()/withPublic().");
  return ctx;
}
