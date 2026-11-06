"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { PulseFlowMark } from "./PulseFlowLogo";
import { SPLASH_DONE_EVENT, SPLASH_KEY } from "./splash-key";

// 5-second Pulse Flow intro, shown once per browser tab session before the app.
// White → blush → lavender background that slowly shifts, the dark Pulse Flow mark, a
// full-width heartbeat line, and drifting pink/purple accents (crosses, rings, dots).
//   • replay any time with ?splash=1
//   • skip with the button, Esc, Enter or a click
//   • reduced-motion users get a short, calm fade instead
// It isn't shown on the public booking page or the waiting-room TV.
//
// Looping/decorative motion uses CSS keyframes (globals.css, "pf-*"): it's exact (the line always
// reaches the end) and keeps time even if the tab is briefly in the background. Entrances use Framer.

const DURATION_MS = 5000;
const EXIT_MS = 700;
const HIDDEN_ON = ["/book", "/queue"];
const EASE = [0.22, 1, 0.36, 1] as const;

/** Full-width line: flat → heartbeat → flat behind the mark → a wave that runs to the right edge. */
const LINE = "M0 60 H150 L170 44 L190 82 L212 14 L234 104 L252 50 L266 60 H780 C810 60 830 34 870 34 S930 86 970 86 S1030 34 1070 34 S1130 70 1200 60";

// Accents live in the outer band so the centre stays clean. Positions are fixed (no hydration drift).
type Accent = { kind: "cross" | "ring" | "dot"; top: string; left: string; size: number; color: string; delay: number; dur: number };
const ACCENTS: Accent[] = [
  { kind: "cross", top: "12%", left: "10%", size: 22, color: "#f490a3", delay: 0.3, dur: 7 },
  { kind: "ring", top: "18%", left: "84%", size: 46, color: "#a99ff2", delay: 0.5, dur: 9 },
  { kind: "dot", top: "30%", left: "22%", size: 10, color: "#a99ff2", delay: 0.7, dur: 6 },
  { kind: "cross", top: "72%", left: "88%", size: 18, color: "#a99ff2", delay: 0.6, dur: 8 },
  { kind: "ring", top: "78%", left: "14%", size: 34, color: "#f490a3", delay: 0.9, dur: 10 },
  { kind: "dot", top: "86%", left: "64%", size: 8, color: "#f490a3", delay: 1.0, dur: 7 },
  { kind: "dot", top: "10%", left: "58%", size: 7, color: "#f9b0c0", delay: 0.8, dur: 6.5 },
  { kind: "cross", top: "40%", left: "92%", size: 14, color: "#f9b0c0", delay: 1.1, dur: 9 },
  { kind: "ring", top: "62%", left: "4%", size: 22, color: "#a99ff2", delay: 1.2, dur: 8 },
  { kind: "dot", top: "54%", left: "78%", size: 6, color: "#a99ff2", delay: 1.3, dur: 5.5 },
];

function AccentShape({ a, i }: { a: Accent; i: number }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute"
      style={{ top: a.top, left: a.left }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, delay: a.delay, ease: EASE }}
    >
      <span className="pf-float block" style={{ animationDuration: `${a.dur}s`, animationDelay: `${-i * 0.7}s` }}>
        {a.kind === "cross" && (
          <svg width={a.size} height={a.size} viewBox="0 0 24 24" className="pf-spin" style={{ animationDuration: `${a.dur * 2}s` }}>
            <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill={a.color} opacity="0.55" />
          </svg>
        )}
        {a.kind === "ring" && <span className="block rounded-full border-2" style={{ width: a.size, height: a.size, borderColor: a.color, opacity: 0.45 }} />}
        {a.kind === "dot" && <span className="block rounded-full" style={{ width: a.size, height: a.size, backgroundColor: a.color, opacity: 0.6 }} />}
      </span>
    </motion.span>
  );
}

