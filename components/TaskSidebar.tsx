"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { TaskView } from "@/lib/types";
import TaskRow from "./TaskRow";

const RANK = { STAT: 0, HIGH: 1, ROUTINE: 2 };

/** Ward checklist in the "Homework" widget style. Sticky on wide screens. */
export default function TaskSidebar({ tasks, criticalIds, onToggle }: { tasks: TaskView[]; criticalIds: Set<string>; onToggle: (t: TaskView) => void }) {
  const [view, setView] = useState<"pending" | "all">("all");
  const done = tasks.filter((t) => t.isCompleted).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const sorted = tasks
    .filter((t) => view === "all" || !t.isCompleted)
    .sort(
      (a, b) =>
        Number(a.isCompleted) - Number(b.isCompleted) ||
        Number(criticalIds.has(b.patientId)) - Number(criticalIds.has(a.patientId)) ||
        RANK[a.priority] - RANK[b.priority] ||
        a.bedNumber.localeCompare(b.bedNumber, undefined, { numeric: true }),
    );

  return (
    <aside className="flex max-h-[calc(100dvh-3rem)] flex-col rounded-[2rem] bg-white p-6 shadow-widget xl:sticky xl:top-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-medium text-ink">Ward checklist</h3>
          <p className="text-sm text-slate-400">Check and complete tasks</p>
        </div>
        <button
          onClick={() => setView((v) => (v === "all" ? "pending" : "all"))}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-500 transition hover:border-ink/30 hover:text-ink"
        >
          {view === "all" ? "All" : "Pending"} <ChevronDown className="size-4" />
        </button>
      </header>

      {/* Progress (homework bar) */}
      <div className="mt-5 flex items-center gap-4">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-gradient-to-r from-mint-200 via-mint-400 to-powder-200 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-2xl font-light tabular-nums text-ink">{pct}%</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">
        {done} of {tasks.length} done · {tasks.length - done} pending
      </p>

      <ul className="-mx-1 mt-3 flex-1 overflow-y-auto px-1">
        <AnimatePresence initial={false}>
          {sorted.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={onToggle} />
          ))}
        </AnimatePresence>
        {sorted.length === 0 && <li className="py-10 text-center text-sm text-slate-400">Nothing pending. Go home. 🌙</li>}
      </ul>
    </aside>
  );
}
