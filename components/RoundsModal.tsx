"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";
import type { DraftEdits, DraftView, PatientView, TaskView, UserView } from "@/lib/types";
import DictationBox from "./DictationBox";
import DraftCard from "./DraftCard";
import SbarBlock from "./SbarBlock";
import TaskRow from "./TaskRow";

interface Props {
  patient: PatientView;
  tasks: TaskView[];
  pending: boolean;
  error: string | null;
  drafts: DraftView[];
  currentUser: UserView;
  busyId: string | null;
  draftErrors: Record<string, string>;
  onApprove: (id: string, edits: DraftEdits) => void;
  onDiscard: (id: string) => void;
  onToggle: (t: TaskView) => void;
  onSubmit: (text: string) => Promise<boolean>;
  onClose: () => void;
}

/** Live rounds: consultant dictates at the bedside, AI merges orders into this patient's plan. */
export default function RoundsModal({
  patient,
  tasks,
  pending,
  error,
  drafts,
  currentUser,
  busyId,
  draftErrors,
  onApprove,
  onDiscard,
  onToggle,
  onSubmit,
  onClose,
}: Props) {
  const [text, setText] = useState("");

  // Esc closes the modal (unless saving); lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pending, onClose]);

  const submit = async () => {
    if (await onSubmit(text)) setText("");
  };

  const critical = patient.isCritical;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-ink/30 backdrop-blur-md" onClick={() => !pending && onClose()} />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        role="dialog"
        aria-modal="true"
        aria-label={`Live rounds: Bed ${patient.bedNumber}`}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className={`relative flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-[2.5rem] bg-white shadow-float sm:rounded-[2.5rem] ${
          critical ? "ring-2 ring-blush-200" : ""
        }`}
      >
        <header className="flex items-center gap-4 px-6 pb-2 pt-6 md:px-8">
          <span
            className={`grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold ${
              critical ? "bg-blush-100 text-blush-700" : "bg-mint-100 text-mint-700"
            }`}
          >
            {patient.bedNumber}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-medium tracking-tight">{patient.name}</h2>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-canvas px-2.5 py-0.5 text-slate-500">
                {patient.age} yrs · {patient.gender.toLowerCase()}
              </span>
              {patient.diagnosis && <span className="rounded-full bg-lavender-50 px-2.5 py-0.5 text-lavender-700">{patient.diagnosis}</span>}
              <span className={`rounded-full px-2.5 py-0.5 font-medium ${critical ? "bg-blush-100 text-blush-700" : "bg-mint-100 text-mint-700"}`}>
                {critical ? "Critical" : "Stable"}
              </span>
            </div>
          </div>
          <button onClick={onClose} disabled={pending} aria-label="Close" className="grid size-11 place-items-center rounded-full bg-canvas text-slate-500 hover:bg-ink hover:text-white disabled:opacity-40">
            <X className="size-5" />
          </button>
        </header>

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-5 overflow-y-auto p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <DictationBox
              value={text}
              onChange={setText}
              onSubmit={submit}
              pending={pending}
              error={error}
              autoFocus
              primary
              minWords={2}
              eyebrow="Live rounds"
              title="Capture the consultant’s orders"
              subtitle="Hold your Wispr key at the bedside. New orders merge into this patient’s plan and checklist."
              placeholder={`"Stop the ceftriaxone, start pip-taz. Repeat echo. If creatinine's still up tomorrow, nephro consult…"`}
              buttonLabel="Update care plan"
              pendingLabel="Merging orders…"
            />
            {drafts.length > 0 && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 px-1 text-lg font-medium">
                  <ShieldCheck className="size-5 text-lavender-400" />
                  {currentUser.role === "CONSULTANT" ? "Your sign-off" : "Awaiting consultant sign-off"}
                </p>
                {drafts.map((d) => (
                  <DraftCard key={d.id} draft={d} currentUser={currentUser} busy={busyId === d.id} error={draftErrors[d.id]} onApprove={onApprove} onDiscard={onDiscard} />
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
              <p className="mb-3 text-lg font-medium">Current care plan</p>
              {patient.sbar ? <SbarBlock sbar={patient.sbar} /> : <p className="text-sm italic text-slate-400">No SBAR yet.</p>}
              {critical && patient.criticalReasons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {patient.criticalReasons.map((r) => (
                    <span key={r} className="rounded-full bg-blush-100 px-2.5 py-0.5 text-xs text-blush-700">
                      {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-3xl bg-white px-4 pt-4 ring-1 ring-slate-100">
              <p className="text-lg font-medium">Checklist</p>
              <p className="text-sm text-slate-400">Check and complete tasks</p>
              <ul className="mt-1">
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={onToggle} showBed={false} />
                ))}
                {tasks.length === 0 && <li className="py-4 text-sm text-slate-400">No tasks.</li>}
              </ul>
            </div>
          </aside>
        </div>
      </motion.div>
    </motion.div>
  );
}
