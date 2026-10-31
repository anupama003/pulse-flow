import type { SbarKey } from "./sbar/clinical-rules";
import type { Correction, Sbar } from "./sbar/schema";

export type Priority = "STAT" | "HIGH" | "ROUTINE";
export type Source = "HANDOVER" | "ROUNDS";
export type { Role } from "./rbac";
import type { Role } from "./rbac";

export interface UserView {
  id: string;
  name: string;
  role: Role;
  title: string | null;
}

export interface PatientView {
  id: string;
  name: string;
  age: number;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
  bedNumber: string;
  ward: string | null;
  diagnosis: string | null;
  /** From the latest APPROVED note. */
  sbar: Sbar | null;
  isCritical: boolean;
  criticalReasons: string[];
  updatedAt: string; // ISO
  /** Latest unapproved AI draft for this patient, if any. */
  draftId: string | null;
  /** The draft flags critical. Shown immediately: safety signals don't wait for sign-off. */
  draftCritical: boolean;
}

export interface TaskView {
  id: string;
  patientId: string;
  bedNumber: string;
  patientName: string;
  description: string;
  priority: Priority;
  dueText: string | null;
  isCompleted: boolean;
  completedByName: string | null;
  source: Source;
  createdAt: string; // ISO
}

/** A task the AI proposes; becomes an ActionItem only when the draft is approved. */
export interface ProposedTask {
  description: string;
  priority: Priority;
  dueText: string | null;
}

/** Stored in SbarNote.proposal. */
export interface Proposal {
  actionItems?: ProposedTask[];
  cancelIds?: string[];
  completeIds?: string[];
  /** This patient's slice of the raw dictation. */
  segment?: string;
}

/** An AI-structured note awaiting human approval. */
export interface DraftView {
  id: string;
  handoverId: string;
  patientId: string;
  bedNumber: string;
  patientName: string;
  ward: string | null;
  source: Source;
  authorName: string;
  createdAt: string;
  rawDictation: string;
  segment: string | null;
  sbar: Sbar;
  isCritical: boolean;
  criticalReasons: string[];
  autoEscalated: boolean;
  missingFields: SbarKey[];
  corrections: Correction[];
  uncertainties: string[];
  proposedTasks: ProposedTask[];
  cancelTasks: { id: string; description: string }[];
  completeTasks: { id: string; description: string }[];
}

export interface DashboardData {
  patients: PatientView[];
  tasks: TaskView[];
  drafts: DraftView[];
}

/** A patient from a brain dump that didn't match any bed. Shown in review, never saved. */
export interface UnmatchedCard {
  bedNumber: string | null;
  patientName: string | null;
  sbar: Sbar;
  isCritical: boolean;
  criticalReasons: string[];
  uncertainties: string[];
}

/** What a doctor can change on a draft before approving it. */
export interface DraftEdits {
  sbar?: Sbar;
  isCritical?: boolean;
  /** Indexes into proposedTasks the doctor removed. */
  dropTaskIndexes?: number[];
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };
