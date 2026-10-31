import { AccessDenied } from "@/components/AppShell";
import OpdConsole from "@/components/opd/OpdConsole";
import { opdConsole } from "@/lib/opd/prescriptions";
import { staffPage } from "@/lib/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "OPD console" };

export default async function OpdPage() {
  const page = await staffPage("opd:consult", "OPD consultation", (u) => opdConsole(u));
  if (!page.ok) return <AccessDenied shell={page.shell} message={page.message} />;
  return <OpdConsole shell={page.shell} initial={page.data} />;
}
