import "server-only";
import { activeModelMeta, fence, structured } from "../llm";
import { HandoverExtractionSchema, RoundsExtractionSchema, type HandoverExtraction, type RoundsExtraction, type Sbar } from "./schema";
import { HANDOVER_SYSTEM_PROMPT, PROMPT_VERSION, ROUNDS_SYSTEM_PROMPT } from "./system-prompt";

export { ExtractionError } from "../llm";
/** Which provider/model/prompt produced a draft (stored on the Handover for audit and re-runs). */
export const parserMeta = () => ({ ...activeModelMeta(), promptVersion: PROMPT_VERSION });

export async function extractHandover(
  transcript: string,
  census: { bedNumber: string | null; name: string; age: number }[],
): Promise<HandoverExtraction> {
  const user = [
    "<ward_census>",
    census.filter((p) => p.bedNumber).map((p) => `Bed ${p.bedNumber}: ${p.name} (${p.age}y)`).join("\n") || "(empty)",
    "</ward_census>",
    "",
    "<transcript>",
    fence(transcript),
    "</transcript>",
  ].join("\n");
  return structured(HANDOVER_SYSTEM_PROMPT, user, HandoverExtractionSchema);
}

export async function extractRounds(
  transcript: string,
  plan: { sbar: Sbar | null; openItems: { id: string; description: string; dueText: string | null }[] },
): Promise<RoundsExtraction> {
  const user = [
    "<existing_care_plan>",
    JSON.stringify({ sbar: plan.sbar, openActionItems: plan.openItems }, null, 2),
    "</existing_care_plan>",
    "",
    "<transcript>",
    fence(transcript),
    "</transcript>",
  ].join("\n");
  const out = await structured(ROUNDS_SYSTEM_PROMPT, user, RoundsExtractionSchema);
  // Never let the model touch items that weren't in the plan we sent.
  const known = new Set(plan.openItems.map((i) => i.id));
  out.cancelActionItemIds = out.cancelActionItemIds.filter((id) => known.has(id));
  out.completeActionItemIds = out.completeActionItemIds.filter((id) => known.has(id));
  return out;
}
