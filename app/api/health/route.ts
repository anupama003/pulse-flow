import { NextResponse } from "next/server";

// Liveness check for the host and the keep-alive ping (.github/workflows/keep-alive.yml).
// Touches no database, so pinging it writes nothing to the audit log.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
