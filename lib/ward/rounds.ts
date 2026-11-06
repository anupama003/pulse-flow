import "server-only";
import { buildCriticalAlert, postToRoom } from "@/server/services/Switch";
import { UserError } from "../result";
import { validateDraft } from "../sbar/clinical-rules";
import { extractRounds, parserMeta } from "../sbar/extract";
import { RoundsExtractionSchema, type RoundsExtraction } from "../sbar/schema";
import type { SessionUser } from "../staff";
import { createDrafts, getCarePlan } from "../store";
import { checkDictationLength } from "./handover";

// Consultant rounds: bedside feedback merged into one patient's care plan, shared by the ward
// screen's live-rounds modal and the Switch ward scribe. The result is a ROUNDS draft that only a
// consultant can approve (enforced in store.approveDraft); stopped/finished tasks are applied then.

export interface RoundsResult {
  noteId: string;
  isCritical: boolean;
  criticalReasons: string[];
  autoEscalated: boolean;
  newTasks: number;
  cancelTasks: number;
  completeTasks: number;
  uncertainties: string[];
}

export async function draftRounds(
  author: SessionUser,
  patient: { id: string; bedNumber: string | null; name: string },
  raw: string,
  opts: { structured?: unknown; structuredBy?: string } = {},
): Promise<RoundsResult> {
  const text = raw.trim();
  checkDictationLength(text, 5);
  const plan = await getCarePlan(patient.id);
  if (!plan) throw new UserError("Patient not found.");
  const ex = opts.structured === undefined ? await extractRounds(text, plan) : onlyKnownTasks(parseStructured(opts.structured), plan.openItems);

  const draft = validateDraft(
    { sbar: ex.updatedSbar, isCritical: ex.isCritical, criticalReasons: ex.criticalReasons, actionItems: ex.newActionItems, corrections: ex.corrections, uncertainties: ex.uncertainties },
    { text, ageYears: plan.age },
  );
  const meta = opts.structured === undefined ? parserMeta() : { provider: opts.structuredBy ?? "agent", model: "agent-structured", promptVersion: parserMeta().promptVersion };
  const saved = await createDrafts({
    authorId: author.id, source: "ROUNDS", raw: text, parserMeta: meta,
    drafts: [{ patientId: patient.id, draft, segment: text, cancelIds: ex.cancelActionItemIds, completeIds: ex.completeActionItemIds }],
  });
  const noteId = saved.noteIds[0];
  if (draft.isCritical) {
    await postToRoom(
      buildCriticalAlert({
        bedNumber: patient.bedNumber ?? "-", patientName: patient.name, reasons: draft.criticalReasons, autoEscalated: draft.autoEscalated,
        authorName: author.name, patientId: patient.id,
      }),
    );
  }
  return {
    noteId, isCritical: draft.isCritical, criticalReasons: draft.criticalReasons, autoEscalated: draft.autoEscalated,
    newTasks: draft.actionItems.length, cancelTasks: ex.cancelActionItemIds.length, completeTasks: ex.completeActionItemIds.length,
    uncertainties: draft.uncertainties,
  };
}

function parseStructured(input: unknown): RoundsExtraction {
  const parsed = RoundsExtractionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new UserError(`The structured rounds note doesn't match the schema at ${issue?.path.join(".") || "root"}: ${issue?.message ?? "invalid"}.`);
  }
  return parsed.data;
}

/** Same guard the server LLM path has: never touch tasks that weren't in this patient's open plan. */
function onlyKnownTasks(ex: RoundsExtraction, open: { id: string }[]): RoundsExtraction {
  const known = new Set(open.map((i) => i.id));
  return {
    ...ex,
    cancelActionItemIds: ex.cancelActionItemIds.filter((id) => known.has(id)),
    completeActionItemIds: ex.completeActionItemIds.filter((id) => known.has(id)),
  };
}
