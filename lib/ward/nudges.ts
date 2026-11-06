import "server-only";
import { buildWardBrief, buildWardNudge, postToRoom, type DeliveryStatus } from "@/server/services/Switch";
import { runWithCtx } from "../context";
import { base } from "../db";
import { getDashboard } from "../store";
import { wardFollowups } from "./followups";

// System-initiated ward checks (no human asked): run by `npm run switch:nudge`. Each facility with
// IPD beds gets a follow-up nudge for its ward coordinator agent and, on request, the consultant's
// morning brief. Reads are audit-logged under actor role SYSTEM.

export const coordinatorName = () => process.env.SWITCH_COORDINATOR_AGENT?.trim() || "lotus-ward-coordinator";

export interface WardCheckResult {
  facility: string;
  nudge: { items: number; status: DeliveryStatus } | null;
  brief: DeliveryStatus | null;
}

export async function runWardChecks(opts: { brief: boolean; now?: Date }): Promise<WardCheckResult[]> {
  const facilities = await base.facility.findMany({ where: { patients: { some: { bedNumber: { not: null } } } }, orderBy: { createdAt: "asc" } });
  const results: WardCheckResult[] = [];
  for (const f of facilities) {
    const ctx = { facilityId: f.id, actorId: null, actorRole: "SYSTEM", purpose: "Ward follow-up check (Switch coordinator)", route: "switch:nudge" };
    results.push(
      await runWithCtx(ctx, async () => {
        const followups = await wardFollowups(opts.now);
        const nudge = buildWardNudge(followups, coordinatorName());
        const nudgeStatus = nudge ? await postToRoom(nudge) : null;
        let brief: DeliveryStatus | null = null;
        if (opts.brief) {
          const d = await getDashboard();
          const openTasks = (pid: string) => d.tasks.filter((t) => t.patientId === pid && !t.isCompleted).length;
          brief = await postToRoom(
            buildWardBrief({
              facilityName: f.name, lateTasks: followups.overdueTasks.length, draftsWaiting: d.drafts.length,
              patients: d.patients.map((p) => ({
                bed: p.bedNumber, name: p.name, diagnosis: p.diagnosis, critical: p.isCritical || p.draftCritical, criticalReasons: p.criticalReasons,
                openTasks: openTasks(p.id), draftWaiting: !!p.draftId, patientId: p.id,
              })),
            }),
          );
        }
        return { facility: f.name, nudge: nudge && nudgeStatus ? { items: nudge.itemIds?.length ?? 0, status: nudgeStatus } : null, brief };
      }),
    );
  }
  return results;
}
