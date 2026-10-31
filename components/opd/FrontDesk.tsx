"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BadgeCheck, Check, Globe, Loader2, MessageCircle, Timer, UserX, Users } from "lucide-react";
import { checkIn, markNoShow, parseWalkIn, registerWalkIn } from "@/app/actions/booking";
import type { DepartmentOption, FrontDeskRow } from "@/lib/opd/booking";
import type { Intake } from "@/lib/opd/intake";
import { manualIntake } from "@/lib/opd/manual-intake";
import AppShell, { type Shell } from "../AppShell";
import DictationBox from "../DictationBox";
import { useAutoRefresh } from "../useAutoRefresh";

const STATUS: Record<string, { label: string; cls: string }> = {
  BOOKED: { label: "Booked online", cls: "bg-powder-100 text-powder-700" },
  WAITING: { label: "Waiting", cls: "bg-butter-100 text-butter-700" },
  IN_CONSULT: { label: "With doctor", cls: "bg-lavender-100 text-lavender-700" },
  COMPLETED: { label: "Done", cls: "bg-mint-100 text-mint-700" },
  NO_SHOW: { label: "No-show", cls: "bg-canvas text-slate-400" },
  CANCELLED: { label: "Cancelled", cls: "bg-canvas text-slate-400" },
};

type Form = { name: string; age: string; gender: "" | "MALE" | "FEMALE" | "OTHER"; phone: string; departmentId: string; whatsappConsent: boolean };

