"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleMinus,
  CirclePlus,
  FileText,
  HelpCircle,
  Loader2,
  Lock,
  Mic,
  Pencil,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { SBAR_KEYS, type SbarKey } from "@/lib/sbar/clinical-rules";
import type { Sbar } from "@/lib/sbar/schema";
import type { DraftEdits, DraftView, UserView } from "@/lib/types";

const FIELD: Record<SbarKey, { letter: string; label: string; tile: string; chip: string }> = {
  situation: { letter: "S", label: "Situation", tile: "bg-powder-50", chip: "bg-powder-100 text-powder-700" },
  background: { letter: "B", label: "Background", tile: "bg-powder-50", chip: "bg-powder-100 text-powder-700" },
  assessment: { letter: "A", label: "Assessment", tile: "bg-lavender-50", chip: "bg-lavender-100 text-lavender-700" },
  recommendation: { letter: "R", label: "Recommendation", tile: "bg-mint-50", chip: "bg-mint-100 text-mint-700" },
};

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

interface Props {
  draft: DraftView;
  currentUser: UserView;
  busy: boolean;
  error?: string;
  onApprove: (id: string, edits: DraftEdits) => void;
  onDiscard: (id: string) => void;
}

/**
 * Human-in-the-loop review of one AI draft: what was said, what the AI changed,
 * what it's unsure about, and exactly what approving will do to the record.
 */
