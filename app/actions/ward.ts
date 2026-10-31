"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, UserError } from "@/lib/result";
import { segmentFor, validateDraft } from "@/lib/sbar/clinical-rules";
import { extractHandover, extractRounds, parserMeta } from "@/lib/sbar/extract";
import { SbarSchema } from "@/lib/sbar/schema";
import { withStaff } from "@/lib/session";
import { approveDraft as approve, createDrafts, discardDraft as discard, getCarePlan, getCensus, getDashboard, setTaskCompleted, type NewDraft } from "@/lib/store";
import type { ActionResult, DashboardData, DraftEdits, UnmatchedCard } from "@/lib/types";

const MAX_CHARS = 20_000;

const normBed = (b: string) => b.toLowerCase().replace(/\b(bed|no|number)\b|[^a-z0-9]/g, "");

/** Bed match first, then a UNIQUE name match. Ambiguous → null (never guess which patient). */
function matchPatient(census: { id: string; bedNumber: string | null; name: string }[], bed: string | null, name: string | null) {
  if (bed) {
    const hit = census.find((p) => p.bedNumber && normBed(p.bedNumber) === normBed(bed));
    if (hit) return hit.id;
  }
  if (name?.trim()) {
    const first = name.toLowerCase().trim().split(/\s+/)[0];
    const hits = census.filter((p) => p.name.toLowerCase().split(/\s+/).includes(first));
    if (hits.length === 1) return hits[0].id;
  }
  return null;
}

async function fresh(): Promise<DashboardData> {
  revalidatePath("/");
  return getDashboard();
}

function checkLength(text: string, min: number) {
  if (text.length < min) throw new UserError("Dictation is too short to parse.");
  if (text.length > MAX_CHARS) throw new UserError("Dictation too long. Split it into two.");
}

export async function submitHandover(
  raw: string,
): Promise<ActionResult<{ handoverId: string | null; unmatched: UnmatchedCard[]; unassigned: string[]; dashboard: DashboardData }>> {
  return attempt(() =>
    withStaff("ward:dictate", "IPD shift handover", async (user) => {
      const text = raw.trim();
      checkLength(text, 10);
      const census = await getCensus();
      const extraction = await extractHandover(text, census);

      const drafts: NewDraft[] = [];
      const unmatched: UnmatchedCard[] = [];
      for (const p of extraction.patients) {
        const patientId = matchPatient(census, p.bedNumber, p.patientName);
        const segment = segmentFor(text, p.bedNumber, p.patientName);
        const draft = validateDraft(p, { text: segment, ageYears: census.find((c) => c.id === patientId)?.age });
        if (patientId) drafts.push({ patientId, draft, segment });
        else unmatched.push({ bedNumber: p.bedNumber, patientName: p.patientName, sbar: draft.sbar, isCritical: draft.isCritical, criticalReasons: draft.criticalReasons, uncertainties: draft.uncertainties });
      }
      const saved = drafts.length
        ? await createDrafts({ authorId: user.id, source: "HANDOVER", raw: text, parserMeta: { ...parserMeta(), unassignedNotes: extraction.unassignedNotes }, drafts })
        : null;
      return { handoverId: saved?.handoverId ?? null, unmatched, unassigned: extraction.unassignedNotes, dashboard: await fresh() };
    }),
  );
}

export async function submitRounds(patientId: string, raw: string): Promise<ActionResult<{ noteId: string; dashboard: DashboardData }>> {
  return attempt(() =>
    withStaff("ward:dictate", "IPD consultant rounds", async (user) => {
      const text = raw.trim();
      checkLength(text, 5);
      const plan = await getCarePlan(patientId);
      if (!plan) throw new UserError("Patient not found.");
      const ex = await extractRounds(text, plan);
      const draft = validateDraft(
        { sbar: ex.updatedSbar, isCritical: ex.isCritical, criticalReasons: ex.criticalReasons, actionItems: ex.newActionItems, corrections: ex.corrections, uncertainties: ex.uncertainties },
        { text, ageYears: plan.age },
      );
      const saved = await createDrafts({
        authorId: user.id, source: "ROUNDS", raw: text, parserMeta: parserMeta(),
        drafts: [{ patientId, draft, segment: text, cancelIds: ex.cancelActionItemIds, completeIds: ex.completeActionItemIds }],
      });
      return { noteId: saved.noteIds[0], dashboard: await fresh() };
    }),
  );
}

const EditsSchema = z.object({
  sbar: SbarSchema.optional(),
  isCritical: z.boolean().optional(),
  dropTaskIndexes: z.array(z.number().int().min(0)).optional(),
});

export async function approveDraft(noteId: string, edits: DraftEdits = {}): Promise<ActionResult<DashboardData>> {
  return attempt(() =>
    withStaff("ward:approve", "IPD note sign-off", async (user) => {
      const parsed = EditsSchema.safeParse(edits);
      if (!parsed.success) throw new UserError("Invalid edits.");
      await approve(noteId, user, parsed.data);
      return fresh();
    }),
  );
}

export async function discardDraft(noteId: string): Promise<ActionResult<DashboardData>> {
  return attempt(() =>
    withStaff("ward:approve", "IPD note review", async (user) => {
      await discard(noteId, user.id);
      return fresh();
    }),
  );
}

export async function toggleTask(id: string, done: boolean): Promise<ActionResult<null>> {
  return attempt(() =>
    withStaff("task:complete", "IPD task completion", async (user) => {
      await setTaskCompleted(id, done, user.id);
      revalidatePath("/");
      return null;
    }),
  );
}
