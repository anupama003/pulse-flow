"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock, FileText, FlaskConical, Loader2, Pill, ShieldAlert } from "lucide-react";
import { moveLabOrder, movePharmacyOrder } from "@/app/actions/opd";
import type { LabCard, PharmacyCard } from "@/lib/fulfillment";
import { can } from "@/lib/rbac";
import AppShell, { type Shell } from "../AppShell";
import { useAutoRefresh } from "../useAutoRefresh";

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

function Column<T extends { id: string }>({ title, chip, items, render }: { title: string; chip: string; items: T[]; render: (t: T) => React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-3 shadow-widget">
      <p className="mb-3 flex items-center justify-between px-1">
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${chip}`}>{title}</span>
        <span className="grid size-7 place-items-center rounded-full bg-canvas text-xs font-medium text-slate-500">{items.length}</span>
      </p>
      <div className="space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((t) => (
            <motion.div key={t.id} layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
              {render(t)}
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Empty</p>}
      </div>
    </div>
  );
}

function MoveButton({ label, onClick, busy, ghost }: { label: string; onClick: () => void; busy: boolean; ghost?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium disabled:opacity-40 ${ghost ? "text-slate-500 hover:bg-canvas" : "bg-ink text-white"}`}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : !ghost && <ArrowRight className="size-3.5" />} {label}
    </button>
  );
}

// ─── Pharmacy ─────────────────────────────────────────────────────────────────

const PH_NEXT: Record<string, { to: "PREPARING" | "READY" | "DISPENSED"; label: string } | undefined> = {
  QUEUED: { to: "PREPARING", label: "Start preparing" },
  PREPARING: { to: "READY", label: "Mark ready" },
  READY: { to: "DISPENSED", label: "Dispensed" },
};