export default function SplashScreen() {
  const path = usePathname();
  const reduce = useReducedMotion();
  const hiddenHere = HIDDEN_ON.some((p) => path?.startsWith(p));
  // "on" → playing; "leaving" → exit; "off" → unmounted. Timer-driven so the app always appears on schedule.
  const [phase, setPhase] = useState<"on" | "leaving" | "off">(hiddenHere ? "off" : "on");

  const finish = useCallback(() => {
    setPhase((p) => (p === "on" ? "leaving" : p));
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {}
  }, []);

  useEffect(() => {
    if (phase !== "on") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  // Tell the app the intro is over (the first-visit tour waits for this).
  useEffect(() => {
    if (phase === "off") window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t = setTimeout(() => setPhase("off"), EXIT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (hiddenHere) return setPhase("off");
    const replay = new URLSearchParams(window.location.search).has("splash");
    let seen = false;
    try {
      seen = sessionStorage.getItem(SPLASH_KEY) === "1";
    } catch {}
    if (seen && !replay) return setPhase("off");

    const total = reduce ? 1500 : DURATION_MS;
    const done = setTimeout(finish, total - EXIT_MS);
    const onKey = (e: KeyboardEvent) => ["Escape", "Enter", " "].includes(e.key) && finish();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(done);
      window.removeEventListener("keydown", onKey);
    };
  }, [hiddenHere, reduce, finish]);

  if (hiddenHere || phase === "off") return null;
  const leaving = phase === "leaving";

  return (
    <motion.div
      id="pf-splash"
      role="status"
      aria-live="polite"
      aria-label="Loading Pulse Flow"
      onClick={finish}
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: EASE }}
      style={{ pointerEvents: leaving ? "none" : "auto" }}
      className="pf-bg fixed inset-0 z-[200] flex cursor-pointer select-none flex-col items-center justify-center overflow-hidden"
    >
      {reduce ? (
        <div className="flex flex-col items-center gap-5">
          <PulseFlowMark size={96} animated={false} />
          <p className="text-4xl font-light tracking-tight text-ink">
            Pulse <span className="text-lavender-700">Flow</span>
          </p>
        </div>
      ) : (
        <>
          {ACCENTS.map((a, i) => (
            <AccentShape key={i} a={a} i={i} />
          ))}

          <motion.div
            className="relative flex w-full flex-col items-center"
            animate={leaving ? { y: -14, opacity: 0 } : { y: 0, opacity: 1 }}
            transition={{ duration: EXIT_MS / 1000, ease: EASE }}
          >
            {/* Full-width heartbeat line. No vector-effect, so pathLength="1" + dashoffset is exact
                and the draw always reaches the right edge. */}
            <svg aria-hidden viewBox="0 0 1200 120" preserveAspectRatio="none" className="pointer-events-none absolute left-0 top-[42px] h-24 w-full md:top-[46px]">
              <defs>
                <linearGradient id="pf-line" x1="0" x2="1200" y1="0" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#f490a3" stopOpacity="0.2" />
                  <stop offset="0.2" stopColor="#f490a3" />
                  <stop offset="0.55" stopColor="#c08be8" />
                  <stop offset="0.85" stopColor="#a99ff2" />
                  <stop offset="1" stopColor="#a99ff2" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              {/* soft echo underneath, drawn slightly later */}
              <path d={LINE} pathLength={1} className="pf-draw" stroke="url(#pf-line)" strokeWidth="7" strokeOpacity="0.18" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: "0.55s" }} />
              <path d={LINE} pathLength={1} className="pf-draw" stroke="url(#pf-line)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: "0.4s" }} />
              {/* a bright bead that keeps running along the finished line */}
              <circle r="5" fill="#ffffff" stroke="#c08be8" strokeWidth="2" className="pf-travel" style={{ offsetPath: `path("${LINE}")` }} />
            </svg>

            {/* Dark mark (same as the dashboard): rises in, soft ripples, then a heartbeat */}
            <div className="relative">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  aria-hidden
                  className="pf-ripple pointer-events-none absolute left-1/2 top-1/2 size-[124px] rounded-full border border-lavender-400"
                  style={{ animationDelay: `${1.2 + i * 0.9}s` }}
                />
              ))}
              <motion.div
                className="relative rounded-full bg-white p-2.5 shadow-[0_20px_44px_-18px_rgb(90_79_192/0.55)]"
                initial={{ opacity: 0, y: 18, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, delay: 0.2, ease: EASE }}
              >
                <motion.div
                  className="rounded-full"
                  animate={{ scale: [1, 1.07, 1, 1.04, 1] }}
                  transition={{ duration: 1.2, delay: 1.6, repeat: 1, repeatDelay: 0.5, times: [0, 0.18, 0.36, 0.52, 1], ease: "easeInOut" }}
                >
                  <PulseFlowMark size={104} />
                </motion.div>
              </motion.div>
            </div>

            {/* Wordmark */}
            <h1 className="mt-9 flex text-5xl font-light tracking-tight md:text-7xl" aria-label="Pulse Flow">
              {"Pulse Flow".split("").map((ch, i) => (
                <motion.span
                  key={i}
                  aria-hidden
                  className={`inline-block ${i >= 6 ? "bg-gradient-to-br from-blush-300 to-lavender-700 bg-clip-text pb-1 text-transparent" : "text-ink"}`}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 1.1 + i * 0.05, ease: EASE }}
                >
                  {ch === " " ? " " : ch}
                </motion.span>
              ))}
            </h1>

            {/* Accent underline that sweeps in under the wordmark */}
            <motion.span
              aria-hidden
              className="mt-2 h-[3px] w-24 origin-left rounded-full bg-gradient-to-r from-blush-300 to-lavender-400"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 1.8, ease: EASE }}
            />

            <motion.p
              className="mt-4 text-sm tracking-[0.25em] text-slate-500"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 2.1, ease: EASE }}
            >
              SPEAK IT · APPROVE IT · IT FLOWS
            </motion.p>
          </motion.div>
        </>
      )}

      {/* Progress hairline */}
      <div className="absolute bottom-12 left-1/2 h-[2px] w-44 -translate-x-1/2 overflow-hidden rounded-full bg-lavender-200/70">
        <div className="pf-progress h-full rounded-full bg-gradient-to-r from-blush-300 to-lavender-400" style={{ animationDuration: `${(reduce ? 1500 : DURATION_MS) - EXIT_MS}ms` }} />
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          finish();
        }}
        className="absolute bottom-6 right-6 z-20 rounded-full px-3 py-1.5 text-xs text-slate-400 transition hover:text-ink"
      >
        Skip
      </button>
    </motion.div>
  );
}
