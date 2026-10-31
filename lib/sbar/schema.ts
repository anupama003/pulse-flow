import { z } from "zod";

// The contract between the LLM and the rest of the app. The model is constrained to
// this shape via structured outputs, and we validate again with Zod before persisting.

export const SbarSchema = z.object({
  situation: z.string().describe("What is happening right now. Empty string if not stated."),
  background: z.string().describe("Relevant history / diagnosis / course. Empty string if not stated."),
  assessment: z.string().describe("Clinician's stated impression and current status. Empty string if not stated."),
  recommendation: z.string().describe("What the next team should do. Empty string if not stated."),
});

export const ActionItemSchema = z.object({
  description: z.string().describe("Imperative, one task, e.g. 'Repeat KFT'."),
  priority: z.enum(["STAT", "HIGH", "ROUTINE"]),
  dueText: z.string().nullable().describe("Timing exactly as dictated ('4 AM', 'tomorrow'), or null."),
  condition: z.string().nullable().describe("If the task is conditional ('if creatinine still up'), the condition verbatim; else null."),
  sourceQuote: z.string().describe("Shortest verbatim span of the transcript this task came from."),
});

/** A self-correction the speaker made mid-dictation ("start fluids, no wait, hold fluids"). */
export const CorrectionSchema = z.object({
  retracted: z.string().describe("What the speaker said first and then took back, e.g. 'Start IV fluids'."),
  replacedWith: z.string().nullable().describe("The final intent, e.g. 'Hold IV fluids', or null if simply withdrawn."),
  quote: z.string().describe("Verbatim span containing the correction."),
});

export const PatientExtractionSchema = z.object({
  bedNumber: z.string().nullable().describe("Bed as dictated ('14', 'ICU-3'), or null if not stated."),
  patientName: z.string().nullable().describe("Name as dictated, or null."),
  sbar: SbarSchema,
  isCritical: z.boolean(),
  criticalReasons: z.array(z.string()).describe("Verbatim findings that triggered isCritical. Empty if not critical."),
  actionItems: z.array(ActionItemSchema),
  corrections: z.array(CorrectionSchema),
  uncertainties: z.array(z.string()).describe("Garbled, ambiguous or contradictory parts the doctor should confirm."),
});

/** Shift brain dump: many patients in one dictation. */
export const HandoverExtractionSchema = z.object({
  patients: z.array(PatientExtractionSchema),
  unassignedNotes: z.array(z.string()).describe("Clinical content that could not be tied to a specific patient."),
});

/** Live rounds: one patient, merged into the existing care plan. */
export const RoundsExtractionSchema = z.object({
  updatedSbar: SbarSchema,
  isCritical: z.boolean(),
  criticalReasons: z.array(z.string()),
  newActionItems: z.array(ActionItemSchema),
  cancelActionItemIds: z.array(z.string()).describe("IDs of EXISTING open items the consultant explicitly stopped or replaced."),
  completeActionItemIds: z.array(z.string()).describe("IDs of EXISTING open items the dictation explicitly says are done."),
  corrections: z.array(CorrectionSchema),
  uncertainties: z.array(z.string()),
});

export type Sbar = z.infer<typeof SbarSchema>;
export type ExtractedActionItem = z.infer<typeof ActionItemSchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type PatientExtraction = z.infer<typeof PatientExtractionSchema>;
export type HandoverExtraction = z.infer<typeof HandoverExtractionSchema>;
export type RoundsExtraction = z.infer<typeof RoundsExtractionSchema>;
