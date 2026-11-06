import { NextResponse } from "next/server";
import { audit, base } from "@/lib/db";
import { verifyDocLink } from "@/lib/links";
import { getPrescription } from "@/lib/opd/prescriptions";
import { renderRxPdf } from "@/lib/rx-pdf";
import { withPublic, withStaff } from "@/lib/session";

// Prescription PDF. Two ways in:
//   • patient: signed, expiring link from WhatsApp (?exp=…&sig=…)
//   • staff:   logged-in consultant / pharmacist (session cookie + RBAC)
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const viaLink = verifyDocLink("rx", id, url.searchParams.get("exp"), url.searchParams.get("sig"));

  const load = async () => {
    const rx = await getPrescription(id);
    if (!rx || rx.status !== "SIGNED") return null;
    await audit("EXPORT", "Prescription", { entityId: rx.id, patientIds: [rx.patientId], meta: { format: "pdf", via: viaLink ? "signed-link" : "staff" } });
    return renderRxPdf(rx);
  };

  let pdf: Uint8Array | null = null;
  try {
    if (viaLink) {
      const owner = await base.prescription.findUnique({ where: { id }, select: { facilityId: true } });
      if (owner) pdf = await withPublic(owner.facilityId, "Patient prescription download", load);
    } else {
      pdf = await withStaff("pharmacy:read", "Prescription PDF", load).catch(() => withStaff("rx:sign", "Prescription PDF", load));
    }
  } catch {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (!pdf) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Prescription-${id.slice(-6).toUpperCase()}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
