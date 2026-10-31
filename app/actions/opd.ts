"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { advanceLab, advancePharmacy } from "@/lib/fulfillment";
import { callNext as callNextPatient, opdConsole, saveRxDraft, signRx as sign, type OpdConsoleData } from "@/lib/opd/prescriptions";
import { parsePrescription } from "@/lib/opd/rx";
import { db } from "@/lib/db";
import { attempt, UserError } from "@/lib/result";
import { withStaff } from "@/lib/session";
import type { ActionResult } from "@/lib/types";
import { sendRxDocuments } from "@/server/services/WhatsApp";

const refresh = () => ["/opd", "/queue", "/pharmacy", "/lab"].forEach((p) => revalidatePath(p));

export async function callNext(): Promise<ActionResult<OpdConsoleData>> {
  return attempt(() =>
    withStaff("opd:consult", "OPD consultation", async (u) => {
      await callNextPatient(u);
      refresh();
      return opdConsole(u);
    }),
  );
}

export async function dictateRx(appointmentId: string, text: string): Promise<ActionResult<OpdConsoleData>> {
  return attempt(() =>
    withStaff("rx:dictate", "OPD e-prescription", async (u) => {
      const t = text.trim();
      if (t.length < 5) throw new UserError("Dictate at least one medicine or test.");
      if (t.length > 6000) throw new UserError("Dictation too long.");
      const appt = await db.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true } });
      if (!appt) throw new UserError("Appointment not found.");
      // Only the patient actually in this doctor's room: never a finished visit or a colleague's patient.
      if (appt.status !== "IN_CONSULT") throw new UserError("This patient is no longer in consultation. Refresh the OPD console.");
      if (appt.consultantId && appt.consultantId !== u.id && u.departmentId) throw new UserError("This patient is with another consultant.");
      const ex = await parsePrescription(t, { ageYears: appt.patient.age, gender: appt.patient.gender, allergies: appt.patient.allergies });
      await saveRxDraft(u, appointmentId, t, ex);
      return opdConsole(u);
    }),
  );
}

const ItemSchema = z.object({
  drug: z.string().max(120),
  form: z.string().max(20).nullable(),
  strength: z.string().max(40).nullable(),
  dose: z.string().max(40).nullable(),
  frequency: z.string().max(30).nullable(),
  duration: z.string().max(40).nullable(),
  route: z.string().max(20).nullable(),
  instructions: z.string().max(200).nullable(),
});
const SignSchema = z.object({
  items: z.array(ItemSchema).max(30),
  labTests: z.array(z.object({ test: z.string().min(1).max(120), urgency: z.enum(["ROUTINE", "URGENT"]), notes: z.string().max(200).nullable() })).max(20),
  advice: z.array(z.string().max(300)).max(20),
  followUp: z.string().max(200).nullable(),
  allergyOverride: z.boolean(),
});

export async function signRx(rxId: string, input: z.infer<typeof SignSchema>): Promise<ActionResult<{ console: OpdConsoleData; sent: string[] }>> {
  return attempt(() =>
    withStaff("rx:sign", "OPD e-prescription signing", async (u) => {
      const parsed = SignSchema.safeParse(input);
      if (!parsed.success) throw new UserError("Check the prescription fields.");
      const res = await sign(u, rxId, parsed.data);
      const sent = await sendRxDocuments(res.rxId);
      refresh();
      return { console: await opdConsole(u), sent: sent.map((s) => `${s.status}`) };
    }),
  );
}

// ─── Fulfillment ──────────────────────────────────────────────────────────────

export async function movePharmacyOrder(id: string, to: "PREPARING" | "READY" | "DISPENSED" | "QUEUED" | "CANCELLED") {
  return attempt(() =>
    withStaff("pharmacy:update", "Pharmacy dispensing", async (u) => {
      await advancePharmacy(id, to, u.id);
      revalidatePath("/pharmacy");
      return null;
    }),
  );
}

export async function moveLabOrder(id: string, to: "SAMPLE_COLLECTED" | "PROCESSING" | "REPORTED" | "ORDERED" | "CANCELLED") {
  return attempt(() =>
    withStaff("lab:update", "Diagnostics processing", async (u) => {
      await advanceLab(id, to, u.id);
      revalidatePath("/lab");
      return null;
    }),
  );
}
