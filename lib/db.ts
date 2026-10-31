import "server-only";
import { Prisma, PrismaClient, type AuditAction } from "@prisma/client";
import { getCtx, type RequestCtx } from "./context";

// Two clients:
//   `base` is raw Prisma. Only for seed scripts, the audit writer itself, and non-tenant tables (users, facilities).
//   `db` is base + a query extension that, for every operation:
//     1. TENANT ISOLATION: injects `facilityId` from the request context into where/data
//        for tenant tables. It fails closed: no context means the query throws.
//     2. DPDP AUDIT: writes an AuditLog row for every read/write that touches patient data.

const g = globalThis as unknown as { prisma?: PrismaClient };
export const base: PrismaClient = (g.prisma ??= new PrismaClient());

const TENANT_MODELS = new Set<string>([
  "Patient", "Department", "Admission", "Handover", "SbarNote", "ActionItem", "Appointment",
  "TokenCounter", "Prescription", "PharmacyOrder", "LabOrder", "MessageLog",
]);
/** Tables whose rows are personal/health data about a patient. */
const PATIENT_DATA_MODELS = new Set<string>([
  "Patient", "Admission", "Handover", "SbarNote", "ActionItem", "Appointment", "Prescription",
  "PharmacyOrder", "LabOrder", "MessageLog",
]);
const WHERE_OPS = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
  "update", "updateMany", "delete", "deleteMany", "upsert",
]);
const READ_OPS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany"]);
const SKIP_AUDIT_OPS = new Set(["count", "aggregate", "groupBy"]); // no personal data returned

type Args = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown; create?: Record<string, unknown> };

function scope(operation: string, args: Args, facilityId: string): Args {
  const next: Args = { ...args };
  if (WHERE_OPS.has(operation)) next.where = { ...(args.where ?? {}), facilityId };
  if (operation === "create") next.data = { ...(args.data as object), facilityId };
  if (operation === "createMany" || operation === "createManyAndReturn") {
    const rows = Array.isArray(args.data) ? args.data : [args.data];
    next.data = rows.map((r) => ({ ...(r as object), facilityId }));
  }
  if (operation === "upsert") next.create = { ...(args.create ?? {}), facilityId };
  return next;
}

function patientIdsOf(model: string, args: Args, result: unknown): string[] {
  const rows: Record<string, unknown>[] = Array.isArray(result) ? result : result && typeof result === "object" && "id" in result ? [result as Record<string, unknown>] : [];
  const ids = rows.map((r) => (model === "Patient" ? r.id : r.patientId)).filter((x): x is string => typeof x === "string");
  if (!ids.length) {
    const w = args.where ?? {};
    const fromWhere = model === "Patient" ? w.id : w.patientId;
    if (typeof fromWhere === "string") ids.push(fromWhere);
  }
  return [...new Set(ids)].slice(0, 500);
}

const actionOf = (op: string): AuditAction =>
  READ_OPS.has(op) ? "READ" : op.startsWith("create") ? "CREATE" : op.startsWith("delete") ? "DELETE" : op === "upsert" ? "UPDATE" : "UPDATE";

/** Explicit audit entries for things that aren't a single query (SEND, EXPORT, SIGN, DENIED…). */
export async function audit(
  action: AuditAction,
  entity: string,
  opts: { entityId?: string | null; patientIds?: string[]; meta?: Record<string, unknown>; ctx?: RequestCtx } = {},
) {
  const ctx = opts.ctx ?? getCtx();
  await base.auditLog.create({
    data: {
      facilityId: ctx?.facilityId ?? null,
      actorId: ctx?.actorId ?? null,
      actorRole: ctx?.actorRole ?? "SYSTEM",
      action,
      entity,
      entityId: opts.entityId ?? null,
      patientIds: opts.patientIds ?? [],
      purpose: ctx?.purpose ?? null,
      route: ctx?.route ?? null,
      meta: (opts.meta ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export const db = base.$extends({
  name: "tenancy-and-audit",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const tenant = TENANT_MODELS.has(model);
        const ctx = getCtx();
        if (tenant && !ctx) throw new Error(`Tenant table ${model} queried without a request context.`);
        const scoped = tenant && ctx ? scope(operation, args as Args, ctx.facilityId) : (args as Args);
        const result = await query(scoped);

        if (ctx && PATIENT_DATA_MODELS.has(model) && !SKIP_AUDIT_OPS.has(operation)) {
          const patientIds = patientIdsOf(model, scoped, result);
          const isRead = READ_OPS.has(operation);
          if (!isRead || patientIds.length) {
            const count = Array.isArray(result) ? result.length : (result as { count?: number } | null)?.count;
            const single = !Array.isArray(result) && result && typeof result === "object" && "id" in result ? String((result as { id: unknown }).id) : null;
            await audit(actionOf(operation), model, { entityId: single, patientIds, meta: { operation, count }, ctx });
          }
        }
        return result;
      },
    },
  },
});

export type Db = typeof db;
/** The client inside db.$transaction(async (tx) => …). It is still tenant-scoped and audited. */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
