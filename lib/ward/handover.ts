import "server-only";
import { buildCriticalAlert, postToRoom } from "@/server/services/Switch";
import { UserError } from "../result";
import { segmentFor, validateDraft } from "../sbar/clinical-rules";
import { extractHandover, parserMeta } from "../sbar/extract";
import { HandoverExtractionSchema, type HandoverExtraction } from "../sbar/schema";
import type { SessionUser } from "../staff";
import { createDrafts, getCensus, type NewDraft } from "../store";
import type { UnmatchedCard } from "../types";

// The shift-handover pipeline, shared by the ward screen (app/actions/ward.ts) and the Switch
// ward agent (switch/mcp). Whoever structured the dictation, the same deterministic clinical
// rules run afterwards, drafts wait for a human, and critical patients reach the escalations room.

export const MAX_DICTATION_CHARS = 20_000;

export function checkDictationLength(text: string, min: number): void {
  if (text.length < min) throw new UserError("Dictation is too short to parse.");
  if (text.length > MAX_DICTATION_CHARS) throw new UserError("Dictation too long. Split it into two.");
}

const normBed = (b: string) => b.toLowerCase().replace(/\b(bed|no|number)\b|[^a-z0-9]/g, "");

/** Bed match first, then a UNIQUE name match. Ambiguous → null (never guess which patient). */
export function matchPatient(census: { id: string; bedNumber: string | null; name: string }[], bed: string | null, name: string | null): string | null {
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

export interface CriticalDraft {
  noteId: string;
  patientId: string;
  bedNumber: string;
  patientName: string;
  reasons: string[];
  autoEscalated: boolean;
}

export interface HandoverResult {
  handoverId: string | null;
  noteIds: string[];
  unmatched: UnmatchedCard[];
  unassigned: string[];
  critical: CriticalDraft[];
}

/**
 * Turns one dictation into per-patient SBAR drafts. `structured` is the agent's own extraction
 * (validated here against the same schema the server's LLM must follow); without it the server's
 * configured LLM extracts. `structuredBy` names who produced the structure, for the audit trail.
 */
export async function draftHandover(
  author: SessionUser,
  raw: string,
  opts: { structured?: unknown; structuredBy?: string } = {},
): Promise<HandoverResult> {
  const text = raw.trim();
  checkDictationLength(text, 10);
  const census = await getCensus();
  const extraction = opts.structured === undefined ? await extractHandover(text, census) : parseStructured(opts.structured);

  const drafts: NewDraft[] = [];
  const unmatched: UnmatchedCard[] = [];
  for (const p of extraction.patients) {
    const patientId = matchPatient(census, p.bedNumber, p.patientName);
    const segment = segmentFor(text, p.bedNumber, p.patientName);
    const draft = validateDraft(p, { text: segment, ageYears: census.find((c) => c.id === patientId)?.age });
    if (patientId) drafts.push({ patientId, draft, segment });
    else unmatched.push({ bedNumber: p.bedNumber, patientName: p.patientName, sbar: draft.sbar, isCritical: draft.isCritical, criticalReasons: draft.criticalReasons, uncertainties: draft.uncertainties });
  }

  const meta = opts.structured === undefined ? parserMeta() : { provider: opts.structuredBy ?? "agent", model: "agent-structured", promptVersion: parserMeta().promptVersion };
  const saved = drafts.length
    ? await createDrafts({ authorId: author.id, source: "HANDOVER", raw: text, parserMeta: { ...meta, unassignedNotes: extraction.unassignedNotes }, drafts })
    : null;

  const critical = (saved?.noteIds ?? []).flatMap((noteId, i): CriticalDraft[] => {
    const d = drafts[i];
    if (!d.draft.isCritical) return [];
    const p = census.find((c) => c.id === d.patientId)!;
    return [{ noteId, patientId: d.patientId, bedNumber: p.bedNumber ?? "-", patientName: p.name, reasons: d.draft.criticalReasons, autoEscalated: d.draft.autoEscalated }];
  });
  await Promise.all(critical.map((c) => postToRoom(buildCriticalAlert({ ...c, authorName: author.name }))));

  return { handoverId: saved?.handoverId ?? null, noteIds: saved?.noteIds ?? [], unmatched, unassigned: extraction.unassignedNotes, critical };
}

function parseStructured(input: unknown): HandoverExtraction {
  const parsed = HandoverExtractionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new UserError(`The structured handover doesn't match the schema at ${issue?.path.join(".") || "root"}: ${issue?.message ?? "invalid"}.`);
  }
  return parsed.data;
}
