// Indian Standard Time helpers. OPD days are IST calendar days regardless of server timezone.

const IST_OFFSET_MS = 330 * 60 * 1000;

/** "2026-10-30" for today in IST (plus `offsetDays`). */
export function istDateString(offsetDays = 0, from = new Date()): string {
  const ist = new Date(from.getTime() + IST_OFFSET_MS + offsetDays * 86_400_000);
  return ist.toISOString().slice(0, 10);
}

/** A Date at UTC midnight for an IST calendar day: the shape Prisma uses for @db.Date. */
export const istDay = (offsetDays = 0, from = new Date()) => new Date(`${istDateString(offsetDays, from)}T00:00:00.000Z`);
export const dayFromString = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T00:00:00.000Z`);

export function formatDay(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function istTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
}
