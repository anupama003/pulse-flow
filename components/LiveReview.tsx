"use client";

import { AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCheck, FileText, HelpCircle, Sparkles, X } from "lucide-react";
import type { DraftEdits, DraftView, UnmatchedCard, UserView } from "@/lib/types";
import DraftCard from "./DraftCard";
import SbarBlock from "./SbarBlock";

interface Props {
  raw: string;
  drafts: DraftView[];
  unmatched: UnmatchedCard[];
  unassigned: string[];
  pending: boolean;
  currentUser: UserView;
  busyId: string | null;
  errors: Record<string, string>;
  onApprove: (id: string, edits: DraftEdits) => void;
  onDiscard: (id: string) => void;
  onDismiss: () => void;
}

/** Split screen right after a brain dump: raw words on the left, approvable AI drafts on the right. */
export default function LiveReview({ raw, drafts, unmatched, unassigned, pending, currentUser, busyId, errors, onApprove, onDiscard, onDismiss }: Props) {
  const done = !pending && drafts.length === 0 && unmatched.length === 0;
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-widget">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-medium tracking-tight">
            <Sparkles className="size-5 text-lavender-400" /> Review & approve
          </h3>
          <p className="text-sm text-slate-400">Check each card against what you said. Nothing reaches the ward until you approve it.</p>
        </div>
        {!pending && (
          <button onClick={onDismiss} aria-label="Close review" className="grid size-10 place-items-center rounded-full bg-canvas text-slate-500 hover:bg-ink hover:text-white">
            <X className="size-4" />
          </button>
        )}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Left: immutable source of truth */}
        <div className="h-fit rounded-3xl bg-canvas p-5 lg:sticky lg:top-6">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500">
            <FileText className="size-3.5" /> Raw dictation
          </p>
          <p className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap text-[15px] leading-relaxed text-slate-500">{raw}</p>
        </div>

        {/* Right: drafts */}
        <div className="space-y-4">
          {pending && [0, 1].map((i) => <div key={i} className="h-56 animate-pulse rounded-3xl bg-gradient-to-r from-lavender-50 to-powder-50" />)}

          <AnimatePresence mode="popLayout">
            {!pending &&
              drafts.map((d) => (
                <DraftCard key={d.id} draft={d} currentUser={currentUser} busy={busyId === d.id} error={errors[d.id]} onApprove={onApprove} onDiscard={onDiscard} />
              ))}
          </AnimatePresence>

          {done && (
            <p className="flex items-center justify-center gap-2 rounded-3xl bg-mint-50 py-10 text-sm text-mint-700">
              <CheckCheck className="size-5" /> Everything from this handover has been reviewed.
            </p>
          )}

          {!pending &&
            unmatched.map((c, i) => (
              <article key={i} className="rounded-3xl bg-butter-50 p-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium text-butter-700">
                  <AlertTriangle className="size-4" /> Bed {c.bedNumber ?? "?"} {c.patientName ?? ""}: no matching patient in the ward census. Not saved.
                </p>
                <SbarBlock sbar={c.sbar} compact />
                {c.uncertainties.map((u) => (
                  <p key={u} className="mt-2 flex gap-2 text-xs text-butter-700">
                    <HelpCircle className="mt-0.5 size-3.5 shrink-0" /> {u}
                  </p>
                ))}
              </article>
            ))}

          {!pending && unassigned.length > 0 && (
            <div className="rounded-3xl bg-butter-50 p-4 text-sm text-butter-700">
              <p className="mb-2 font-semibold">Couldn’t tie these to a patient:</p>
              <ul className="list-disc space-y-1 pl-5">
                {unassigned.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