export default function DraftCard({ draft, currentUser, busy, error, onApprove, onDiscard }: Props) {
  const [sbar, setSbar] = useState<Sbar>(draft.sbar);
  const [critical, setCritical] = useState(draft.isCritical);
  const [dropped, setDropped] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const rounds = draft.source === "ROUNDS";
  const needsConsultant = rounds && currentUser.role !== "CONSULTANT";
  const stillMissing = SBAR_KEYS.filter((k) => !sbar[k].trim());
  const dirty = SBAR_KEYS.some((k) => sbar[k] !== draft.sbar[k]) || critical !== draft.isCritical || dropped.size > 0;
  const keptTasks = draft.proposedTasks.length - dropped.size;

  const approve = () =>
    onApprove(draft.id, {
      sbar: SBAR_KEYS.some((k) => sbar[k] !== draft.sbar[k]) ? sbar : undefined,
      isCritical: critical !== draft.isCritical ? critical : undefined,
      dropTaskIndexes: dropped.size ? [...dropped] : undefined,
    });
  const reset = () => {
    setSbar(draft.sbar);
    setCritical(draft.isCritical);
    setDropped(new Set());
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`flex flex-col rounded-3xl bg-white p-5 shadow-widget ${critical ? "animate-critical ring-2 ring-blush-200" : "ring-1 ring-slate-100"}`}
    >
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-ink px-3 py-1 text-sm font-medium text-white">Bed {draft.bedNumber}</span>
        <span className="font-semibold text-ink">{draft.patientName}</span>
        {draft.ward && <span className="rounded-full bg-powder-100 px-2.5 py-0.5 text-xs font-medium text-powder-700">{draft.ward}</span>}
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-butter-100 px-3 py-1 text-xs font-semibold text-butter-700">
          <span className="size-1.5 animate-pulse rounded-full bg-butter-700" /> Awaiting approval
        </span>
      </header>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
        {rounds ? <Stethoscope className="size-3.5" /> : <Mic className="size-3.5" />}
        {rounds ? "Live rounds" : "Handover"} · dictated by {draft.authorName} · <span suppressHydrationWarning>{time(draft.createdAt)}</span>
      </p>

      {/* Critical status (editable) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!editing}
          onClick={() => setCritical((c) => !c)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
            critical ? "bg-blush-100 text-blush-700" : "bg-mint-100 text-mint-700"
          } ${editing ? "ring-2 ring-offset-1 ring-ink/10 hover:ring-ink/30" : ""}`}
          title={editing ? "Toggle critical / stable" : undefined}
        >
          {critical && <span className="size-1.5 animate-pulse rounded-full bg-blush-700" />}
          {critical ? "Critical" : "Stable"}
          {editing && <Undo2 className="size-3" />}
        </button>
        {draft.autoEscalated && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blush-50 px-2.5 py-1 text-xs font-medium text-blush-700">
            <ShieldAlert className="size-3.5" /> Auto-escalated by vitals check
          </span>
        )}
        {critical && draft.criticalReasons.map((r) => (
          <span key={r} className="rounded-full bg-blush-50 px-2.5 py-1 text-xs text-blush-700">
            {r}
          </span>
        ))}
      </div>

      {/* What was said */}
      <button
        onClick={() => setShowRaw((s) => !s)}
        className="mt-4 flex items-center justify-between rounded-2xl bg-canvas px-4 py-2.5 text-left text-sm text-slate-500 transition hover:text-ink"
      >
        <span className="inline-flex items-center gap-2">
          <FileText className="size-4" /> What was dictated
        </span>
        <ChevronDown className={`size-4 transition ${showRaw ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {showRaw && (
          <motion.p
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden whitespace-pre-wrap px-4 pt-2 text-sm italic leading-relaxed text-slate-500"
          >
            “{draft.segment || draft.rawDictation}”
          </motion.p>
        )}
      </AnimatePresence>

      {/* AI corrections */}
      {draft.corrections.length > 0 && (
        <div className="mt-3 rounded-2xl bg-lavender-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-lavender-700">
            <Wand2 className="size-3.5" /> AI applied {draft.corrections.length} self-correction{draft.corrections.length > 1 ? "s" : ""}
          </p>
          <ul className="space-y-2">
            {draft.corrections.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-blush-100 px-2.5 py-0.5 text-blush-700 line-through decoration-blush-700/60">{c.retracted}</span>
                <ArrowRight className="size-3.5 text-lavender-400" />
                <span className="rounded-full bg-mint-100 px-2.5 py-0.5 text-mint-700">{c.replacedWith ?? "withdrawn"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Uncertainties */}
      {draft.uncertainties.length > 0 && (
        <ul className="mt-3 space-y-1.5 rounded-2xl bg-butter-50 p-4 text-sm text-butter-700">
          {draft.uncertainties.map((u) => (
            <li key={u} className="flex gap-2">
              <HelpCircle className="mt-0.5 size-4 shrink-0" /> {u}
            </li>
          ))}
        </ul>
      )}

      {/* SBAR (editable; missing fields always open for dictation) */}
      <div className="mt-4 space-y-2">
        {SBAR_KEYS.map((k) => {
          const f = FIELD[k];
          const missing = !sbar[k].trim();
          const wasMissing = !draft.sbar[k].trim(); // keep the box open while the doctor fills it
          const open = editing || wasMissing;
          return (
            <div key={k} className={`flex gap-3 rounded-2xl p-3.5 ${missing ? "border-2 border-dashed border-butter-700/25 bg-butter-50" : f.tile}`}>
              <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${missing ? "bg-butter-100 text-butter-700" : f.chip}`}>
                {f.letter}
              </span>
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  {f.label}
                  {missing && <span className="rounded-full bg-butter-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-butter-700">Pending</span>}
                  {!missing && wasMissing && (
                    <span className="rounded-full bg-mint-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-mint-700">Added by you</span>
                  )}
                </p>
                {open ? (
                  <textarea
                    value={sbar[k]}
                    onChange={(e) => setSbar((s) => ({ ...s, [k]: e.target.value }))}
                    rows={missing ? 2 : 3}
                    disabled={busy}
                    placeholder={`Not dictated. Tap here and hold your Wispr key to add the ${f.label.toLowerCase()}.`}
                    aria-label={f.label}
                    className="block w-full resize-y rounded-xl border border-white bg-white/80 px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-butter-700/70 focus:outline-none focus:ring-4 focus:ring-lavender-100"
                  />
                ) : (
                  <p className="text-sm leading-relaxed text-ink/80">{sbar[k]}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* What approving will do */}
      {(draft.proposedTasks.length > 0 || draft.cancelTasks.length > 0 || draft.completeTasks.length > 0) && (
        <div className="mt-4 rounded-2xl ring-1 ring-slate-100">
          <p className="px-4 pt-3 text-sm font-medium text-ink">On approval</p>
          <ul className="px-2 pb-2">
            {draft.proposedTasks.map((t, i) => {
              const off = dropped.has(i);
              return (
                <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2">
                  <CirclePlus className={`size-5 shrink-0 ${off ? "text-slate-300" : "text-mint-400"}`} />
                  <span className={`min-w-0 flex-1 text-sm ${off ? "text-slate-400 line-through" : "font-medium text-ink"}`}>
                    {t.description}
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {t.priority !== "ROUTINE" && `${t.priority} · `}
                      {t.dueText ?? ""}
                    </span>
                  </span>
                  <button
                    onClick={() => setDropped((d) => { const n = new Set(d); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                    disabled={busy}
                    className="rounded-full px-2.5 py-1 text-xs text-slate-400 hover:bg-canvas hover:text-ink"
                  >
                    {off ? "Keep" : "Remove"}
                  </button>
                </li>
              );
            })}
            {draft.cancelTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm">
                <CircleMinus className="size-5 shrink-0 text-blush-300" />
                <span className="text-slate-500 line-through">{t.description}</span>
                <span className="ml-auto rounded-full bg-blush-50 px-2 py-0.5 text-[11px] text-blush-700">Stop</span>
              </li>
            ))}
            {draft.completeTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm">
                <Check className="size-5 shrink-0 text-mint-400" />
                <span className="text-slate-500">{t.description}</span>
                <span className="ml-auto rounded-full bg-mint-50 px-2 py-0.5 text-[11px] text-mint-700">Mark done</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      {error && <p className="mt-3 rounded-2xl bg-blush-50 px-4 py-2 text-sm text-blush-700">{error}</p>}
      {stillMissing.length > 0 && !needsConsultant && (
        <p className="mt-3 flex items-center gap-2 text-xs text-butter-700">
          <AlertTriangle className="size-3.5" /> {stillMissing.length} section{stillMissing.length > 1 ? "s" : ""} pending. Dictate {stillMissing.length > 1 ? "them" : "it"} above, or approve as is.
        </p>
      )}
      <footer className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onDiscard(draft.id)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm text-slate-500 transition hover:bg-blush-50 hover:text-blush-700 disabled:opacity-40"
        >
          <Trash2 className="size-4" /> Discard
        </button>
        <button
          onClick={() => (editing && dirty ? reset() : setEditing((e) => !e))}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-4 py-2.5 text-sm text-slate-600 transition hover:text-ink disabled:opacity-40"
        >
          {editing && dirty ? <Undo2 className="size-4" /> : <Pencil className="size-4" />}
          {editing ? (dirty ? "Undo edits" : "Done editing") : "Edit"}
        </button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={approve}
          disabled={busy || needsConsultant}
          title={needsConsultant ? "Rounds orders need the consultant's sign-off" : undefined}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink py-2 pl-2 pr-5 text-sm font-medium text-white shadow-[0_14px_30px_-10px_rgb(31_29_43/0.6)] transition disabled:cursor-not-allowed disabled:bg-ink/25 disabled:shadow-none"
        >
          <span className="grid size-8 place-items-center rounded-full bg-white/15">
            {busy ? <Loader2 className="size-4 animate-spin" /> : needsConsultant ? <Lock className="size-4" /> : <Check className="size-4" />}
          </span>
          {needsConsultant ? "Consultant sign-off" : dirty ? "Approve with edits" : "Approve"}
          {!needsConsultant && keptTasks > 0 && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">+{keptTasks}</span>}
        </motion.button>
      </footer>
    </motion.article>
  );
}