export function PharmacyBoard({ shell, orders }: { shell: Shell; orders: PharmacyCard[] }) {
  useAutoRefresh(8_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const canUpdate = can(shell.me.role, "pharmacy:update");
  const move = (id: string, to: "PREPARING" | "READY" | "DISPENSED") =>
    start(async () => {
      setBusy(id);
      setError(null);
      const res = await movePharmacyOrder(id, to);
      if (!res.ok) setError(res.error);
      setBusy(null);
    });

  const card = (o: PharmacyCard) => (
    <article className="rounded-2xl bg-canvas p-4">
      <div className="flex items-center gap-2">
        {o.token && <span className="rounded-full bg-ink px-2.5 py-0.5 font-mono text-xs text-white">{o.token}</span>}
        <span className="truncate font-semibold">{o.patient.name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-slate-400"><Clock className="size-3" />{ago(o.createdAt)}</span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{o.patient.age}{o.patient.gender[0]} · {o.consultant} · HPR {o.hprId}</p>
      {o.patient.allergies.length > 0 && <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-blush-100 px-2.5 py-0.5 text-[11px] font-medium text-blush-700"><ShieldAlert className="size-3" /> Allergy: {o.patient.allergies.join(", ")}</p>}
      <ul className="mt-3 space-y-1.5">
        {o.items.map((i, k) => (
          <li key={k} className="rounded-xl bg-white px-3 py-2 text-sm">
            <span className="font-semibold">{[i.form, i.drug, i.strength].filter(Boolean).join(" ")}</span>
            <span className="block text-xs text-slate-500">{[i.dose, i.frequency, i.duration && `x ${i.duration}`, i.instructions].filter(Boolean).join(" · ")}{i.quantity ? ` · Qty ${i.quantity}` : ""}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <a href={`/api/rx/${o.rxId}/pdf`} target="_blank" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-ink"><FileText className="size-3.5" /> Rx PDF</a>
        {canUpdate && PH_NEXT[o.status] && <span className="ml-auto"><MoveButton label={PH_NEXT[o.status]!.label} busy={busy === o.id} onClick={() => move(o.id, PH_NEXT[o.status]!.to)} /></span>}
      </div>
    </article>
  );

  const col = (s: string) => orders.filter((o) => o.status === s);
  return (
    <AppShell shell={shell} badges={{ "/pharmacy": col("QUEUED").length }} toolbar={<h1 className="flex items-center gap-3 px-2 text-3xl font-light tracking-tight md:text-4xl"><Pill className="size-7 text-blush-300" /> Pharmacy</h1>}>
      <p className="mb-4 text-sm text-slate-400">Signed prescriptions arrive here automatically. Auto-refreshes every few seconds.</p>
      {error && <p className="mb-4 rounded-2xl bg-blush-50 px-4 py-2 text-sm text-blush-700">{error}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Column title="Queued" chip="bg-butter-100 text-butter-700" items={col("QUEUED")} render={card} />
        <Column title="Preparing" chip="bg-lavender-100 text-lavender-700" items={col("PREPARING")} render={card} />
        <Column title="Ready for pickup" chip="bg-powder-100 text-powder-700" items={col("READY")} render={card} />
        <Column title="Dispensed today" chip="bg-mint-100 text-mint-700" items={col("DISPENSED")} render={card} />
      </div>
    </AppShell>
  );
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

const LAB_NEXT: Record<string, { to: "SAMPLE_COLLECTED" | "PROCESSING" | "REPORTED"; label: string } | undefined> = {
  ORDERED: { to: "SAMPLE_COLLECTED", label: "Sample collected" },
  SAMPLE_COLLECTED: { to: "PROCESSING", label: "Processing" },
  PROCESSING: { to: "REPORTED", label: "Report ready" },
};

export function LabBoard({ shell, orders }: { shell: Shell; orders: LabCard[] }) {
  useAutoRefresh(8_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const canUpdate = can(shell.me.role, "lab:update");
  const move = (id: string, to: "SAMPLE_COLLECTED" | "PROCESSING" | "REPORTED") =>
    start(async () => {
      setBusy(id);
      setError(null);
      const res = await moveLabOrder(id, to);
      if (!res.ok) setError(res.error);
      setBusy(null);
    });

  const card = (o: LabCard) => (
    <article className={`rounded-2xl p-4 ${o.urgency === "URGENT" ? "bg-blush-50 ring-2 ring-blush-200" : "bg-canvas"}`}>
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4 shrink-0 text-powder-700" />
        <span className="truncate font-semibold">{o.test}</span>
        {o.urgency === "URGENT" && <span className="rounded-full bg-blush-100 px-2 py-0.5 text-[10px] font-bold text-blush-700">URGENT</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-slate-400"><Clock className="size-3" />{ago(o.createdAt)}</span>
      </div>
      <p className="mt-1 text-sm">{o.token && <span className="mr-1.5 rounded-full bg-ink px-2 py-0.5 font-mono text-[11px] text-white">{o.token}</span>}{o.patient.name} <span className="text-xs text-slate-400">· {o.patient.age}{o.patient.gender[0]}</span></p>
      <p className="text-xs text-slate-400">Ordered by {o.orderedBy ?? "-"}{o.notes ? ` · ${o.notes}` : ""}</p>
      {canUpdate && LAB_NEXT[o.status] && <div className="mt-3 flex justify-end"><MoveButton label={LAB_NEXT[o.status]!.label} busy={busy === o.id} onClick={() => move(o.id, LAB_NEXT[o.status]!.to)} /></div>}
    </article>
  );

  const col = (s: string) => orders.filter((o) => o.status === s);
  return (
    <AppShell shell={shell} badges={{ "/lab": col("ORDERED").length }} toolbar={<h1 className="flex items-center gap-3 px-2 text-3xl font-light tracking-tight md:text-4xl"><FlaskConical className="size-7 text-powder-700" /> Diagnostics</h1>}>
      <p className="mb-4 text-sm text-slate-400">Tests from signed prescriptions. Urgent tests are listed first.</p>
      {error && <p className="mb-4 rounded-2xl bg-blush-50 px-4 py-2 text-sm text-blush-700">{error}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Column title="Ordered" chip="bg-butter-100 text-butter-700" items={col("ORDERED")} render={card} />
        <Column title="Sample collected" chip="bg-lavender-100 text-lavender-700" items={col("SAMPLE_COLLECTED")} render={card} />
        <Column title="Processing" chip="bg-powder-100 text-powder-700" items={col("PROCESSING")} render={card} />
        <Column title="Reported today" chip="bg-mint-100 text-mint-700" items={col("REPORTED")} render={card} />
      </div>
    </AppShell>
  );
}
