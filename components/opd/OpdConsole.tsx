"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BadgeCheck, BellRing, CheckCircle2, FileText, Globe, Loader2, MessageCircle, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import { callNext, dictateRx, signRx } from "@/app/actions/opd";
import type { OpdConsoleData } from "@/lib/opd/prescriptions";
import AppShell, { type Shell } from "../AppShell";
import DictationBox from "../DictationBox";
import { initials } from "../PersonaMenu";
import { useAutoRefresh } from "../useAutoRefresh";
import RxEditor, { type SignPayload } from "./RxEditor";

const URGENCY: Record<string, string> = { EMERGENCY: "bg-blush-100 text-blush-700", SOON: "bg-butter-100 text-butter-700", ROUTINE: "bg-canvas text-slate-500" };

export default function OpdConsole({ shell, initial }: { shell: Shell; initial: OpdConsoleData }) {
  useAutoRefresh(15_000);
  const [data, setData] = useState(initial);
  useEffect(() => setData(initial), [initial]);
  const [error, setError] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [signed, setSigned] = useState<{ rxId: string; name: string; sent: string[] } | null>(null);
  const [calling, startCall] = useTransition();
  const [parsing, startParse] = useTransition();
  const [signing, startSign] = useTransition();

  const cur = data.current;
  // Dictation belongs to one patient: keyed by appointment so leftover words can never be structured
  // into the next patient's prescription (after signing, or if the queue moved on another device).
  const [texts, setTexts] = useState<Record<string, string>>({});
  const apptId = cur?.appointmentId ?? "";
  const text = texts[apptId] ?? "";
  const setText = useCallback((v: string) => setTexts((t) => ({ ...t, [apptId]: v })), [apptId]);
  const canSign = shell.me.role === "CONSULTANT" && !!shell.me.hprId;

  const next = () =>
    startCall(async () => {
      setError(null);
      setSigned(null);
      const res = await callNext();
      if (res.ok) setData(res.data);
      else setError(res.error);
    });

  const parse = () =>
    startParse(async () => {
      if (!cur) return;
      setError(null);
      const id = cur.appointmentId;
      const res = await dictateRx(id, text);
      if (!res.ok) return setError(res.error);
      setData(res.data);
      setTexts(({ [id]: _, ...rest }) => rest);
    });

  const sign = (p: SignPayload) =>
    startSign(async () => {
      if (!cur?.rx) return;
      setSignError(null);
      const rxId = cur.rx.id;
      const res = await signRx(rxId, p);
      if (!res.ok) return setSignError(res.error);
      setSigned({ rxId, name: cur.patient.name, sent: res.data.sent });
      setData(res.data.console);
    });

  return (
    <AppShell
      shell={shell}
      badges={{ "/opd": data.waiting.length }}
      toolbar={
        <>
          <h1 className="px-2 text-3xl font-light tracking-tight md:text-4xl">OPD{data.department ? ` · ${data.department}` : ""}</h1>
          {shell.me.role === "CONSULTANT" &&
            (shell.me.hprId ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mint-100 px-3 py-1.5 text-xs font-medium text-mint-700"><ShieldCheck className="size-3.5" /> HPR {shell.me.hprId}</span>
            ) : (
              <span className="rounded-full bg-butter-100 px-3 py-1.5 text-xs font-medium text-butter-700">No HPR ID: drafting only</span>
            ))}
        </>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-12">
        {/* Queue */}
        <aside className="min-w-0 h-fit rounded-[2rem] bg-white p-6 shadow-widget xl:sticky xl:top-6 xl:col-span-4">
          <h2 className="text-xl font-medium">Waiting</h2>
          <p className="text-sm text-slate-400">{data.waiting.length} in queue · {data.completedCount} seen today</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={next} disabled={calling || !!cur || data.waiting.length === 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-base font-medium text-white shadow-[0_14px_30px_-10px_rgb(31_29_43/0.6)] disabled:bg-ink/25 disabled:shadow-none">
            {calling ? <Loader2 className="size-5 animate-spin" /> : <BellRing className="size-5" />}
            {cur ? `In consult: ${cur.token}` : "Call next patient"}
          </motion.button>
          {error && !cur && <p className="mt-2 rounded-2xl bg-blush-50 px-3 py-2 text-sm text-blush-700">{error}</p>}
          <ul className="mt-4 divide-y divide-slate-100">
            {data.waiting.map((w, i) => (
              <li key={w.id} className="flex items-center gap-3 py-3">
                <span className={`grid h-10 min-w-[4.25rem] shrink-0 place-items-center rounded-xl px-2 font-mono text-[11px] font-semibold ${i === 0 ? "bg-lavender-100 text-lavender-700" : "bg-canvas text-slate-500"}`}>{w.token}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                    <span className="truncate">{w.name}</span>
                    {w.channel === "ONLINE_VOICE" ? <Globe className="size-3.5 shrink-0 text-powder-700" /> : <Users className="size-3.5 shrink-0 text-slate-300" />}
                  </span>
                  <span className="block truncate text-xs text-slate-400">{w.age}{w.gender[0]} · {w.summary ?? "No complaint noted"}</span>
                </span>
                {w.urgency !== "ROUTINE" && <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${URGENCY[w.urgency]}`}>{w.urgency}</span>}
              </li>
            ))}
            {data.waiting.length === 0 && <li className="py-8 text-center text-sm text-slate-400">Queue is empty.</li>}
          </ul>
        </aside>

        <div className="min-w-0 space-y-5 xl:col-span-8">
          <AnimatePresence>
            {signed && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-4 rounded-[2rem] bg-gradient-to-br from-mint-100 via-powder-100 to-lavender-100 p-5 shadow-widget">
                <CheckCircle2 className="size-8 text-mint-700" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Prescription signed for {signed.name}</p>
                  <p className="text-sm text-ink/60">Routed to pharmacy and diagnostics. <MessageCircle className="inline size-3.5" /> WhatsApp: {signed.sent.length ? signed.sent.map((s) => s.toLowerCase().replace(/_/g, " ")).join(", ") : "no phone on file"}</p>
                </div>
                <a href={`/api/rx/${signed.rxId}/pdf`} target="_blank" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium shadow-sm"><FileText className="size-4" /> View PDF</a>
              </motion.div>
            )}
          </AnimatePresence>

          {!cur ? (
            <div className="rounded-[2rem] bg-white p-10 text-center shadow-widget">
              <p className="text-lg text-slate-500">No patient in the room.</p>
              <p className="text-sm text-slate-400">Call the next token to start a consult.</p>
            </div>
          ) : (
            <>
              {/* Current patient (appointment-card style) */}
              <section className={`rounded-[2rem] bg-white p-6 shadow-widget ${cur.urgency === "EMERGENCY" ? "animate-critical ring-2 ring-blush-200" : ""}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="grid size-16 place-items-center rounded-full bg-lavender-100 text-lg font-semibold text-lavender-700 ring-4 ring-white shadow-[0_10px_24px_-10px_rgb(31_29_43/0.35)]">{initials(cur.patient.name)}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-medium tracking-tight">{cur.patient.name}</h2>
                    <p className="text-sm text-slate-400">{cur.patient.age} yrs · {cur.patient.gender.toLowerCase()} · token {cur.token}</p>
                  </div>
                  <span className="rounded-full bg-ink px-4 py-1.5 font-mono text-sm text-white">{cur.token}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {cur.patient.abhaNumber ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-mint-100 px-3 py-1 text-xs font-medium text-mint-700"><BadgeCheck className="size-3.5" /> ABHA {cur.patient.abhaNumber}</span>
                  ) : (
                    <span className="rounded-full bg-canvas px-3 py-1 text-xs text-slate-500">No ABHA linked</span>
                  )}
                  {cur.patient.allergies.length ? (
                    cur.patient.allergies.map((a) => <span key={a} className="inline-flex items-center gap-1 rounded-full bg-blush-100 px-3 py-1 text-xs font-medium text-blush-700"><ShieldAlert className="size-3.5" /> Allergy: {a}</span>)
                  ) : (
                    <span className="rounded-full bg-mint-50 px-3 py-1 text-xs text-mint-700">No known allergies</span>
                  )}
                  <span className={`rounded-full px-3 py-1 text-xs ${cur.patient.whatsappConsent ? "bg-powder-100 text-powder-700" : "bg-canvas text-slate-400"}`}>WhatsApp {cur.patient.whatsappConsent ? "on" : "off"}</span>
                  {cur.channel === "ONLINE_VOICE" && <span className="rounded-full bg-powder-50 px-3 py-1 text-xs text-powder-700">Booked by voice online</span>}
                </div>
                <div className={`mt-4 rounded-2xl px-4 py-3 ${cur.urgency === "EMERGENCY" ? "bg-blush-50" : "bg-lavender-50"}`}>
                  <p className="text-sm font-semibold">{cur.summary ?? "No complaint recorded"}</p>
                  {cur.symptomsRaw && <p className="mt-1 text-xs italic text-slate-500">“{cur.symptomsRaw}”</p>}
                  {cur.redFlags.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-blush-700"><AlertTriangle className="size-3.5" /> {cur.redFlags.join(", ")}</p>}
                </div>
                {cur.history.length > 0 && (
                  <p className="mt-3 text-xs text-slate-400">Previous Rx: {cur.history.map((h) => `${h.drugs.slice(0, 3).join(", ")}${h.signedAt ? ` (${new Date(h.signedAt).toLocaleDateString("en-IN")})` : ""}`).join(" · ")}</p>
                )}
              </section>

              <DictationBox
                primary
                value={text}
                onChange={setText}
                onSubmit={parse}
                pending={parsing}
                error={error}
                eyebrow="OPD e-prescription"
                title={cur.rx ? "Re-dictate the prescription" : "Dictate the prescription"}
                subtitle="Hold Wispr and speak as you’d write it: drug, strength, dose, frequency, duration, instructions, then tests and advice."
                placeholder={`"Tab Augmentin 625 mg BD for 5 days after food. Syrup Gelusil 2 teaspoons TID. Tab Pan 40 OD before breakfast for 14 days. CBC and LFT. Avoid spicy food. Review after 5 days."`}
                buttonLabel={cur.rx ? "Replace draft" : "Structure Rx"}
                pendingLabel="Structuring…"
                minWords={2}
              />

              {cur.rx && cur.rx.status === "DRAFT" && (
                <RxEditor key={`${cur.rx.id}-${cur.rx.rawDictation.length}`} rx={cur.rx} canSign={canSign} hprId={shell.me.hprId} busy={signing} error={signError} onSign={sign} />
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
