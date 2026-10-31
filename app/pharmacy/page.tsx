import { AccessDenied } from "@/components/AppShell";
import { PharmacyBoard } from "@/components/opd/Fulfillment";
import { pharmacyBoard } from "@/lib/fulfillment";
import { staffPage } from "@/lib/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pharmacy" };

export default async function PharmacyPage() {
  const page = await staffPage("pharmacy:read", "Pharmacy dispensing", () => pharmacyBoard());
  if (!page.ok) return <AccessDenied shell={page.shell} message={page.message} />;
  return <PharmacyBoard shell={page.shell} orders={page.data} />;
}
