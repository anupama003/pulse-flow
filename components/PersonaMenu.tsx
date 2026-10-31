"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ConciergeBell, FlaskConical, Moon, Pill, ShieldCheck, Stethoscope, Sun } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/lib/rbac";

export const ROLE_META: Record<Role, { label: string; icon: typeof Moon; tint: string }> = {
  PG_NIGHT: { label: ROLE_LABEL.PG_NIGHT, icon: Moon, tint: "bg-lavender-100 text-lavender-700" },
  PG_DAY: { label: ROLE_LABEL.PG_DAY, icon: Sun, tint: "bg-butter-100 text-butter-700" },
  CONSULTANT: { label: ROLE_LABEL.CONSULTANT, icon: Stethoscope, tint: "bg-mint-100 text-mint-700" },
  RECEPTIONIST: { label: ROLE_LABEL.RECEPTIONIST, icon: ConciergeBell, tint: "bg-powder-100 text-powder-700" },
  PHARMACIST: { label: ROLE_LABEL.PHARMACIST, icon: Pill, tint: "bg-blush-100 text-blush-700" },
  LAB_TECH: { label: ROLE_LABEL.LAB_TECH, icon: FlaskConical, tint: "bg-lavender-100 text-lavender-700" },
  ADMIN: { label: ROLE_LABEL.ADMIN, icon: ShieldCheck, tint: "bg-canvas text-slate-600" },
};

export const initials = (name: string) =>
  name
    .replace(/^Dr\.?\s*/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export interface PersonaUser {
  id: string;
  name: string;
  role: Role;
  title: string | null;
  facilityName: string;
}

/** Demo persona switcher, grouped by facility (shows multi-tenant isolation when you hop branches). */
export default function PersonaMenu({ users, current, onSwitch, busy }: { users: PersonaUser[]; current: { id: string; name: string; role: Role }; onSwitch: (id: string) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = ROLE_META[current.role];
  const groups = users.reduce<Record<string, PersonaUser[]>>((acc, u) => ((acc[u.facilityName] ??= []).push(u), acc), {});

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" data-tour="persona">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        className="flex items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-widget transition hover:ring-2 hover:ring-lavender-100 disabled:opacity-60"
      >
        <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-blush-200 to-lavender-200 text-sm font-semibold">{initials(current.name)}</span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight">{current.name}</span>
          <span className="block text-xs text-slate-400">{meta.label}</span>
        </span>
        <ChevronDown className={`size-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="absolute right-0 z-40 mt-2 max-h-[70dvh] w-[22rem] overflow-y-auto rounded-3xl bg-white p-2 shadow-float ring-1 ring-slate-100"
          >
            <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-slate-400">Who’s using this device?</p>
            {Object.entries(groups).map(([facility, list]) => (
              <div key={facility} className="mt-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold text-lavender-700">{facility}</p>
                {list.map((u) => {
                  const m = ROLE_META[u.role];
                  const Icon = m.icon;
                  const active = u.id === current.id;
                  return (
                    <button
                      key={u.id}
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => {
                        setOpen(false);
                        if (!active) onSwitch(u.id);
                      }}
                      className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${active ? "bg-canvas" : "hover:bg-canvas"}`}
                    >
                      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${m.tint}`}>
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{u.name}</span>
                        <span className="block truncate text-xs text-slate-400">{u.title ?? m.label}</span>
                      </span>
                      {active && <Check className="size-4 text-mint-700" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