/** Receptionist screen: dictate a walk-in → one tap → token. Plus today's list with check-in. */
export default function FrontDesk({ shell, rows, departments }: { shell: Shell; rows: FrontDeskRow[]; departments: DepartmentOption[] }) {
  useAutoRefresh(10_000);
  const [text, setText] = useState("");
  const [intake, setIntake] = useState<Intake | null>(null);
  const [form, setForm] = useState<Form>({ name: "", age: "", gender: "", phone: "", departmentId: "", whatsappConsent: true });
  const [issued, setIssued] = useState<{ token: string; name: string; room: string; ms: number; whatsapp: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "BOOKED" | "WAITING">("all");
  const [parsing, startParse] = useTransition();
  const [saving, startSave] = useTransition();
  const [rowBusy, startRow] = useTransition();
  const t0 = useRef<number | null>(null);

  // Stopwatch starts at the first dictated word.
  useEffect(() => {
    if (text && t0.current === null) t0.current = performance.now();
    if (!text && !intake) t0.current = null;
  }, [text, intake]);

  const parse = () =>
    startParse(async () => {
      setError(null);
      const res = await parseWalkIn(text);
      if (!res.ok) return setError(res.error);
      fill(res.data);
    });

  const fill = (i: Intake) => {
      setError(null);
      setIntake(i);
      setForm({
        name: i.patientName ?? "", age: i.ageYears?.toString() ?? "", gender: i.gender ?? "", phone: i.phone ?? "",
        departmentId: departments.find((d) => d.code === i.departmentCode)?.id ?? departments[0]?.id ?? "", whatsappConsent: !!i.phone,
      });
  };

  const register = () =>
    startSave(async () => {
      if (!intake) return;
      setError(null);
      const res = await registerWalkIn({
        name: form.name, age: Number(form.age), gender: (form.gender || "OTHER") as "MALE" | "FEMALE" | "OTHER", phone: form.phone || null,
        departmentId: form.departmentId, symptomsRaw: text, symptomSummary: intake.symptomSummary, urgency: intake.urgency, redFlags: intake.redFlags, whatsappConsent: form.whatsappConsent && !!form.phone,
      });
      if (!res.ok) return setError(res.error);
      const ms = t0.current ? performance.now() - t0.current : 0;
      setIssued({ token: res.data.tokenLabel, name: res.data.patientName, room: res.data.room, ms, whatsapp: res.data.whatsapp });
      setText("");
      setIntake(null);
      t0.current = null;
    });

  const valid = form.name.trim().length >= 2 && form.age !== "" && !!form.gender && !!form.departmentId && (!form.phone || /^[6-9]\d{9}$/.test(form.phone));
  const shown = useMemo(() => rows.filter((r) => filter === "all" || r.status === filter), [rows, filter]);
  const counts = { booked: rows.filter((r) => r.status === "BOOKED").length, waiting: rows.filter((r) => r.status === "WAITING").length, done: rows.filter((r) => r.status === "COMPLETED").length };

  return (
    <AppShell shell={shell} toolbar={<h1 className="px-2 text-3xl font-light tracking-tight md:text-4xl">Front desk</h1>}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-5 xl:col-span-7">
          <DictationBox
            primary
            value={text}
            onChange={setText}
            onSubmit={parse}
            pending={parsing}
            error={intake ? null : error}
            eyebrow="Walk-in · under 5 seconds"
            title="Register a walk-in"
            subtitle="Hold Wispr and say name, age, phone and the problem, in any order."
            placeholder={`"Ramesh Kumar, 45, male, 98220 11223, fever and body ache since 3 days"`}
            buttonLabel="Fill the form"
            pendingLabel="Reading…"
            minWords={2}
          />

          {error && !intake && text.trim().length >= 5 && (
            <button onClick={() => fill(manualIntake(text))} className="-mt-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-ink shadow-widget">
              Fill the form by hand instead
            </button>
          )}

          <AnimatePresence>
            {intake && (
              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={`rounded-[2rem] bg-white p-6 shadow-widget ${intake.urgency === "EMERGENCY" ? "animate-critical ring-2 ring-blush-200" : ""}`}>
                {intake.urgency === "EMERGENCY" && (
                  <p className="mb-4 flex items-start gap-2 rounded-2xl bg-blush-100 p-3 text-sm text-blush-700">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span><b>Possible emergency:</b> {intake.redFlags.join(", ")}. Send to Casualty / triage now. The token will be placed at the top of the queue.</span>
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
                  <div className="grid grid-cols-[5rem_1fr] gap-2">
                    <Field label="Age"><input value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value.replace(/\D/g, "").slice(0, 3) })} inputMode="numeric" className="input" /></Field>
                    <Field label="Gender">
                      <div className="flex gap-1">
                        {(["FEMALE", "MALE", "OTHER"] as const).map((g) => (
                          <button key={g} onClick={() => setForm({ ...form, gender: g })} className={`flex-1 rounded-full py-2.5 text-xs capitalize ${form.gender === g ? "bg-ink text-white" : "bg-canvas text-slate-500"}`}>{g.toLowerCase()}</button>
                        ))}
                      </div>
                    </Field>
                  </div>
                  <Field label="Mobile"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} inputMode="numeric" placeholder="optional" className="input" /></Field>
                  <Field label="Complaint"><p className="rounded-2xl bg-canvas px-4 py-2.5 text-sm">{intake.symptomSummary}</p></Field>
                </div>
                <p className="mb-2 mt-4 text-xs font-medium text-slate-400">Department · {intake.departmentReason}</p>
                <div className="flex flex-wrap gap-2">
                  {departments.map((d) => (
                    <button key={d.id} onClick={() => setForm({ ...form, departmentId: d.id })} className={`rounded-full px-4 py-2 text-sm ${form.departmentId === d.id ? "bg-lavender-100 text-lavender-700 ring-2 ring-lavender-400" : "bg-canvas text-slate-600"}`}>
                      {d.name} <span className="text-xs opacity-60">· {d.room}</span>
                    </button>
                  ))}
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={form.whatsappConsent} disabled={!form.phone} onChange={(e) => setForm({ ...form, whatsappConsent: e.target.checked })} className="size-4 accent-[#1f1d2b]" />
                  Patient agreed to receive the token on WhatsApp
                </label>
                {error && <p className="mt-3 rounded-2xl bg-blush-50 px-4 py-2 text-sm text-blush-700">{error}</p>}
                <div className="mt-5 flex items-center gap-2">
                  <button onClick={() => { setIntake(null); setText(""); }} className="rounded-full px-4 py-3 text-sm text-slate-500 hover:bg-canvas">Clear</button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={register} disabled={saving || !valid} className="ml-auto inline-flex items-center gap-2 rounded-full bg-ink py-2 pl-2 pr-6 text-base font-medium text-white shadow-[0_14px_30px_-10px_rgb(31_29_43/0.6)] disabled:bg-ink/25">
                    <span className="grid size-10 place-items-center rounded-full bg-white/15">{saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}</span>
                    Register &amp; issue token
                  </motion.button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {issued && (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-5 rounded-[2rem] bg-gradient-to-br from-mint-100 via-powder-100 to-lavender-100 p-6 shadow-widget">
                <div>
                  <p className="text-sm text-ink/60">Token issued to {issued.name}</p>
                  <p className="font-mono text-5xl font-semibold tracking-tight">{issued.token}</p>
                  <p className="text-sm text-ink/60">{issued.room}</p>
                </div>
                <div className="ml-auto space-y-2 text-right">
                  {issued.ms > 0 && (
                    <p className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${issued.ms <= 5000 ? "bg-mint-50 text-mint-700" : "bg-butter-50 text-butter-700"}`}>
                      <Timer className="size-4" /> {(issued.ms / 1000).toFixed(1)} s from first word
                    </p>
                  )}
                  {issued.whatsapp && <p className="flex items-center justify-end gap-1.5 text-xs text-ink/60"><MessageCircle className="size-3.5" /> WhatsApp: {issued.whatsapp.toLowerCase().replace(/_/g, " ")}</p>}
                  <button onClick={() => setIssued(null)} className="text-xs text-ink/50 underline">Dismiss</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Today */}
        <section className="min-w-0 rounded-[2rem] bg-white p-6 shadow-widget xl:col-span-5">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-xl font-medium">Today’s tokens</h2>
              <p className="text-sm text-slate-400">{counts.booked} booked online · {counts.waiting} waiting · {counts.done} done</p>
            </div>
            <div className="flex gap-1 rounded-full bg-canvas p-1 text-xs">
              {(["all", "BOOKED", "WAITING"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 ${filter === f ? "bg-ink text-white" : "text-slate-500"}`}>{f === "all" ? "All" : STATUS[f].label}</button>
              ))}
            </div>
          </header>
          <ul className="max-h-[70dvh] space-y-2 overflow-y-auto pr-1">
            {shown.map((r) => (
              <li key={r.id} className={`flex items-center gap-3 rounded-2xl p-3 ${r.urgency === "EMERGENCY" ? "bg-blush-50" : "bg-canvas"}`}>
                <span className="w-[4.5rem] shrink-0 font-mono text-sm font-semibold">{r.token}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                    {r.patient}
                    {r.abha && <BadgeCheck className="size-3.5 shrink-0 text-mint-700" aria-label="ABHA linked" />}
                    {r.channel === "ONLINE_VOICE" ? <Globe className="size-3.5 shrink-0 text-powder-700" aria-label="Booked online" /> : <Users className="size-3.5 shrink-0 text-slate-400" aria-label="Walk-in" />}
                  </p>
                  <p className="truncate text-xs text-slate-400">{r.age}{r.gender[0]} · {r.department} · {r.summary ?? ""}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span>
                {r.status === "BOOKED" && (
                  <button disabled={rowBusy} onClick={() => startRow(async () => { await checkIn(r.id); })} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs text-white">Check in</button>
                )}
                {(r.status === "BOOKED" || r.status === "WAITING") && (
                  <button disabled={rowBusy} title="Mark no-show" aria-label={`Mark ${r.token} no-show`} onClick={() => startRow(async () => { await markNoShow(r.id); })} className="grid size-8 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-blush-700">
                    <UserX className="size-4" />
                  </button>
                )}
              </li>
            ))}
            {shown.length === 0 && <li className="py-10 text-center text-sm text-slate-400">No tokens yet today.</li>}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}
