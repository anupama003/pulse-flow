import { AccessDenied } from "@/components/AppShell";
import { LabBoard } from "@/components/opd/Fulfillment";
import { labBoard } from "@/lib/fulfillment";
import { staffPage } from "@/lib/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diagnostics" };

export default async function LabPage() {
  const page = await staffPage("lab:read", "Diagnostics processing", () => labBoard());
  if (!page.ok) return <AccessDenied shell={page.shell} message={page.message} />;
  return <LabBoard shell={page.shell} orders={page.data} />;
}
