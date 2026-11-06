import "server-only";
import { z } from "zod";
import { buildEmergencyWalkIn, postToRoom } from "@/server/services/Switch";
import { sendAppointmentToken } from "@/server/services/WhatsApp";
import { UserError } from "../result";
import { istDay } from "../time";
import { createAppointment, type BookingConfirmation } from "./booking";
import { detectRedFlags } from "./red-flags";

// Front-desk walk-in registration, shared by the front-desk screen and the Switch OPD-desk agent.
// The red-flag screen always re-runs on the patient's own words: neither a form nor an agent can
// downgrade an emergency.

export const WalkInSchema = z.object({
  name: z.string().trim().min(2).max(80),
  age: z.coerce.number().int().min(0).max(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().regex(/^[6-9]\d{9}$/).nullable(),
  departmentId: z.string(),
  symptomsRaw: z.string().max(2000),
  symptomSummary: z.string().max(200),
  urgency: z.enum(["ROUTINE", "SOON", "EMERGENCY"]),
  redFlags: z.array(z.string()),
  whatsappConsent: z.boolean(),
});
export type WalkInForm = z.infer<typeof WalkInSchema>;

export interface WalkInResult extends BookingConfirmation {
  urgency: "ROUTINE" | "SOON" | "EMERGENCY";
  redFlags: string[];
  whatsapp: string | null;
  escalated: boolean;
}

export async function registerWalkIn(form: unknown): Promise<WalkInResult> {
  const parsed = WalkInSchema.safeParse(form);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the form.");
  const w = parsed.data;
  const redFlags = [...new Set([...w.redFlags, ...detectRedFlags(w.symptomsRaw)])];
  const urgency = redFlags.length ? "EMERGENCY" : w.urgency;
  const conf = await createAppointment({
    patient: { name: w.name, age: w.age, gender: w.gender, phone: w.phone, whatsappConsent: w.whatsappConsent },
    departmentId: w.departmentId, date: istDay(), channel: "WALK_IN", status: "WAITING",
    symptomsRaw: w.symptomsRaw, symptomSummary: w.symptomSummary, urgency, redFlags,
  });
  const wa = await sendAppointmentToken(conf.appointmentId);
  const escalated = urgency === "EMERGENCY";
  if (escalated) {
    await postToRoom(buildEmergencyWalkIn({ token: conf.tokenLabel, patientName: conf.patientName, age: w.age, department: conf.department, redFlags, patientId: conf.patientId }));
  }
  return { ...conf, urgency, redFlags, whatsapp: wa?.status ?? null, escalated };
}
