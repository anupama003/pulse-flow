import { redirect } from "next/navigation";
import { AccessDenied } from "@/components/AppShell";
import Dashboard from "@/components/Dashboard";
import { staffPage } from "@/lib/page";
import { can, homeFor } from "@/lib/rbac";
import { getDashboard } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Ward · Pulse Flow" } }; // root segment: the layout title template only applies to child routes

export default async function WardPage() {
  const page = await staffPage("ward:read", "IPD ward dashboard", () => getDashboard());
  if (!page.ok) {
    // Non-clinical roles (front desk, pharmacy…) land on their own module instead.
    if (!can(page.user.role, "ward:read")) redirect(homeFor(page.user.role));
    return <AccessDenied shell={page.shell} message={page.message} />;
  }
  return <Dashboard initial={page.data} shell={page.shell} />;
}
