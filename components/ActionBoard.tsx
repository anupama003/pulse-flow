"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Clock, Flame, Zap } from "lucide-react";
import type { TaskView } from "@/lib/types";
import TaskRow from "./TaskRow";

const COLUMNS = [
  { id: "STAT", title: "STAT", icon: Flame, chip: "bg-blush-100 text-blush-700" },
  { id: "HIGH", title: "High", icon: Zap, chip: "bg-butter-100 text-butter-700" },
  { id: "ROUTINE", title: "Routine", icon: Clock, chip: "bg-powder-100 text-powder-700" },
  { id: "DONE", title: "Done", icon: CheckCircle2, chip: "bg-mint-100 text-mint-700" },
] as const;

/** Kanban by priority; inside each column, tasks are grouped per patient. */
export default function ActionBoard({ tasks, onToggle }: { tasks: TaskView[]; onToggle: (t: TaskView) => void }) {
  const inColumn = (col: (typeof COLUMNS)[number]["id"]) =>
    tasks.filter((t) => (col === "DONE" ? t.isCompleted : !t.isCompleted && t.priority === col));

  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-widget">
      <div className="mb-5">
        <h2 className="text-2xl font-medium tracking-tight">Action board</h2>
        <p className="text-sm text-slate-400">Every order from handovers and rounds, by urgency.</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {COLUMNS.map(({ id, title, icon: Icon, chip }) => {
          const items = inColumn(id);
          const byBed = Object.entries(
            items.reduce<Record<string, TaskView[]>>((acc, t) => ((acc[t.bedNumber] ??= []).push(t), acc), {}),
          ).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

          return (
            <div key={id} className="rounded-3xl bg-canvas p-3">
              <p className="mb-3 flex items-center justify-between px-1">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${chip}`}>
                  <Icon className="size-4" /> {title}
                </span>
                <span className="grid size-7 place-items-center rounded-full bg-white text-xs font-medium text-slate-500">{items.length}</span>
              </p>
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {byBed.map(([bed, list]) => (
                    <motion.div
                      key={bed}
                      layout
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="rounded-2xl bg-white px-3 pt-3 shadow-[0_6px_20px_-12px_rgb(31_29_43/0.25)]"
                    >
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-ink">Bed {bed}</span> · {list[0].patientName}
                      </p>
                      <ul>
                        {list.map((t) => (
                          <TaskRow key={t.id} task={t} onToggle={onToggle} showBed={false} />
                        ))}
                      </ul>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {items.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Empty</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
