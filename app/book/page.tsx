import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import BookingFlow from "@/components/booking/BookingFlow";
import { listDepartments } from "@/lib/opd/booking";
import { resolveFacility, withPublic } from "@/lib/session";
import { istDateString } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book an OPD token", description: "Describe your problem by voice and get the next OPD token." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#e7e2fb" };

/** Public patient booking: /book?f=<facility-slug> */
export default async function BookPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const facility = await resolveFacility((await searchParams).f);
  if (!facility) notFound();
  const departments = await withPublic(facility.id, "Online appointment booking", () => listDepartments());
  return (
    <BookingFlow
      facility={{ slug: facility.slug, name: facility.name, city: facility.city, phone: facility.phone }}
      departments={departments}
      today={istDateString()}
      tomorrow={istDateString(1)}
    />
  );
}
