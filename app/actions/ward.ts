"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attempt, UserError } from "@/lib/result";
import { SbarSchema } from "@/lib/sbar/schema";
import { withStaff } from "@/lib/session";
import { approveDraft as approve, discardDraft as discard, getCensus, getDashboard, setTaskCompleted } from "@/lib/store";
import { draftHandover } from "@/lib/ward/handover";
import { draftRounds } from "@/lib/ward/rounds";
import type { ActionResult, DashboardData, DraftEdits, UnmatchedCard } from "@/lib/types";

async function fresh(): Promise<DashboardData> {
  revalidatePath("/");
  return getDashboard();
}

export async function submitHandover(
  raw: string,
): Promise<ActionResult<{ handoverId: string | null; unmatched: UnmatchedCard[]; unassigned: string[]; dashboard: DashboardData }>> {
  return attempt(() =>
    withStaff("ward:dictate", "IPD shift handover", async (user) => {
      const res = await draftHandover(user, raw);
      return { handoverId: res.handoverId, unmatched: res.unmatched, unassigned: res.unassigned, dashboard: await fresh() };
    }),
  );
}

export async function submitRounds(patientId: string, raw: string): Promise<ActionResult<{ noteId: string; dashboard: DashboardData }>> {
  return attempt(() =>
    withStaff("ward:dictate", "IPD consultant rounds", async (user) => {
      const patient = (await getCensus()).find((p) => p.id === patientId);
      if (!patient) throw new UserError("Patient not found.");
      const res = await draftRounds(user, patient, raw);
      return { noteId: res.noteId, dashboard: await fresh() };
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
