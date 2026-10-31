import { AccessDenied } from "@/components/AppShell";
import FrontDesk from "@/components/opd/FrontDesk";
import { frontDeskDay, listDepartments } from "@/lib/opd/booking";
import { staffPage } from "@/lib/page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Front desk" };

export default async function FrontDeskPage() {
  const page = await staffPage("booking:frontdesk", "Front desk registration", async () => ({ rows: await frontDeskDay(), departments: await listDepartments() }));
  if (!page.ok) return <AccessDenied shell={page.shell} message={page.message} />;
  return <FrontDesk shell={page.shell} rows={page.data.rows} departments={page.data.departments} />;
}
