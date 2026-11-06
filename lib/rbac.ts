// Role-based access control. Pure module: safe to import from client components (to hide UI),
// but the server is the authority. Every server action calls `withStaff(permission, …)`.

export type Role = "PG_NIGHT" | "PG_DAY" | "CONSULTANT" | "RECEPTIONIST" | "PHARMACIST" | "LAB_TECH" | "ADMIN";

export type Permission =
  | "ward:read"
  | "ward:dictate"
  | "ward:approve"
  | "rounds:approve" // consultant sign-off on bedside orders
  | "task:complete"
  | "opd:consult" // call patients, open the OPD console
  | "rx:dictate"
  | "rx:sign" // requires an HPR ID as well
  | "booking:frontdesk" // walk-in registration, check-in
  | "queue:read"
  | "pharmacy:read"
  | "pharmacy:update"
  | "lab:read"
  | "lab:update"
  | "audit:read";

const PG: Permission[] = ["ward:read", "ward:dictate", "ward:approve", "task:complete", "queue:read", "rx:dictate", "opd:consult"];

export const MATRIX: Record<Role, Permission[]> = {
  PG_NIGHT: PG,
  PG_DAY: PG,
  CONSULTANT: [...PG, "rounds:approve", "rx:sign", "lab:read", "pharmacy:read"],
  RECEPTIONIST: ["booking:frontdesk", "queue:read"],
  PHARMACIST: ["pharmacy:read", "pharmacy:update", "queue:read"],
  LAB_TECH: ["lab:read", "lab:update", "queue:read"],
  ADMIN: ["audit:read", "queue:read", "booking:frontdesk", "pharmacy:read", "lab:read"],
};

export const can = (role: Role | string, p: Permission) => (MATRIX[role as Role] ?? []).includes(p);

export const ROLE_LABEL: Record<Role, string> = {
  PG_NIGHT: "Night PG",
  PG_DAY: "Day PG",
  CONSULTANT: "Consultant",
  RECEPTIONIST: "Front desk",
  PHARMACIST: "Pharmacist",
  LAB_TECH: "Lab technician",
  ADMIN: "Facility admin",
};

/** Modules in the sidebar, in order, with the permission that unlocks each. */
export const MODULES = [
  { href: "/", label: "Ward", perm: "ward:read" },
  { href: "/opd", label: "OPD console", perm: "opd:consult" },
  { href: "/front-desk", label: "Front desk", perm: "booking:frontdesk" },
  { href: "/pharmacy", label: "Pharmacy", perm: "pharmacy:read" },
  { href: "/lab", label: "Diagnostics", perm: "lab:read" },
  { href: "/queue", label: "Queue TV", perm: "queue:read" },
  { href: "/audit", label: "Audit log", perm: "audit:read" },
] as const satisfies readonly { href: string; label: string; perm: Permission }[];

export type ModuleHref = (typeof MODULES)[number]["href"];

/** Where a role lands after switching persona. */
export const homeFor = (role: Role | string): ModuleHref => MODULES.find((m) => can(role, m.perm))?.href ?? "/queue";
