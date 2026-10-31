import { NextResponse } from "next/server";
import { queueBoard } from "@/lib/opd/booking";
import { resolveFacility, withPublic } from "@/lib/session";

// Waiting-room TV feed. Public (the TV has no login), so names are masked: "Ramesh K."
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const f = await resolveFacility(new URL(req.url).searchParams.get("f"));
  if (!f) return NextResponse.json({ error: "Unknown facility" }, { status: 404 });
  const rooms = await withPublic(f.id, "Waiting-room queue display", () => queueBoard({ maskNames: true }));
  return NextResponse.json({ facility: { name: f.name, slug: f.slug }, rooms, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
