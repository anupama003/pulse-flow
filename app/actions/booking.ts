"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AbhaError, assertLinkable, createAbha, requestMobileOtp, verifyMobileOtp } from "@/lib/abdm/abha-sandbox";
import { audit } from "@/lib/db";
import { createAppointment, listDepartments, setAppointmentStatus, type BookingConfirmation } from "@/lib/opd/booking";
import { parseIntake, type Intake } from "@/lib/opd/intake";
import { detectRedFlags } from "@/lib/opd/red-flags";
import { rateLimit } from "@/lib/rate-limit";
import { attempt, UserError } from "@/lib/result";
import { resolveFacility, withPublic, withStaff } from "@/lib/session";
import { dayFromString, istDateString, istDay } from "@/lib/time";
import type { ActionResult } from "@/lib/types";
import { sendAppointmentToken } from "@/server/services/WhatsApp";

// ─── Public: /book ────────────────────────────────────────────────────────────

async function facilityOrThrow(slug: string) {
  const f = await resolveFacility(slug);
  if (!f) throw new UserError("Unknown hospital.");
  return f;
}

export async function analyzeSymptoms(facilitySlug: string, text: string): Promise<ActionResult<Intake>> {
  return attempt(async () => {
    if (!(await rateLimit("intake", 12, 10 * 60_000))) throw new UserError("Too many requests. Please wait a few minutes.");
    const t = text.trim();
    if (t.length < 8) throw new UserError("Tell us a little more about the problem.");
    if (t.length > 2000) throw new UserError("Please keep it under a minute of speech.");
    const f = await facilityOrThrow(facilitySlug);
    return withPublic(f.id, "Online appointment booking", async () => parseIntake(t, await listDepartments(), "patient"));
  });
}

const BookingSchema = z.object({
  facilitySlug: z.string(),
  name: z.string().trim().min(2, "Enter the patient's name").max(80),
  age: z.coerce.number().int().min(0).max(120),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number"),
  departmentId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(["MORNING", "AFTERNOON", "EVENING"]).nullable(),
  symptomsRaw: z.string().max(2000),
  symptomSummary: z.string().max(200),
  urgency: z.enum(["ROUTINE", "SOON", "EMERGENCY"]),
  redFlags: z.array(z.string()).max(20),
  careConsent: z.literal(true, { message: "Consent is needed to book" }),
  whatsappConsent: z.boolean(),
  abha: z.object({ txnId: z.string(), abhaNumber: z.string(), abhaAddress: z.string() }).nullable(),
});
export type BookingForm = z.infer<typeof BookingSchema>;

export async function bookOnline(form: BookingForm): Promise<ActionResult<BookingConfirmation & { whatsapp: string | null }>> {
  return attempt(async () => {
    if (!(await rateLimit("book", 6, 10 * 60_000))) throw new UserError("Too many bookings from this device. Please call the hospital.");
    const parsed = BookingSchema.safeParse(form);
    if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Please check the form.");
    const b = parsed.data;
    // Never trust the client's urgency: re-screen the patient's own words on the server.
    const serverFlags = detectRedFlags(b.symptomsRaw);
    if (b.urgency === "EMERGENCY" || serverFlags.length) throw new UserError("This sounds like an emergency. Please go to the nearest emergency department or call 108 now.");
    const f = await facilityOrThrow(b.facilitySlug);
    if (b.abha) await assertLinkable(b.abha.txnId, b.abha.abhaNumber);

    return withPublic(f.id, "Online appointment booking", async () => {
      const conf = await createAppointment({
        patient: { name: b.name, age: b.age, gender: b.gender, phone: b.phone, abhaNumber: b.abha?.abhaNumber, abhaAddress: b.abha?.abhaAddress, whatsappConsent: b.whatsappConsent },
        departmentId: b.departmentId, date: dayFromString(b.date), channel: "ONLINE_VOICE", status: "BOOKED",
        symptomsRaw: b.symptomsRaw, symptomSummary: b.symptomSummary, urgency: b.urgency, redFlags: b.redFlags, preferredSlot: b.slot,
      });
      const wa = await sendAppointmentToken(conf.appointmentId);
      revalidatePath("/front-desk");
      return { ...conf, whatsapp: wa?.status ?? null };
    });
  });
}

// ─── ABHA (ABDM M1, sandbox simulation) ───────────────────────────────────────

const abha = <T>(fn: () => Promise<T>) =>
  attempt(async () => {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof AbhaError) throw new UserError(e.message);
      throw e;
    }
  });

export async function abhaRequestOtp(mobile: string) {
  return abha(async () => {
    if (!(await rateLimit("abha-otp", 5, 10 * 60_000))) throw new UserError("Too many OTP requests. Try later.");
    return requestMobileOtp(mobile);
  });
}

export async function abhaVerifyOtp(txnId: string, otp: string) {
  return abha(() => verifyMobileOtp(txnId, otp));
}

export async function abhaCreate(txnId: string, profile: { name: string; gender: "MALE" | "FEMALE" | "OTHER"; yearOfBirth: number }) {
  return abha(async () => {
    const acc = await createAbha(txnId, profile);
    await audit("CREATE", "AbhaSandboxAccount", { entityId: acc.abhaNumber, meta: { sandbox: true } });
    return acc;
  });
}

// ─── Front desk ───────────────────────────────────────────────────────────────

export async function parseWalkIn(text: string): Promise<ActionResult<Intake>> {
  return attempt(() =>
    withStaff("booking:frontdesk", "Front desk registration", async () => {
      const t = text.trim();
      if (t.length < 5) throw new UserError("Dictate at least a name and the problem.");
      return parseIntake(t, await listDepartments(), "frontdesk");
    }),
  );
}

const WalkInSchema = z.object({
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

export async function registerWalkIn(form: WalkInForm): Promise<ActionResult<BookingConfirmation & { whatsapp: string | null }>> {
  return attempt(() =>
    withStaff("booking:frontdesk", "Front desk registration", async () => {
      const parsed = WalkInSchema.safeParse(form);
      if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Check the form.");
      const w = parsed.data;
      const flags = [...new Set([...w.redFlags, ...detectRedFlags(w.symptomsRaw)])];
      const conf = await createAppointment({
        patient: { name: w.name, age: w.age, gender: w.gender, phone: w.phone, whatsappConsent: w.whatsappConsent },
        departmentId: w.departmentId, date: istDay(), channel: "WALK_IN", status: "WAITING",
        symptomsRaw: w.symptomsRaw, symptomSummary: w.symptomSummary, urgency: flags.length ? "EMERGENCY" : w.urgency, redFlags: flags,
      });
      const wa = await sendAppointmentToken(conf.appointmentId);
      revalidatePath("/front-desk");
      revalidatePath("/queue");
      return { ...conf, whatsapp: wa?.status ?? null };
    }),
  );
}

export async function checkIn(appointmentId: string) {
  return attempt(() =>
    withStaff("booking:frontdesk", "Front desk check-in", async () => {
      await setAppointmentStatus(appointmentId, ["BOOKED"], "WAITING");
      revalidatePath("/front-desk");
      return null;
    }),
  );
}

export async function markNoShow(appointmentId: string) {
  return attempt(() =>
    withStaff("booking:frontdesk", "Front desk queue management", async () => {
      await setAppointmentStatus(appointmentId, ["BOOKED", "WAITING"], "NO_SHOW");
      revalidatePath("/front-desk");
      return null;
    }),
  );
}

export async function todayString() {
  return istDateString();
}
