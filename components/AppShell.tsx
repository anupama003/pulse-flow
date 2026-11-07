"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BedDouble, Building2, CalendarPlus, ConciergeBell, FlaskConical, HelpCircle, LogOut, MonitorPlay, Pill, ShieldCheck, Stethoscope } from "lucide-react";
import { switchUser } from "@/app/actions/session";
import { can, homeFor, MODULES, type Role } from "@/lib/rbac";
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
  // Every module is one click away. One this role can't open goes through a colleague who can
  // (the pharmacist for Pharmacy), so a demo never needs a typed URL or the persona menu.
  const colleagues = shell.users.filter((u) => u.facilityName === me.facilityName);
  const entries = MODULES.flatMap((m): { href: string; label: string; via: PersonaUser | null }[] => {
    if (can(me.role, m.perm)) return [{ href: m.href, label: m.label, via: null }];
    // Prefer the colleague whose own home is this module (the pharmacist for Pharmacy), not the admin.
    const via =
      colleagues.find((u) => u.role !== "ADMIN" && homeFor(u.role) === m.href) ??
      colleagues.find((u) => homeFor(u.role) === m.href) ??
      colleagues.find((u) => can(u.role, m.perm));
    return via ? [{ href: m.href, label: m.label, via }] : [];
  });
  const openAs = (href: string, userId: string) =>
    startSwitch(async () => {
      const res = await switchUser(userId);
      if (res.ok) {
        router.push(href);
        router.refresh();
      }
    });

  const handleSwitch = (id: string) =>
    startSwitch(async () => {
      const res = await switchUser(id);
      if (res.ok) {
        router.push(res.data.home);
        router.refresh();
      }
    });

  return (
    <div className="min-h-dvh p-3 md:h-dvh md:p-5">
      <div className="mx-auto flex max-w-[1560px] gap-3 rounded-[2.75rem] bg-white p-3 shadow-float md:h-full md:gap-4 md:p-4">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside data-tour="sidebar" className="hidden w-[220px] shrink-0 flex-col gap-3 md:flex">
          <Link href="/" className="flex items-center gap-3 rounded-full px-2 py-1 transition hover:opacity-80" aria-label="Pulse Flow home">
            <PulseFlowMark size={52} />
            <span className="text-lg font-semibold">Pulse <span className="text-lavender-400">Flow</span></span>
          </Link>
          <nav className="flex min-h-0 w-full flex-1 flex-col gap-0.5 overflow-y-auto rounded-[2rem] bg-gradient-to-b from-lavender-50 to-blush-50 p-3">
            {entries.map(({ href, label, via }) => {
              const Icon = ICON[href];
              const active = !via && (href === "/" ? path === "/" : path.startsWith(href));
              const badge = !via ? badges[href] : undefined;
              const row = `relative flex w-full items-center gap-3 rounded-full px-3 py-2 text-left text-sm transition ${
                active ? "bg-white font-medium text-ink shadow-widget" : "text-slate-600 hover:bg-white/70 hover:text-ink"
              }`;
              const content = (
                <>
                  <Icon className={`size-5 shrink-0 ${active ? "text-blush-700" : "text-lavender-700"}`} />
                  <span className="min-w-0 flex-1 truncate">
                    {label}
                    {via && <span className="block truncate text-[11px] text-slate-400">as {via.name}</span>}
                  </span>
                  {!!badge && <span className="grid size-5 place-items-center rounded-full bg-butter-100 text-[10px] font-bold text-butter-700">{badge}</span>}
                </>
              );
              return via ? (
                <button key={href} onClick={() => openAs(href, via.id)} disabled={switching} className={row} title={`Open ${label} as ${via.name}`}>
                  {content}
                </button>
              ) : (
                <Link key={href} href={href} aria-current={active ? "page" : undefined} target={href === "/queue" ? "_blank" : undefined} className={row}>
                  {content}
                </Link>
              );
            })}
            <span className="mx-3 my-2 h-px shrink-0 bg-lavender-100" />
            <a href="/book" target="_blank" className="flex items-center gap-3 rounded-full px-3 py-2 text-sm text-slate-600 hover:bg-white/70 hover:text-ink">
              <CalendarPlus className="size-5 shrink-0 text-lavender-700" />
              Patient booking
            </a>
            {onHelp && (
              <button onClick={onHelp} className="flex items-center gap-3 rounded-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-white/70 hover:text-ink">
                <HelpCircle className="size-5 shrink-0 text-lavender-700" />
                Guided tour
              </button>
            )}
            <div className="mt-auto flex items-center gap-3 rounded-full bg-white/70 p-2">
              <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blush-200 to-lavender-200 text-sm font-semibold text-ink">
                {initials(me.name)}
                <span className={`absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-white ${ROLE_META[me.role].tint}`}>
                  <RoleIcon className="size-3" />
                </span>
              </span>
              <span className="min-w-0 flex-1 text-xs text-slate-500">
                <span className="block truncate font-medium text-ink">{me.name}</span>
                {ROLE_META[me.role].label}
              </span>
              <button title="Sign out" aria-label="Sign out" className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white hover:text-ink">
                <LogOut className="size-4" />
              </button>
            </div>
          </nav>
        </aside>

        {/* ── Main canvas ─────────────────────────────────────────────────── */}
        <main className="min-w-0 flex-1 rounded-[2.25rem] bg-gradient-to-b from-[#f8f8fb] to-canvas p-4 md:overflow-y-auto md:p-8">
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
            {entries.map(({ href, label, via }) => {
              const active = !via && (href === "/" ? path === "/" : path.startsWith(href));
              const cls = `shrink-0 rounded-full px-4 py-2 text-sm ${active ? "bg-ink text-white" : "bg-white text-slate-500 shadow-widget"}`;
              return via ? (
                <button key={href} onClick={() => openAs(href, via.id)} disabled={switching} className={cls}>
                  {label}
                </button>
              ) : (
                <Link key={href} href={href} className={cls}>
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
    ? "Connected to Switch: alerts go to the hospital's Telegram groups, and the agents there act for the person who asks."
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
