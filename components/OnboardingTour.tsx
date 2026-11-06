"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { TOUR_DONE_EVENT } from "./brand/splash-key";

export const TOUR_KEY = "pulse-flow:tour-v1-done";

interface Step {
  target: string; // matches data-tour="…"
  title: string;
  body: string;
  tint: string; // pastel chip colour for the step badge
}

const STEPS: Step[] = [
  {
    target: "persona",
    title: "Who’s holding the device?",
    body: "You’re Dr. Rahul, the night PG. Switch here to walk the full 24 hours: Night PG at 3 AM, Day PG at 8 AM, Consultant at 10 AM rounds.",
    tint: "bg-lavender-100 text-lavender-700",
  },
  {
    target: "dictation",
    title: "Speak your handover",
    body: "Tap the box, hold your Wispr key and talk through every patient. Messy is fine: corrections, skipped sections and run-ons are all handled.",
    tint: "bg-lavender-100 text-lavender-700",
  },
  {
    target: "approvals",
    title: "Nothing goes live unchecked",
    body: "The AI writes drafts. You check them against what you said, see every correction it made, fill in anything marked Pending, then approve.",
    tint: "bg-butter-100 text-butter-700",
  },
  {
    target: "overview",
    title: "The ward at a glance",
    body: "Blush means critical, mint means stable. Tap a tile to filter the patient list.",
    tint: "bg-blush-100 text-blush-700",
  },
  {
    target: "patients",
    title: "Patients and live rounds",
    body: "Critical patients pulse in blush, even before sign-off. Tap the stethoscope to open live rounds and capture the consultant’s orders at the bedside.",
    tint: "bg-mint-100 text-mint-700",
  },
  {
    target: "checklist",
    title: "Your ward checklist",
    body: "Every approved task from every handover and round, most urgent first. Tap the circle to tick it off. Your name is recorded against it.",
    tint: "bg-mint-100 text-mint-700",
  },
  {
    target: "sidebar",
    title: "Get around fast",
    body: "Jump between sections here. You can replay this tour any time from the question-mark button.",
    tint: "bg-powder-100 text-powder-700",
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 10;
const CARD_W = 360;

/** First-run guided tour: spotlight + pastel tooltip card. Remembers completion per browser. */
export default function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Steps whose target isn't on screen (e.g. hidden sidebar on mobile) are skipped.
  const steps = STEPS.filter((s) => typeof document === "undefined" || document.querySelector(`[data-tour="${s.target}"]`)?.getClientRects().length);
  const step = steps[Math.min(i, steps.length - 1)];

  const finish = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
    setI(0);
    onClose();
    setTimeout(() => window.dispatchEvent(new Event(TOUR_DONE_EVENT)), 50);
  }, [onClose]);

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    // Tall targets (sidebar, long lists): spotlight only the visible part.
    const top = Math.max(r.top, 8);
    const bottom = Math.min(r.bottom, window.innerHeight - 8);
    setRect({ top: top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: Math.max(bottom - top, 40) + PAD * 2 });
  }, [step]);

  // Bring the target into view, then measure once scrolling settles.
  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: el.getBoundingClientRect().height > window.innerHeight * 0.6 ? "start" : "center" });
    const t = setTimeout(measure, 420);
    return () => clearTimeout(t);
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, finish, measure, steps.length]);

  if (!open || !step) return null;

  // Tooltip placement: below the target if it fits, else above, else beside; clamped to the viewport.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.min(CARD_W, vw - 32);
  let top = 0;
  let left = 16;
  if (rect) {
    const below = rect.top + rect.height + 14;
    const fitsBelow = below + 230 < vh;
    const fitsAbove = rect.top - 244 > 0;
    if (fitsBelow) top = below;
    else if (fitsAbove) top = rect.top - 244;
    else {
      top = Math.min(Math.max(rect.top, 16), vh - 260);
      left = rect.left + rect.width + 14 + w < vw ? rect.left + rect.width + 14 : rect.left - w - 14;
    }
    if (fitsBelow || fitsAbove) left = rect.left;
    left = Math.min(Math.max(left, 16), vw - w - 16);
  }
  const last = i >= steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* click-catcher; the spotlight's huge shadow does the dimming */}
      <div className="absolute inset-0" onClick={finish} />
      <AnimatePresence>
        {rect && (
          <motion.div
            key="spot"
            initial={false}
            animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            className="pointer-events-none absolute rounded-[2rem] ring-4 ring-white/80"
            style={{ boxShadow: "0 0 0 9999px rgb(31 29 43 / 0.5)" }}
          />
        )}
      </AnimatePresence>

      <motion.div
        key={step.target}
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        className="absolute rounded-3xl bg-white p-5 shadow-float"
        style={{ top, left, width: w }}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${step.tint}`}>
            Step {i + 1} of {steps.length}
          </span>
          <button onClick={finish} aria-label="Skip tour" className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-canvas hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{step.body}</p>

        <div className="mt-5 flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-5 bg-ink" : "w-1.5 bg-slate-200"}`} />
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} aria-label="Previous" className="grid size-10 place-items-center rounded-full bg-canvas text-slate-500 hover:text-ink">
                <ArrowLeft className="size-4" />
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setI(i + 1))}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_-10px_rgb(31_29_43/0.7)]"
            >
              {last ? "Start my shift" : "Next"}
              {last ? <Check className="size-4" /> : <ArrowRight className="size-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
