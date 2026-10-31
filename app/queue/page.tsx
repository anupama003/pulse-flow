import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QueueBoard from "@/components/opd/QueueBoard";
import { queueBoard } from "@/lib/opd/booking";
import { base } from "@/lib/db";
import { resolveFacility, sessionUser, withPublic } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "OPD queue" };

/** Waiting-room TV: /queue?f=<facility-slug>. Defaults to the signed-in staff member's facility. */
export default async function QueuePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  let facility = f ? await resolveFacility(f) : null;
  if (!facility) {
    const me = await sessionUser().catch(() => null);
    facility = me ? await base.facility.findUnique({ where: { id: me.facilityId } }) : await resolveFacility(null);
  }
  if (!facility) notFound();
  const fac = facility;
  const rooms = await withPublic(fac.id, "Waiting-room queue display", () => queueBoard({ maskNames: true }));
  return <QueueBoard initial={{ facility: { name: fac.name, slug: fac.slug }, rooms, at: new Date().toISOString() }} />;
}
