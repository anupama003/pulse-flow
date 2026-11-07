import type { AuditLog } from "@prisma/client";
import { istTime } from "@/lib/time";

// Audit → "Switch rooms" tab: what Pulse Flow posted into the hospital's chat rooms, and what the
// Switch agents did there, each under the staff member they acted for.

interface RoomPostMeta {
  event?: string;
  room?: string;
  status?: string;
  text?: string;
  error?: string;
}

const MAX_PATIENTS_SHOWN = 3;

const STATUS_TINT: Record<string, string> = {
  SENT: "bg-mint-100 text-mint-700",
  FAILED: "bg-blush-100 text-blush-700",
  SIMULATED: "bg-butter-100 text-butter-700",
};

interface Props {
  logs: AuditLog[];
  actors: Map<string, string>;
  names: Map<string, string>;
}

export default function SwitchActivity({ logs, actors, names }: Props) {
  const who = (l: AuditLog) => (l.actorId ? actors.get(l.actorId) ?? l.actorId : "System");
  return (
    <section className="rounded-[2rem] bg-white p-6 shadow-widget">
      <h2 className="text-xl font-medium">Switch rooms</h2>
      <p className="mb-4 text-sm text-slate-400">
        Alerts Pulse Flow posted into the ward, escalations, OPD and pharmacy/lab rooms, and every action a Switch agent took for a named staff member.
        Posts marked &ldquo;not sent&rdquo; were built while Switch was off: nobody saw them in Telegram.
      </p>
      <ul className="space-y-2">
        {logs.map((l) => {
          const shown = l.patientIds.slice(0, MAX_PATIENTS_SHOWN).map((id) => names.get(id) ?? id.slice(-6)).join(", ");
          const more = l.patientIds.length - MAX_PATIENTS_SHOWN;
          const patients = more > 0 ? `${shown} +${more}` : shown;
          if (l.entity === "Switch") {
            const m = l.meta as RoomPostMeta;
            return (
              <li key={l.id} className="rounded-2xl bg-canvas p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-lavender-100 px-2.5 py-0.5 text-xs font-medium text-lavender-700">#{m.room ?? "room"}</span>
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{(m.event ?? "").replace(/_/g, " ").toLowerCase()}</span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TINT[m.status ?? ""] ?? "bg-canvas text-slate-500"}`}>{m.status === "SIMULATED" ? "not sent (Switch off)" : (m.status ?? "").toLowerCase()}</span>
                  <span className="text-xs text-slate-400">{istTime(l.at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{m.text}</p>
                {m.error && <p className="mt-1 text-xs text-blush-700">{m.error}</p>}
              </li>
            );
          }
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2.5 text-sm">
              <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">{l.route?.replace("switch:", "") ?? "agent"}</span>
              <span>
                for <span className="font-medium">{who(l)}</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${l.action === "DENIED" ? "bg-blush-100 text-blush-700" : "bg-powder-100 text-powder-700"}`}>{l.action}</span>
              <span className="text-slate-500">{l.entity}</span>
              {patients && <span className="text-xs text-slate-400">· {patients}</span>}
              <span className="ml-auto text-xs text-slate-400">{istTime(l.at)}</span>
            </li>
          );
        })}
        {logs.length === 0 && <li className="py-10 text-center text-sm text-slate-400">No Switch activity yet. Dictate a handover with a critical patient, or connect the agents (switch/README.md).</li>}
      </ul>
    </section>
  );
}
