"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BedDouble, Building2, CalendarPlus, ConciergeBell, FlaskConical, HelpCircle, LogOut, MonitorPlay, Pill, ShieldCheck, Stethoscope } from "lucide-react";
import { switchUser } from "@/app/actions/session";
import { can, MODULES, type Role } from "@/lib/rbac";
import { PulseFlowFooter, PulseFlowLogo, PulseFlowMark } from "./brand/PulseFlowLogo";
import PersonaMenu, { initials, ROLE_META, type PersonaUser } from "./PersonaMenu";

const ICON: Record<string, typeof BedDouble> = {
  "/": BedDouble,
  "/opd": Stethoscope,
  "/front-desk": ConciergeBell,
  "/pharmacy": Pill,
  "/lab": FlaskConical,
  "/queue": MonitorPlay,
  "/audit": ShieldCheck,
};

export interface Shell {
  me: { id: string; name: string; role: Role; facilityName: string; facilityType: "HOSPITAL" | "CLINIC"; hprId: string | null };
  users: PersonaUser[];
  /** Whether Pulse Flow is connected to Switch rooms. Off: alerts and follow-ups stay inside this app. */
  switchOn: boolean;
}

/** Staff chrome shared by every module: ink pill sidebar (filtered by RBAC), facility chip, persona switch. */
export default function AppShell({
  shell,
  toolbar,
  onHelp,
  badges = {},
  children,
}: {
  shell: Shell;
  toolbar?: React.ReactNode;
  onHelp?: () => void;
  badges?: Partial<Record<string, number>>;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const me = shell.me;
  const RoleIcon = ROLE_META[me.role].icon;
  const modules = MODULES.filter((m) => can(me.role, m.perm));

  const handleSwitch = (id: string) =>
    startSwitch(async () => {
      const res = await switchUser(id);
      if (res.ok) {
        router.push(res.data.home);
        router.refresh();
      }
    });

  return (
    <div className="min-h-dvh p-3 md:p-6">
      <div className="mx-auto flex max-w-[1560px] gap-3 rounded-[2.75rem] bg-white p-3 shadow-float md:gap-4 md:p-4">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside data-tour="sidebar" className="sticky top-6 hidden h-[calc(100dvh-5rem)] w-[76px] shrink-0 flex-col items-center gap-3 md:flex">
          <Link href="/" className="grid size-[68px] place-items-center rounded-full shadow-widget transition hover:scale-105" aria-label="Pulse Flow home" title="Pulse Flow">
            <PulseFlowMark size={68} />
          </Link>
          <nav className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto rounded-full bg-ink py-6">
            {modules.map(({ href, label }) => {
              const Icon = ICON[href];
              const active = href === "/" ? path === "/" : path.startsWith(href);
              const badge = badges[href];
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  target={href === "/queue" ? "_blank" : undefined}
                  className={`relative grid size-12 shrink-0 place-items-center rounded-full transition ${
                    active ? "bg-blush-200 text-ink shadow-[0_0_0_6px_rgb(255_255_255/0.08)]" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="size-5" />
                  {!!badge && (
                    <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-butter-100 text-[10px] font-bold text-butter-700 ring-2 ring-ink">{badge}</span>
                  )}
                </Link>
              );
            })}
            <span className="my-2 h-px w-8 shrink-0 bg-white/10" />
            <a href="/book" target="_blank" title="Patient booking page" aria-label="Patient booking page" className="grid size-12 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
              <CalendarPlus className="size-5" />
            </a>
            {onHelp && (
              <button onClick={onHelp} title="Replay tour" aria-label="Replay tour" className="grid size-12 shrink-0 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                <HelpCircle className="size-5" />
              </button>
            )}
            <div className="mt-auto flex flex-col items-center gap-3 pt-3">
              <span title={`${me.name} · ${ROLE_META[me.role].label}`} className="relative grid size-11 place-items-center rounded-full bg-gradient-to-br from-blush-200 to-lavender-200 text-sm font-semibold text-ink ring-2 ring-white/20">
                {initials(me.name)}
                <span className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-ink ${ROLE_META[me.role].tint}`}>
                  <RoleIcon className="size-3" />
                </span>
              </span>
              <button title="Sign out" aria-label="Sign out" className="grid size-12 place-items-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
                <LogOut className="size-5" />
              </button>
            </div>
          </nav>
        </aside>

        {/* ── Main canvas ─────────────────────────────────────────────────── */}
        <main className="min-w-0 flex-1 rounded-[2.25rem] bg-gradient-to-b from-[#f8f8fb] to-canvas p-4 md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PulseFlowLogo size={36} className="mr-2 md:hidden" />
              {toolbar}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-widget xl:flex">
                <PulseFlowLogo size={30} />
              </span>
              <span className="hidden items-center gap-2 rounded-full bg-white py-2 pl-3 pr-4 text-sm shadow-widget lg:flex" title="Data is isolated per facility">
                <Building2 className="size-4 text-lavender-400" />
                <span className="font-medium">{me.facilityName}</span>
                <span className="rounded-full bg-lavender-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-lavender-700">{me.facilityType === "CLINIC" ? "Clinic" : "Hospital"}</span>
              </span>
              <SwitchBadge on={shell.switchOn} />
              <PersonaMenu users={shell.users} current={me} onSwitch={handleSwitch} busy={switching} />
            </div>
          </header>
          {/* Mobile module nav */}
          <nav className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
            {modules.map(({ href, label }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link key={href} href={href} className={`shrink-0 rounded-full px-4 py-2 text-sm ${active ? "bg-ink text-white" : "bg-white text-slate-500 shadow-widget"}`}>
                  {label}
                </Link>
              );
            })}
          </nav>
          {children}
          <PulseFlowFooter className="mt-8" />
        </main>
      </div>
    </div>
  );
}

/** Shown when a persona opens a module their role can't access. */
/** Header badge: is the hospital's Telegram groups connected through Switch, or is this the app on its own? */
function SwitchBadge({ on }: { on: boolean }) {
  const title = on
    ? "Connected to Switch: alerts go to the hospital's Telegram groups, and the ward coordinator agent follows up on late work."
    : "Switch is off: alerts and late tasks stay on these screens. Nobody is messaged and no agent follows up.";
  return (
    <Link
      href="/audit?tab=switch"
      title={title}
      className={`hidden items-center gap-2 rounded-full py-2 pl-3 pr-4 text-sm font-medium shadow-widget sm:flex ${on ? "bg-mint-50 text-mint-700" : "bg-white text-slate-500"}`}
    >
      <span className={`size-2 rounded-full ${on ? "bg-mint-400" : "bg-slate-300"}`} />
      {on ? "Switch on" : "Switch off"}
    </Link>
  );
}

export function AccessDenied({ shell, message }: { shell: Shell; message: string }) {
  return (
    <AppShell shell={shell}>
      <div className="mx-auto mt-16 max-w-md rounded-[2rem] bg-white p-8 text-center shadow-widget">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-blush-100 text-blush-700">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="text-2xl font-medium">Not available for your role</h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <p className="mt-4 text-xs text-slate-400">This attempt was recorded in the audit log.</p>
      </div>
    </AppShell>
  );
}
