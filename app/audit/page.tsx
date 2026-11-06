import Link from "next/link";
import type { AuditAction, Prisma } from "@prisma/client";
import AppShell, { AccessDenied } from "@/components/AppShell";
import { audit, base, db } from "@/lib/db";
import { staffPage } from "@/lib/page";
import { istTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit & compliance" };

const ACTION_TINT: Record<AuditAction, string> = {
  READ: "bg-powder-100 text-powder-700",
  CREATE: "bg-mint-100 text-mint-700",
  UPDATE: "bg-lavender-100 text-lavender-700",
  DELETE: "bg-blush-100 text-blush-700",
  EXPORT: "bg-butter-100 text-butter-700",
  SEND: "bg-mint-50 text-mint-700",
  SIGN: "bg-ink text-white",
  LOGIN: "bg-canvas text-slate-500",
  DENIED: "bg-blush-100 text-blush-700",
};
const ACTIONS = Object.keys(ACTION_TINT) as AuditAction[];

type Search = { action?: string; patient?: string; tab?: string };

/** DPDP Act 2023 audit trail + WhatsApp outbox, scoped to the admin's facility. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const page = await staffPage("audit:read", "Compliance audit review", async (u) => {
    const where: Prisma.AuditLogWhereInput = {
      facilityId: u.facilityId,
      ...(sp.action && ACTIONS.includes(sp.action as AuditAction) ? { action: sp.action as AuditAction } : {}),
      ...(sp.patient ? { patientIds: { has: sp.patient } } : {}),
    };
    const [logs, total, actors, patients, messages] = await Promise.all([
      base.auditLog.findMany({ where, orderBy: { at: "desc" }, take: 200 }),
      base.auditLog.count({ where: { facilityId: u.facilityId } }),
      base.user.findMany({ where: { facilityId: u.facilityId }, select: { id: true, name: true } }),
      db.patient.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      sp.tab === "whatsapp" ? db.messageLog.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { patient: { select: { name: true } } } }) : Promise.resolve([]),
    ]);
    await audit("READ", "AuditLog", { meta: { filters: sp } });
    return { logs, total, actors: new Map(actors.map((a) => [a.id, a.name])), patients, names: new Map(patients.map((p) => [p.id, p.name])), messages };
  });
  if (!page.ok) return <AccessDenied shell={page.shell} message={page.message} />;
  const { logs, total, actors, patients, names, messages } = page.data;
  const q = (o: Search) => `/audit?${new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <AppShell shell={page.shell} toolbar={<h1 className="px-2 text-3xl font-light tracking-tight md:text-4xl">Audit & compliance</h1>}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={q({ tab: "" })} className={`rounded-full px-4 py-2 text-sm ${sp.tab !== "whatsapp" ? "bg-ink text-white" : "bg-white text-slate-500 shadow-widget"}`}>Access log</Link>
        <Link href={q({ tab: "whatsapp" })} className={`rounded-full px-4 py-2 text-sm ${sp.tab === "whatsapp" ? "bg-ink text-white" : "bg-white text-slate-500 shadow-widget"}`}>WhatsApp outbox</Link>
        <span className="ml-auto text-sm text-slate-400">{total.toLocaleString("en-IN")} events recorded for this facility</span>
      </div>

      {sp.tab === "whatsapp" ? (
        <section className="rounded-[2rem] bg-white p-6 shadow-widget">
          <h2 className="text-xl font-medium">WhatsApp outbox</h2>
          <p className="mb-4 text-sm text-slate-400">Every message built for a patient: sent, simulated (no provider configured) or skipped for lack of consent.</p>
          <ul className="space-y-2">
            {messages.map((m) => (
              <li key={m.id} className="rounded-2xl bg-canvas p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-lavender-100 px-2.5 py-0.5 text-xs font-medium text-lavender-700">{m.kind.replace(/_/g, " ").toLowerCase()}</span>
                  <span className="font-semibold">{m.patient?.name ?? "-"}</span>
                  <span className="font-mono text-xs text-slate-400">{m.to}</span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${m.status === "SENT" ? "bg-mint-100 text-mint-700" : m.status === "FAILED" ? "bg-blush-100 text-blush-700" : "bg-butter-100 text-butter-700"}`}>{m.status.replace(/_/g, " ").toLowerCase()} · {m.provider}</span>
                  <span className="text-xs text-slate-400">{istTime(m.createdAt)}</span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-slate-500">Payload</summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-white p-3 text-[11px] leading-relaxed">{JSON.stringify(m.payload, null, 2)}</pre>
                </details>
              </li>
            ))}
            {messages.length === 0 && <li className="py-10 text-center text-sm text-slate-400">No messages yet.</li>}
          </ul>
        </section>
      ) : (
        <section className="rounded-[2rem] bg-white p-6 shadow-widget">
          <form className="mb-4 flex flex-wrap gap-2" action="/audit">
            <select name="action" defaultValue={sp.action ?? ""} className="rounded-full bg-canvas px-4 py-2 text-sm">
              <option value="">All actions</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select name="patient" defaultValue={sp.patient ?? ""} className="rounded-full bg-canvas px-4 py-2 text-sm">
              <option value="">All patients</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className="rounded-full bg-ink px-5 py-2 text-sm text-white">Filter</button>
            {(sp.action || sp.patient) && <Link href="/audit" className="rounded-full px-4 py-2 text-sm text-slate-500">Clear</Link>}
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <th className="pb-2 font-medium">When (IST)</th>
                  <th className="pb-2 font-medium">Who</th>
                  <th className="pb-2 font-medium">Action</th>
                  <th className="pb-2 font-medium">Record</th>
                  <th className="pb-2 font-medium">Patients</th>
                  <th className="pb-2 font-medium">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap py-2.5 pr-3 text-slate-500">{l.at.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })} {istTime(l.at)}</td>
                    <td className="py-2.5 pr-3"><span className="font-medium">{l.actorId ? actors.get(l.actorId) ?? l.actorId : "Public"}</span><span className="block text-xs text-slate-400">{l.actorRole}</span></td>
                    <td className="py-2.5 pr-3"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ACTION_TINT[l.action]}`}>{l.action}</span></td>
                    <td className="py-2.5 pr-3">{l.entity}<span className="block font-mono text-[11px] text-slate-400">{l.entityId?.slice(-10) ?? ""}</span></td>
                    <td className="py-2.5 pr-3 text-xs">{l.patientIds.slice(0, 3).map((id) => names.get(id) ?? id.slice(-6)).join(", ")}{l.patientIds.length > 3 ? ` +${l.patientIds.length - 3}` : ""}</td>
                    <td className="py-2.5 text-xs text-slate-500">{l.purpose ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No matching events.</p>}
          </div>
        </section>
      )}
    </AppShell>
  );
}
