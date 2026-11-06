import "server-only";
import { headers } from "next/headers";

// Tiny fixed-window limiter for public endpoints (booking page). In-memory per server instance.
// For multi-instance deploys swap for Redis/Upstash; the call sites don't change.

const g = globalThis as unknown as { __rl?: Map<string, { n: number; reset: number }> };
const hits = (g.__rl ??= new Map());

export async function rateLimit(bucket: string, max: number, windowMs: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || cur.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  cur.n++;
  return cur.n <= max;
}
