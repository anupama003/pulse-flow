"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, CalendarDays, Check, CheckCircle2, Loader2, MapPin, MessageCircle, Mic, Phone, Sparkles, Square } from "lucide-react";
import { analyzeSymptoms, bookOnline } from "@/app/actions/booking";
import type { Intake } from "@/lib/opd/intake";
import { manualIntake } from "@/lib/opd/manual-intake";
import { PulseFlowFooter, PulseFlowMark } from "../brand/PulseFlowLogo";
import AbhaLinker, { type LinkedAbha } from "./AbhaLinker";
import { useSpeechInput } from "./useSpeechInput";

interface Dept {
  id: string;
  code: string;
  name: string;
  room: string;
  consultant: { name: string } | null;
}
interface Props {
  facility: { slug: string; name: string; city: string; phone: string | null };
  departments: Dept[];
  today: string;
  tomorrow: string;
}
type Step = "speak" | "form" | "emergency" | "done";
type Confirmation = { tokenLabel: string; date: string; department: string; room: string; consultant: string | null; patientName: string; abhaLinked: boolean; whatsapp: string | null };

const EXAMPLES = ["I need an appointment for severe acidity and stomach pain tomorrow", "My 6 year old son has an itchy rash on his arms since 3 days"];

/** Public, mobile-first, voice-first OPD booking. */
export default function BookingFlow({ facility, departments, today, tomorrow }: Props) {
  const [step, setStep] = useState<Step>("speak");
  const [text, setText] = useState("");
  const [intake, setIntake] = useState<Intake | null>(null);
  const [form, setForm] = useState({ name: "", age: "", gender: "" as "" | "MALE" | "FEMALE" | "OTHER", phone: "", departmentId: "", date: tomorrow, slot: null as null | "MORNING" | "AFTERNOON" | "EVENING" });
  const [abha, setAbha] = useState<LinkedAbha | null>(null);
  const [consent, setConsent] = useState({ care: false, whatsapp: true });
  const [conf, setConf] = useState<Confirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const speech = useSpeechInput((t) => setText((cur) => (cur ? `${cur} ${t}` : t)));
  const dept = departments.find((d) => d.id === form.departmentId);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const apply = (i: Intake) => {
    setIntake(i);
    setForm({
      name: i.patientName ?? "",
      age: i.ageYears?.toString() ?? "",
      gender: i.gender ?? "",
      phone: i.phone ?? "",
      departmentId: departments.find((d) => d.code === i.departmentCode)?.id ?? departments[0]?.id ?? "",
      date: i.preferredDate ?? (i.urgency === "SOON" ? today : tomorrow),
      slot: i.preferredSlot,
    });
    setError(null);
    setStep(i.urgency === "EMERGENCY" ? "emergency" : "form");
  };

  const analyze = () =>
    start(async () => {
      speech.stop();
      setError(null);
      const res = await analyzeSymptoms(facility.slug, text);
      if (!res.ok) return setError(res.error);
      apply(res.data);
    });

  const book = () =>
    start(async () => {
      if (!intake) return;
      setError(null);
      const res = await bookOnline({
        facilitySlug: facility.slug, name: form.name, age: Number(form.age), gender: (form.gender || "OTHER") as "MALE" | "FEMALE" | "OTHER", phone: form.phone,
        departmentId: form.departmentId, date: form.date, slot: form.slot, symptomsRaw: text, symptomSummary: intake.symptomSummary,
        urgency: intake.urgency, redFlags: intake.redFlags, careConsent: consent.care as true, whatsappConsent: consent.whatsapp,
        abha: abha ? { txnId: abha.txnId, abhaNumber: abha.abhaNumber, abhaAddress: abha.abhaAddress } : null,
      });
      if (!res.ok) return setError(res.error);
      setConf(res.data);
      setStep("done");
    });

  const formValid = form.name.trim().length >= 2 && form.age !== "" && !!form.gender && /^[6-9]\d{9}$/.test(form.phone) && !!form.departmentId && consent.care;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <PulseFlowMark size={44} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{facility.name}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="size-3" /> {facility.city} · OPD booking by Pulse Flow
          </p>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {/* ── 1. Speak ─────────────────────────────────────────────────────── */}
        {step === "speak" && (
          <motion.section key="speak" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-1 flex-col">
            <div className="relative overflow-clip rounded-[2rem] bg-gradient-to-br from-lavender-200 via-[#dcdafc] to-powder-200 p-6 shadow-widget">
              <div className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full bg-white/40 blur-2xl" />
              <p className="relative mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-lavender-700">
                <Sparkles className="size-3" /> Speak, don’t type
              </p>
              <h1 className="relative text-3xl font-normal leading-tight tracking-tight">What’s bothering you?</h1>
              <p className="relative mt-2 text-sm text-ink/60">Tap the mic and describe the problem in your own words. We’ll find the right doctor and the next token.</p>

              <div className="relative mt-6 flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={speech.listening ? speech.stop : speech.start}
                  disabled={!speech.supported}
                  aria-label={speech.listening ? "Stop recording" : "Start speaking"}
                  className={`relative grid size-28 place-items-center rounded-full text-white shadow-[0_20px_40px_-12px_rgb(31_29_43/0.6)] transition ${speech.listening ? "bg-blush-700" : "bg-ink"} disabled:bg-ink/30`}
                >
                  {speech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-blush-300/50" />}
                  {speech.listening ? <Square className="relative size-9" fill="currentColor" /> : <Mic className="relative size-11" />}
                </motion.button>
                <p className="mt-3 text-sm text-ink/60" aria-live="polite">
                  {!speech.supported ? "Voice isn’t supported in this browser. Use your keyboard’s mic." : speech.listening ? "Listening… tap to stop" : "Tap to speak"}
                </p>
                {speech.error && <p className="mt-1 text-xs text-blush-700">{speech.error}</p>}
              </div>
            </div>

            <label className="mt-4 block">
              <span className="sr-only">Your problem</span>
              <textarea
                value={speech.interim ? `${text} ${speech.interim}`.trim() : text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder={`e.g. "${EXAMPLES[0]}"`}
                className="w-full resize-none rounded-3xl bg-white p-4 text-base leading-relaxed shadow-widget outline-none ring-lavender-100 placeholder:text-slate-400 focus:ring-4"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => setText(e)} className="rounded-full bg-white/70 px-3 py-1.5 text-left text-xs text-slate-500 shadow-sm">
                  “{e.length > 42 ? `${e.slice(0, 42)}…` : e}”
                </button>
              ))}
            </div>
            {error && (
              <div className="mt-3 rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">
                {error}
                {text.trim().length >= 8 && (
                  <button onClick={() => apply(manualIntake(text))} className="mt-2 block font-semibold underline">Fill in the form myself</button>
                )}
              </div>
            )}
            <button onClick={analyze} disabled={pending || text.trim().length < 8} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-base font-medium text-white shadow-[0_14px_30px_-10px_rgb(31_29_43/0.6)] disabled:bg-ink/25 disabled:shadow-none">
              {pending ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              {pending ? "Finding the right doctor…" : "Find my doctor"}
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-400">This does not diagnose. In an emergency, call 108.</p>
          </motion.section>
        )}

        {/* ── Emergency ────────────────────────────────────────────────────── */}
        {step === "emergency" && intake && (
          <motion.section key="em" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-[2rem] bg-blush-100 p-6 text-blush-700 shadow-widget">
            <AlertTriangle className="size-10" />
            <h1 className="mt-3 text-2xl font-semibold text-ink">This may need emergency care</h1>
            <p className="mt-2 text-sm">Please don’t wait for an OPD appointment. Go to the nearest emergency department now, or call an ambulance.</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {intake.redFlags.map((f) => (
                <li key={f} className="rounded-full bg-white px-3 py-1 text-xs font-medium">{f}</li>
              ))}
            </ul>
            <a href="tel:108" className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-blush-700 py-4 text-lg font-semibold text-white">
              <Phone className="size-5" /> Call 108
            </a>
            {facility.phone && (
              <a href={`tel:${facility.phone}`} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-sm font-medium text-ink">
                Call {facility.name} emergency
              </a>
            )}
            <button onClick={() => setStep("speak")} className="mt-4 flex w-full items-center justify-center gap-1 text-sm text-ink/60">
              <ArrowLeft className="size-4" /> I described it wrong, go back
            </button>
          </motion.section>
        )}

        {/* ── 2. Pre-filled form ───────────────────────────────────────────── */}
        {step === "form" && intake && (
          <motion.section key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <button onClick={() => setStep("speak")} className="flex items-center gap-1 text-sm text-slate-500">
              <ArrowLeft className="size-4" /> Change what I said
            </button>

            <div className="rounded-3xl bg-white p-5 shadow-widget">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">We heard</p>
              <p className="mt-1 text-lg leading-snug">“{intake.symptomSummary}”{intake.durationText ? ` · ${intake.durationText}` : ""}</p>
              {intake.urgency === "SOON" && <p className="mt-2 inline-flex rounded-full bg-butter-100 px-3 py-1 text-xs font-medium text-butter-700">We suggest being seen soon</p>}
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-widget">
              <p className="mb-1 text-sm font-semibold">Department</p>
              <p className="mb-3 text-xs text-slate-400">{intake.departmentReason}</p>
              <div className="grid grid-cols-2 gap-2">
                {departments.map((d) => (
                  <button key={d.id} onClick={() => set("departmentId", d.id)} className={`rounded-2xl p-3 text-left transition ${form.departmentId === d.id ? "bg-lavender-100 ring-2 ring-lavender-400" : "bg-canvas"}`}>
                    <span className="block text-sm font-semibold">{d.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">{d.consultant?.name ?? "Duty doctor"} · {d.room}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 shadow-widget">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-lavender-400" /> When</p>
              <div className="flex gap-2">
                {[{ v: today, l: "Today" }, { v: tomorrow, l: "Tomorrow" }].map((o) => (
                  <button key={o.v} onClick={() => set("date", o.v)} className={`flex-1 rounded-full py-2.5 text-sm ${form.date === o.v ? "bg-ink text-white" : "bg-canvas text-slate-600"}`}>{o.l}</button>
                ))}
                <input type="date" min={today} value={form.date} onChange={(e) => set("date", e.target.value)} aria-label="Pick a date" className="flex-1 rounded-full bg-canvas px-3 text-sm outline-none" />
              </div>
              <div className="mt-2 flex gap-2">
                {(["MORNING", "AFTERNOON", "EVENING"] as const).map((s) => (
                  <button key={s} onClick={() => set("slot", form.slot === s ? null : s)} className={`flex-1 rounded-full py-2 text-xs capitalize ${form.slot === s ? "bg-lavender-100 text-lavender-700 ring-1 ring-lavender-400" : "bg-canvas text-slate-500"}`}>{s.toLowerCase()}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-3xl bg-white p-5 shadow-widget">
              <p className="text-sm font-semibold">Patient{intake.bookingForSomeoneElse ? " (the person who needs care)" : ""}</p>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" aria-label="Patient name" autoComplete="name" className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none focus:ring-4 focus:ring-lavender-100" />
              <div className="flex gap-2">
                <input value={form.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="Age" aria-label="Age in years" className="w-24 rounded-2xl bg-canvas px-4 py-3 outline-none focus:ring-4 focus:ring-lavender-100" />
                {(["FEMALE", "MALE", "OTHER"] as const).map((g) => (
                  <button key={g} onClick={() => set("gender", g)} className={`flex-1 rounded-full text-sm capitalize ${form.gender === g ? "bg-ink text-white" : "bg-canvas text-slate-500"}`}>{g.toLowerCase()}</button>
                ))}
              </div>
              <label className="flex items-center gap-2 rounded-2xl bg-canvas px-4 focus-within:ring-4 focus-within:ring-lavender-100">
                <span className="text-sm text-slate-400">+91</span>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" autoComplete="tel-national" placeholder="WhatsApp mobile number" aria-label="Mobile number" className="w-full bg-transparent py-3 outline-none" />
              </label>
            </div>

            <AbhaLinker defaultMobile={form.phone} defaultName={form.name} onLinked={setAbha} />

            <div className="space-y-3 rounded-3xl bg-white p-5 text-sm shadow-widget">
              <label className="flex gap-3">
                <input type="checkbox" checked={consent.care} onChange={(e) => setConsent({ ...consent, care: e.target.checked })} className="mt-1 size-5 accent-[#1f1d2b]" />
                <span>I consent to {facility.name} processing these details to book and provide my care (Digital Personal Data Protection Act, 2023). <b>Required</b></span>
              </label>
              <label className="flex gap-3">
                <input type="checkbox" checked={consent.whatsapp} onChange={(e) => setConsent({ ...consent, whatsapp: e.target.checked })} className="mt-1 size-5 accent-[#1f1d2b]" />
                <span>Send my token, prescription and care instructions on WhatsApp. <span className="text-slate-400">Optional, you can withdraw anytime.</span></span>
              </label>
            </div>

            {error && <p className="rounded-2xl bg-blush-50 px-4 py-3 text-sm text-blush-700">{error}</p>}
            <button onClick={book} disabled={pending || !formValid} className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-base font-medium text-white shadow-[0_14px_30px_-10px_rgb(31_29_43/0.6)] disabled:bg-ink/25 disabled:shadow-none">
              {pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              {pending ? "Booking…" : `Confirm ${dept?.name ?? ""} token`}
            </button>
          </motion.section>
        )}

        {/* ── 3. Token ─────────────────────────────────────────────────────── */}
        {step === "done" && conf && (
          <motion.section key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="overflow-hidden rounded-[2rem] bg-white shadow-float">
              <div className="bg-gradient-to-br from-mint-100 via-powder-100 to-lavender-100 p-6 text-center">
                <CheckCircle2 className="mx-auto size-10 text-mint-700" />
                <p className="mt-2 text-sm text-ink/60">Your OPD token</p>
                <p className="mt-1 font-mono text-6xl font-semibold tracking-tight text-ink">{conf.tokenLabel}</p>
              </div>
              <dl className="grid grid-cols-2 gap-2 p-5 text-sm">
                {[
                  ["Patient", conf.patientName],
                  ["Date", new Date(conf.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })],
                  ["Department", conf.department],
                  ["Room", conf.room],
                  ["Doctor", conf.consultant ?? "Duty doctor"],
                  ["ABHA", conf.abhaLinked ? "Linked" : "Not linked"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-canvas px-3 py-2">
                    <dt className="text-[11px] font-medium text-powder-700">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {conf.whatsapp && (
              <p className="flex items-center justify-center gap-2 rounded-full bg-mint-50 py-2.5 text-sm text-mint-700">
                <MessageCircle className="size-4" />
                {conf.whatsapp === "SENT" ? "Token sent to your WhatsApp" : conf.whatsapp === "SIMULATED" ? "WhatsApp message prepared (demo mode, not sent)" : conf.whatsapp === "SKIPPED_NO_CONSENT" ? "WhatsApp off as you chose" : "WhatsApp couldn’t be sent. Please screenshot this token."}
              </p>
            )}
            <p className="text-center text-xs text-slate-400">Arrive 15 minutes early and show this token at the front desk to check in.</p>
            <button onClick={() => { setStep("speak"); setText(""); setConf(null); setAbha(null); }} className="w-full rounded-full bg-white py-3 text-sm text-slate-600 shadow-widget">Book another</button>
          </motion.section>
        )}
      </AnimatePresence>
      <PulseFlowFooter className="mt-auto pt-8" />
    </div>
  );
}
