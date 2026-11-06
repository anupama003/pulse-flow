"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, FlaskConical, HelpCircle, Loader2, Lock, PenLine, Pill, Plus, ShieldAlert, Wand2, X } from "lucide-react";
import type { LabTestInput, RxDraftView } from "@/lib/opd/prescriptions";
import type { RxItemInput } from "@/lib/opd/rx-rules";

const blank: RxItemInput = { drug: "", form: "TAB", strength: null, dose: null, frequency: null, duration: null, route: "ORAL", instructions: null };

const FIELDS: { key: keyof RxItemInput; label: string; w: string }[] = [
  { key: "form", label: "Form", w: "w-20" },
  { key: "strength", label: "Strength", w: "w-24" },
  { key: "dose", label: "Dose", w: "w-24" },
  { key: "frequency", label: "Freq", w: "w-20" },
  { key: "duration", label: "Duration", w: "w-24" },
  { key: "route", label: "Route", w: "w-20" },
  { key: "instructions", label: "Instructions", w: "min-w-40 flex-1" },
];

export interface SignPayload {
  items: RxItemInput[];
  labTests: LabTestInput[];
  advice: string[];
  followUp: string | null;
  allergyOverride: boolean;
}

/**
 * Human-in-the-loop e-Rx review: every AI-parsed field is editable before signing. Allergy
 * conflicts block signing unless explicitly overridden. Only consultants with an HPR ID can sign.
 */
