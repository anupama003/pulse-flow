import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Signed, expiring links for documents sent to patients (e.g. the Rx PDF in WhatsApp).
// The patient has no login, so possession of an unguessable, time-limited link is the access control.

const secret = () => {
  const s = process.env.LINK_SIGNING_SECRET;
  if (!s && process.env.NODE_ENV === "production") throw new Error("LINK_SIGNING_SECRET must be set in production.");
  return s || "dev-only-insecure-secret";
};

const sig = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function signDocLink(kind: "rx", id: string, ttlDays = 7): string {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 86_400;
  const payload = `${kind}.${id}.${exp}`;
  const base = process.env.PUBLIC_BASE_URL || "http://localhost:3000";
  return `${base}/api/${kind}/${id}/pdf?exp=${exp}&sig=${sig(payload)}`;
}

export function verifyDocLink(kind: "rx", id: string, exp: string | null, signature: string | null): boolean {
  if (!exp || !signature || Number(exp) * 1000 < Date.now()) return false;
  const expected = Buffer.from(sig(`${kind}.${id}.${exp}`));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
