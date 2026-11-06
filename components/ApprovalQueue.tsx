"use client";

import { AnimatePresence } from "framer-motion";
import { CheckCheck, ShieldCheck } from "lucide-react";
import type { DraftEdits, DraftView, UserView } from "@/lib/types";
import DraftCard from "./DraftCard";

interface Props {
  drafts: DraftView[];
  currentUser: UserView;
  busyId: string | null;
  errors: Record<string, string>;
  onApprove: (id: string, edits: DraftEdits) => void;
  onDiscard: (id: string) => void;
}

/** Every AI draft on the ward that no doctor has signed off yet. */
export default function ApprovalQueue({ drafts, currentUser, busyId, errors, onApprove, onDiscard }: Props) {
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-widget">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-medium tracking-tight">
            <ShieldCheck className="size-6 text-lavender-400" /> Awaiting approval
          </h2>
          <p className="text-sm text-slate-400">AI drafts go live only after a doctor checks them against what was dictated.</p>
        </div>
        <span className={`rounded-full px-4 py-1.5 text-sm font-medium ${drafts.length ? "bg-butter-100 text-butter-700" : "bg-mint-100 text-mint-700"}`}>
          {drafts.length ? `${drafts.length} to review` : "All caught up"}
        </span>
      </header>

      {drafts.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-3xl bg-canvas py-10 text-sm text-slate-400">
          <CheckCheck className="size-5 text-mint-400" /> Every note on the ward has been signed off.
        </p>
      ) : (
        <div className={`grid items-start gap-4 ${drafts.length > 1 ? "lg:grid-cols-2" : "max-w-3xl"}`}>
          <AnimatePresence mode="popLayout">
            {drafts.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                currentUser={currentUser}
                busy={busyId === d.id}
                error={errors[d.id]}
                onApprove={onApprove}
                onDiscard={onDiscard}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