export default function RxEditor({ rx, canSign, hprId, busy, error, onSign }: { rx: RxDraftView; canSign: boolean; hprId: string | null; busy: boolean; error: string | null; onSign: (p: SignPayload) => void }) {
  const [items, setItems] = useState<RxItemInput[]>(rx.items.map(({ drug, form, strength, dose, frequency, duration, route, instructions }) => ({ drug, form, strength, dose, frequency, duration, route, instructions })));
  const [labs, setLabs] = useState<LabTestInput[]>(rx.labTests);
  const [advice, setAdvice] = useState<string[]>(rx.advice);
  const [followUp, setFollowUp] = useState(rx.followUp ?? "");
  const [newLab, setNewLab] = useState("");
  const [override, setOverride] = useState(false);

  // Only allergy warnings whose drug is still on the list (removing the drug clears the lock;
  // the server re-checks everything at signing anyway).
  const allergy = rx.warnings.filter((w) => w.level === "ALLERGY" && (w.itemIndex === null || items.some((it) => it.drug.trim().toLowerCase() === rx.items[w.itemIndex!]?.drug.toLowerCase())));
  const review = rx.warnings.filter((w) => w.level === "REVIEW");
  const setItem = (i: number, k: keyof RxItemInput, v: string) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: k === "drug" ? v : v || null } : x)));
  const blocked = allergy.length > 0 && !override;

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-widget">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-2xl font-medium tracking-tight"><Pill className="size-5 text-lavender-400" /> e-Prescription draft</h3>
          <p className="text-sm text-slate-400">Check every line against what you said. Edit anything, then sign.</p>
        </div>
        <span className="rounded-full bg-butter-100 px-3 py-1 text-xs font-semibold text-butter-700">Not signed</span>
      </header>

      {allergy.length > 0 && (
        <div className="mb-3 rounded-2xl bg-blush-100 p-4 text-sm text-blush-700">
          {allergy.map((w) => (
            <p key={w.message} className="flex gap-2 font-medium"><ShieldAlert className="mt-0.5 size-4 shrink-0" /> {w.message}</p>
          ))}
          <label className="mt-3 flex items-center gap-2">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="size-4 accent-[#b23f5c]" />
            I’ve reviewed this allergy and still want to prescribe (recorded in the audit log)
          </label>
        </div>
      )}
      {review.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-2xl bg-butter-50 p-4 text-sm text-butter-700">
          {review.map((w) => <li key={w.message} className="flex gap-2"><HelpCircle className="mt-0.5 size-4 shrink-0" /> {w.message}</li>)}
          {rx.uncertainties.map((u) => <li key={u} className="flex gap-2"><HelpCircle className="mt-0.5 size-4 shrink-0" /> {u}</li>)}
        </ul>
      )}
      {rx.corrections.length > 0 && (
        <div className="mb-3 rounded-2xl bg-lavender-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-lavender-700"><Wand2 className="size-3.5" /> Self-corrections applied</p>
          {rx.corrections.map((c, i) => (
            <p key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-blush-100 px-2.5 py-0.5 text-blush-700 line-through">{c.retracted}</span>
              <ArrowRight className="size-3.5 text-lavender-400" />
              <span className="rounded-full bg-mint-100 px-2.5 py-0.5 text-mint-700">{c.replacedWith ?? "withdrawn"}</span>
            </p>
          ))}
        </div>
      )}

      {/* Medicines */}
      <ol className="space-y-2">
        {items.map((it, i) => {
          const flagged = rx.items[i]?.needsReview && rx.items[i]?.drug === it.drug;
          const isAllergy = allergy.some((w) => w.itemIndex !== null && rx.items[w.itemIndex]?.drug.toLowerCase() === it.drug.trim().toLowerCase());
          return (
            <motion.li layout key={i} className={`rounded-2xl p-3 ${isAllergy ? "bg-blush-50 ring-2 ring-blush-200" : flagged ? "bg-butter-50" : "bg-canvas"}`}>
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-slate-500">{i + 1}</span>
                <input value={it.drug} onChange={(e) => setItem(i, "drug", e.target.value)} placeholder="Drug / brand" aria-label={`Medicine ${i + 1} name`} className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-[15px] font-semibold outline-none focus:ring-4 focus:ring-lavender-100" />
                {rx.items[i]?.quantity ? <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs text-slate-500">Qty {rx.items[i].quantity}</span> : null}
                <button onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove medicine ${i + 1}`} className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-blush-700"><X className="size-4" /></button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 pl-9">
                {FIELDS.map((f) => (
                  <label key={f.key} className={`${f.w} rounded-xl bg-white px-2.5 py-1`}>
                    <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">{f.label}</span>
                    <input value={it[f.key] ?? ""} onChange={(e) => setItem(i, f.key, e.target.value)} className={`w-full bg-transparent text-sm outline-none ${!it[f.key] && ["frequency", "duration", "strength"].includes(f.key) ? "placeholder:text-butter-700" : ""}`} placeholder={["frequency", "duration"].includes(f.key) ? "missing" : "-"} />
                  </label>
                ))}
              </div>
              {flagged && rx.items[i]?.reviewReason && <p className="mt-1.5 pl-9 text-xs text-butter-700">{rx.items[i].reviewReason}</p>}
            </motion.li>
          );
        })}
      </ol>
      <button onClick={() => setItems((xs) => [...xs, { ...blank }])} className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-slate-500 hover:bg-canvas hover:text-ink"><Plus className="size-4" /> Add medicine</button>

      {/* Investigations */}
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-medium"><FlaskConical className="size-4 text-powder-700" /> Investigations → diagnostics queue</p>
        <div className="flex flex-wrap gap-2">
          {labs.map((l, i) => (
            <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${l.urgency === "URGENT" ? "bg-blush-100 text-blush-700" : "bg-powder-100 text-powder-700"}`}>
              {l.test}
              <button onClick={() => setLabs((xs) => xs.map((x, j) => (j === i ? { ...x, urgency: x.urgency === "URGENT" ? "ROUTINE" : "URGENT" } : x)))} className="text-[10px] font-semibold uppercase opacity-70 hover:opacity-100">{l.urgency === "URGENT" ? "urgent" : "routine"}</button>
              <button onClick={() => setLabs((xs) => xs.filter((_, j) => j !== i))} aria-label={`Remove ${l.test}`}><X className="size-3.5" /></button>
            </span>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (newLab.trim()) { setLabs((xs) => [...xs, { test: newLab.trim(), urgency: "ROUTINE", notes: null }]); setNewLab(""); } }} className="flex">
            <input value={newLab} onChange={(e) => setNewLab(e.target.value)} placeholder="+ add test" aria-label="Add investigation" className="w-32 rounded-full bg-canvas px-3 py-1.5 text-sm outline-none focus:ring-4 focus:ring-lavender-100" />
          </form>
        </div>
      </div>

      {/* Advice & follow-up */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-mint-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-mint-700">Advice → WhatsApp care message</p>
          <textarea value={advice.join("\n")} onChange={(e) => setAdvice(e.target.value.split("\n"))} rows={3} placeholder="One instruction per line" className="w-full resize-y rounded-xl bg-white/80 px-3 py-2 text-sm outline-none" />
        </div>
        <div className="rounded-2xl bg-lavender-50 p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-lavender-700">Follow-up</p>
          <input value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="e.g. Review after 5 days with reports" className="w-full rounded-xl bg-white/80 px-3 py-2 text-sm outline-none" />
        </div>
      </div>

      {error && <p className="mt-3 flex items-center gap-2 rounded-2xl bg-blush-50 px-4 py-2 text-sm text-blush-700"><AlertTriangle className="size-4" /> {error}</p>}
      <footer className="mt-5 flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-400">{canSign ? `Signing as HPR ${hprId}. A SHA-256 of the final Rx is stored with your signature.` : "Only a consultant with an HPR ID can sign. You can still prepare the draft."}</p>
        <motion.button
          whileTap={{ scale: 0.97 }}
          disabled={busy || !canSign || blocked}
          onClick={() => onSign({ items, labTests: labs, advice: advice.map((a) => a.trim()).filter(Boolean), followUp: followUp.trim() || null, allergyOverride: override })}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink py-2 pl-2 pr-6 text-base font-medium text-white shadow-[0_14px_30px_-10px_rgb(31_29_43/0.6)] disabled:cursor-not-allowed disabled:bg-ink/25 disabled:shadow-none"
        >
          <span className="grid size-10 place-items-center rounded-full bg-white/15">{busy ? <Loader2 className="size-5 animate-spin" /> : canSign ? <PenLine className="size-5" /> : <Lock className="size-5" />}</span>
          {canSign ? "Sign & send to pharmacy" : "Consultant signature needed"}
        </motion.button>
      </footer>
    </section>
  );
}
