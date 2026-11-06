"use client";

import { motion } from "framer-motion";
import { Check, FlaskConical, Mic2, Stethoscope, Zap } from "lucide-react";
import type { TaskView } from "@/lib/types";

const PRIORITY = {
  STAT: { icon: Zap, tile: "bg-blush-100 text-blush-700", tag: "bg-blush-100 text-blush-700" },
  HIGH: { icon: FlaskConical, tile: "bg-butter-100 text-butter-700", tag: "bg-butter-100 text-butter-700" },
  ROUTINE: { icon: Mic2, tile: "bg-canvas text-slate-500", tag: "bg-canvas text-slate-500" },
};

/** Homework-widget row: icon tile, bold task, soft-grey meta, round checkbox. */
export default function TaskRow({ task, onToggle, showBed = true }: { task: TaskView; onToggle: (t: TaskView) => void; showBed?: boolean }) {
  const done = task.isCompleted;
  const p = PRIORITY[task.priority];
  const Icon = task.source === "ROUNDS" && task.priority === "ROUTINE" ? Stethoscope : p.icon;

  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="border-b border-slate-100 last:border-0">
      <label className="group flex cursor-pointer items-center gap-3 rounded-2xl px-1 py-3 transition">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${done ? "bg-canvas text-slate-300" : p.tile}`}>
          <Icon className="size-[18px]" />
        </span>

        <span className="min-w-0 flex-1">
          <span className={`relative inline-block max-w-full text-[15px] font-semibold leading-snug transition-colors ${done ? "text-slate-400" : "text-ink"}`}>
            {task.description}
            <motion.span
              aria-hidden
              initial={false}
              animate={{ scaleX: done ? 1 : 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute left-0 top-1/2 h-[1.5px] w-full origin-left rounded bg-slate-400"
            />
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
            {showBed && (
              <span>
                Bed {task.bedNumber} · {task.patientName}
              </span>
            )}
            {task.dueText && <span>⏱ {task.dueText}</span>}
            <span>{task.source === "ROUNDS" ? "From rounds" : "From handover"}</span>
            {done && task.completedByName && <span className="text-mint-700">✓ {task.completedByName}</span>}
          </span>
        </span>

        {task.priority !== "ROUTINE" && !done && (
          <span className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline ${p.tag}`}>{task.priority}</span>
        )}

        <input type="checkbox" checked={done} onChange={() => onToggle(task)} aria-label={`${task.description}, bed ${task.bedNumber}`} className="peer sr-only" />
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition peer-focus-visible:ring-4 peer-focus-visible:ring-lavender-200 ${
            done ? "border-mint-400 bg-mint-400 text-white" : "border-slate-200 bg-white group-hover:border-mint-400"
          }`}
        >
          <motion.span initial={false} animate={{ scale: done ? 1 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
            <Check className="size-4" strokeWidth={3} />
          </motion.span>
        </span>
      </label>
    </motion.li>
  );
}
