"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BedDouble, ChevronDown, FileText, HeartPulse, ShieldCheck, Stethoscope } from "lucide-react";
import type { PatientView } from "@/lib/types";
import SbarBlock from "./SbarBlock";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const timeAgo = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
};

/** "Your Appointments"-style patient widget: white, rounded-3xl, pastel pills. */
export default function PatientCard({ patient, openTasks, onOpen }: { patient: PatientView; openTasks: number; onOpen: () => void }) {
  const [showSbar, setShowSbar] = useState(false);
  // An unapproved draft that flags critical still turns the card blush: safety signals don't wait for sign-off.
  const critical = patient.isCritical || patient.draftCritical;
  const unconfirmed = patient.draftCritical && !patient.isCritical;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -4 }}
      className={`flex flex-col rounded-3xl bg-white p-5 shadow-widget transition-colors ${
        critical ? "animate-critical ring-2 ring-blush-200" : "ring-1 ring-slate-100"
      }`}
    >
      {/* Avatar + identity */}
      <button onClick={onOpen} className="flex flex-col items-center text-center focus:outline-none" aria-label={`Open live rounds for ${patient.name}`}>
        <span
          className={`relative mb-3 grid size-16 place-items-center rounded-full text-lg font-semibold ring-4 ring-white ${
            critical ? "bg-blush-100 text-blush-700" : "bg-mint-100 text-mint-700"
          } shadow-[0_10px_24px_-10px_rgb(31_29_43/0.35)]`}
        >
          {initials(patient.name)}
          <span
            className={`absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full ring-2 ring-white ${
              critical ? "bg-blush-300 text-white" : "bg-mint-400 text-white"
            }`}
          >
            {critical ? <HeartPulse className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
          </span>
        </span>
        <h3 className="text-base font-semibold leading-tight text-ink">{patient.name}</h3>
        <p className="mt-0.5 text-sm text-slate-400">
          {patient.age} yrs · {patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}
        </p>
      </button>

      {/* Diagnosis block (the "Therapist / Psychiatrist" panel) */}
      <div className={`mt-4 rounded-2xl px-4 py-3 text-center ${critical ? "bg-blush-50" : "bg-lavender-50"}`}>
        <p className="line-clamp-1 text-sm font-semibold text-ink">{patient.diagnosis ?? "No admission diagnosis"}</p>
        <p className="mt-0.5 text-xs text-slate-400">Working diagnosis</p>
      </div>

      {/* Date / Time style mini stats */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-canvas px-3 py-2">
          <p className="text-[11px] font-medium text-powder-700">Bed</p>
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <BedDouble className="size-3.5 text-slate-400" /> {patient.bedNumber}
          </p>
        </div>
        <div className="rounded-2xl bg-canvas px-3 py-2">
          <p className="text-[11px] font-medium text-powder-700">Updated</p>
          <p suppressHydrationWarning className="text-sm font-medium text-ink">{patient.sbar ? timeAgo(patient.updatedAt) : "Never"}</p>
        </div>
      </div>

      {/* Pastel pill tags */}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
            critical ? "bg-blush-100 text-blush-700" : "bg-mint-100 text-mint-700"
          }`}
        >
          {critical && <span className="size-1.5 animate-pulse rounded-full bg-blush-700" />}
          {critical ? (unconfirmed ? "Critical · unconfirmed" : "Critical") : "Stable"}
        </span>
        {patient.ward && <span className="rounded-full bg-powder-100 px-3 py-1 text-xs font-medium text-powder-700">{patient.ward}</span>}
        <span className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-slate-500">{openTasks} open tasks</span>
        {patient.draftId && (
          <span className="inline-flex items-center gap-1 rounded-full bg-butter-100 px-3 py-1 text-xs font-medium text-butter-700">
            <span className="size-1.5 rounded-full bg-butter-700" /> Awaiting approval
          </span>
        )}
        {critical &&
          patient.criticalReasons.slice(0, 2).map((r) => (
            <span key={r} className="rounded-full bg-blush-50 px-3 py-1 text-xs text-blush-700">
              {r}
            </span>
          ))}
      </div>

      <AnimatePresence initial={false}>
        {showSbar && patient.sbar && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="pt-4">
              <SbarBlock sbar={patient.sbar} compact />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Circular dark action buttons */}
      <div className="mt-auto flex items-center justify-center gap-2 pt-5">
        <IconButton label="Live rounds" onClick={onOpen}>
          <Stethoscope className="size-4" />
        </IconButton>
        <IconButton label={showSbar ? "Hide SBAR" : "Show SBAR"} onClick={() => setShowSbar((s) => !s)} disabled={!patient.sbar}>
          {showSbar ? <ChevronDown className="size-4 rotate-180" /> : <FileText className="size-4" />}
        </IconButton>
      </div>
    </motion.article>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid size-10 place-items-center rounded-full bg-ink text-white shadow-[0_8px_18px_-8px_rgb(31_29_43/0.7)] disabled:bg-ink/20 disabled:shadow-none"
    >
      {children}
    </motion.button>
  );
}
