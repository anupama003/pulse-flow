"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, CircleUserRound, KeyRound, Loader2, MessageSquareText, Plus, ShieldCheck, Smartphone } from "lucide-react";
import { abhaCreate, abhaRequestOtp, abhaVerifyOtp } from "@/app/actions/booking";

export interface LinkedAbha {
  txnId: string;
  abhaNumber: string;
  abhaAddress: string;
  name: string;
}

type Account = { abhaNumber: string; abhaAddress: string; name: string; gender: string; yearOfBirth: number };
type Step = "mobile" | "otp" | "choose" | "create" | "linked";

/**
 * ABDM Milestone 1 flow, simulated: mobile OTP → verify → pick an existing ABHA or create one →
 * link to this booking. Clearly labelled SANDBOX. No real ABDM call, no Aadhaar collected.
 */
export default function AbhaLinker({ defaultMobile, defaultName, onLinked }: { defaultMobile: string; defaultName: string; onLinked: (a: LinkedAbha | null) => void }) {
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState(defaultMobile);
  const [otp, setOtp] = useState("");
  const [txn, setTxn] = useState<{ txnId: string; sentTo: string; sandboxOtp: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [linked, setLinked] = useState<LinkedAbha | null>(null);
  const [profile, setProfile] = useState({ name: defaultName, gender: "FEMALE" as "MALE" | "FEMALE" | "OTHER", yearOfBirth: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>) => start(async () => { setError(null); await fn(); });

  const sendOtp = () => run(async () => {
    const res = await abhaRequestOtp(mobile);
    if (!res.ok) return setError(res.error);
    setTxn(res.data);
    setStep("otp");
  });
  const verify = () => run(async () => {
    if (!txn) return;
    const res = await abhaVerifyOtp(txn.txnId, otp);
    if (!res.ok) return setError(res.error);
    setAccounts(res.data.accounts);
    setStep(res.data.accounts.length ? "choose" : "create");
  });
  const link = (a: Account) => {
    if (!txn) return;
    const l = { txnId: txn.txnId, abhaNumber: a.abhaNumber, abhaAddress: a.abhaAddress, name: a.name };
    setLinked(l);
    setStep("linked");
    onLinked(l);
  };
  const create = () => run(async () => {
    if (!txn) return;
    const res = await abhaCreate(txn.txnId, { name: profile.name, gender: profile.gender, yearOfBirth: Number(profile.yearOfBirth) });
    if (!res.ok) return setError(res.error);
    link(res.data);
  });

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-slate-100">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5 text-mint-700" /> Link your ABHA <span className="font-normal text-slate-400">(optional)</span>
          </h3>
          <p className="text-xs text-slate-400">Ayushman Bharat Health Account: keeps your records portable across hospitals.</p>
        </div>
        <span className="shrink-0 rounded-full bg-butter-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-butter-700">Sandbox</span>
      </header>

      <AnimatePresence mode="wait">
        {step === "mobile" && (
          <motion.div key="m" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-2xl bg-canvas px-4">
              <Smartphone className="size-4 text-slate-400" />
              <span className="text-sm text-slate-400">+91</span>
              <input value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="Mobile linked to ABHA" aria-label="Mobile number for ABHA" className="w-full bg-transparent py-3 text-base outline-none" />
            </label>
            <button onClick={sendOtp} disabled={pending || mobile.length !== 10} className="rounded-full bg-ink px-5 text-sm font-medium text-white disabled:bg-ink/25">
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Get OTP"}
            </button>
          </motion.div>
        )}

        {step === "otp" && txn && (
          <motion.div key="o" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="flex items-start gap-2 rounded-2xl bg-butter-50 p-3 text-sm text-butter-700">
              <MessageSquareText className="mt-0.5 size-4 shrink-0" />
              <span>
                Sandbox SMS to {txn.sentTo}: your ABHA OTP is <b className="font-mono tracking-widest">{txn.sandboxOtp}</b>. In production this arrives by SMS from ABDM.
              </span>
            </p>
            <div className="flex gap-2">
              <label className="flex flex-1 items-center gap-2 rounded-2xl bg-canvas px-4">
                <KeyRound className="size-4 text-slate-400" />
                <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit OTP" aria-label="OTP" className="w-full bg-transparent py-3 font-mono text-lg tracking-[0.4em] outline-none" />
              </label>
              <button onClick={verify} disabled={pending || otp.length !== 6} className="rounded-full bg-ink px-5 text-sm font-medium text-white disabled:bg-ink/25">
                {pending ? <Loader2 className="size-4 animate-spin" /> : "Verify"}
              </button>
            </div>
          </motion.div>
        )}

        {step === "choose" && (
          <motion.div key="c" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <p className="text-sm text-slate-500">ABHA accounts on this mobile:</p>
            {accounts.map((a) => (
              <button key={a.abhaNumber} onClick={() => link(a)} className="flex w-full items-center gap-3 rounded-2xl bg-mint-50 p-3 text-left transition hover:ring-2 hover:ring-mint-200">
                <CircleUserRound className="size-8 text-mint-700" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{a.name}</span>
                  <span className="block font-mono text-xs text-slate-500">{a.abhaNumber} · {a.abhaAddress}</span>
                </span>
                <span className="rounded-full bg-ink px-3 py-1 text-xs text-white">Link</span>
              </button>
            ))}
            <button onClick={() => setStep("create")} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 p-3 text-sm text-slate-500 hover:text-ink">
              <Plus className="size-4" /> Create a new ABHA for someone else
            </button>
          </motion.div>
        )}

        {step === "create" && (
          <motion.div key="n" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <p className="text-sm text-slate-500">No ABHA found. Create one (mobile already verified):</p>
            <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Full name" aria-label="Full name for ABHA" className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none" />
            <div className="flex gap-2">
              {(["FEMALE", "MALE", "OTHER"] as const).map((g) => (
                <button key={g} onClick={() => setProfile({ ...profile, gender: g })} className={`flex-1 rounded-full py-2 text-sm capitalize ${profile.gender === g ? "bg-ink text-white" : "bg-canvas text-slate-500"}`}>
                  {g.toLowerCase()}
                </button>
              ))}
            </div>
            <input value={profile.yearOfBirth} onChange={(e) => setProfile({ ...profile, yearOfBirth: e.target.value.replace(/\D/g, "").slice(0, 4) })} inputMode="numeric" placeholder="Year of birth" aria-label="Year of birth" className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none" />
            <button onClick={create} disabled={pending || profile.name.trim().length < 2 || profile.yearOfBirth.length !== 4} className="w-full rounded-full bg-ink py-3 text-sm font-medium text-white disabled:bg-ink/25">
              {pending ? <Loader2 className="mx-auto size-4 animate-spin" /> : "Create sandbox ABHA & link"}
            </button>
          </motion.div>
        )}

        {step === "linked" && linked && (
          <motion.div key="l" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="rounded-3xl bg-gradient-to-br from-mint-100 via-powder-100 to-lavender-100 p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mint-700">
              <BadgeCheck className="size-4" /> ABHA linked to this booking
            </p>
            <p className="mt-3 font-mono text-2xl tracking-wider text-ink">{linked.abhaNumber}</p>
            <p className="mt-1 text-sm text-ink/70">{linked.name} · {linked.abhaAddress}</p>
            <button onClick={() => { setLinked(null); onLinked(null); setStep("mobile"); }} className="mt-3 text-xs text-slate-500 underline">Unlink</button>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <p className="mt-2 rounded-2xl bg-blush-50 px-3 py-2 text-sm text-blush-700">{error}</p>}
    </section>
  );
}
