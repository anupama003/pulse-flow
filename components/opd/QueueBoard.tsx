"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Stethoscope, Volume2, VolumeX } from "lucide-react";
import { PulseFlowFooter, PulseFlowMark } from "../brand/PulseFlowLogo";
import type { QueueRoom } from "@/lib/opd/booking";

type Feed = { facility: { name: string; slug: string }; rooms: QueueRoom[]; at: string };

/** Waiting-room TV. Polls /api/queue every 5 s; names are masked server-side. */
export default function QueueBoard({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState(initial);
  const [now, setNow] = useState(() => new Date());
  const [sound, setSound] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const prev = useRef(new Map(initial.rooms.map((r) => [r.departmentId, r.nowServing?.token])));

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/queue?f=${encodeURIComponent(feed.facility.slug)}`, { cache: "no-store" });
        if (res.ok) setFeed(await res.json());
      } catch {}
    }, 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [feed.facility.slug]);

  // Announce newly called tokens (needs one tap on "Sound" first: browsers block autoplay audio).
  useEffect(() => {
    for (const r of feed.rooms) {
      const before = prev.current.get(r.departmentId);
      const cur = r.nowServing?.token;
      if (cur && cur !== before) {
        setFlash(r.departmentId);
        setTimeout(() => setFlash(null), 4000);
        if (sound && "speechSynthesis" in window) {
          const u = new SpeechSynthesisUtterance(`Token ${cur.replace("-", " ")}, please go to ${r.room}`);
          u.lang = "en-IN";
          window.speechSynthesis.speak(u);
        }
      }
      prev.current.set(r.departmentId, cur);
    }
  }, [feed, sound]);

  const waitingTotal = feed.rooms.reduce((n, r) => n + r.waiting.length, 0);

  return (
    <div className="min-h-dvh p-4 md:p-8">
      <div className="mx-auto max-w-[1800px] rounded-[2.75rem] bg-white p-5 shadow-float md:p-8">
        <header className="mb-6 flex flex-wrap items-center gap-4">
          <PulseFlowMark size={56} />
          <div>
            <h1 className="text-3xl font-light tracking-tight md:text-5xl">{feed.facility.name}</h1>
            <p className="text-slate-400">OPD queue · {waitingTotal} waiting</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => setSound((s) => !s)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${sound ? "bg-mint-100 text-mint-700" : "bg-canvas text-slate-500"}`} aria-pressed={sound}>
              {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} Announcements {sound ? "on" : "off"}
            </button>
            <span className="rounded-full bg-ink px-5 py-2 font-mono text-2xl text-white tabular-nums" suppressHydrationWarning>
              {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
            </span>
          </div>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 2xl:grid-cols-4">
          {feed.rooms.map((r) => (
            <motion.section
              key={r.departmentId}
              animate={flash === r.departmentId ? { scale: [1, 1.03, 1] } : {}}
              transition={{ duration: 0.8 }}
              className={`flex flex-col rounded-[2rem] bg-canvas p-5 ${flash === r.departmentId ? "ring-4 ring-lavender-400" : ""}`}
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-medium">{r.department}</h2>
                  <p className="flex items-center gap-1.5 truncate text-sm text-slate-500"><Stethoscope className="size-4" /> {r.consultant ?? "Duty doctor"}</p>
                </div>
                <span className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-lg font-medium text-white">{r.room}</span>
              </div>

              <div className="rounded-3xl bg-gradient-to-br from-lavender-200 via-[#dcdafc] to-powder-200 p-5 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender-700">Now serving</p>
                <AnimatePresence mode="wait">
                  <motion.p key={r.nowServing?.token ?? "none"} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mt-1 font-mono text-6xl font-semibold tracking-tight text-ink md:text-7xl">
                    {r.nowServing?.token ?? "-"}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-lg text-ink/60">{r.nowServing?.name ?? "Please wait"}</p>
              </div>

              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Up next</p>
              <ul className="space-y-2">
                {r.waiting.slice(0, 4).map((w, i) => (
                  <li key={w.id} className={`flex items-center justify-between rounded-2xl px-4 py-2.5 ${i === 0 ? "bg-white shadow-sm" : "bg-white/60"}`}>
                    <span className="font-mono text-2xl font-semibold">{w.token}</span>
                    <span className="flex items-center gap-2 text-sm text-slate-500">
                      {w.name}
                      {w.urgency !== "ROUTINE" && <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${w.urgency === "EMERGENCY" ? "bg-blush-100 text-blush-700" : "bg-butter-100 text-butter-700"}`}>Priority</span>}
                    </span>
                  </li>
                ))}
                {r.waiting.length === 0 && <li className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-slate-400">No one waiting</li>}
              </ul>
              <p className="mt-auto pt-4 text-xs text-slate-400">{r.waiting.length > 4 ? `+${r.waiting.length - 4} more · ` : ""}{r.done} seen today</p>
            </motion.section>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Names are shortened for privacy. Please keep your token handy. In an emergency, alert the front desk immediately.</p>
        <PulseFlowFooter />
      </div>
    </div>
  );
}
