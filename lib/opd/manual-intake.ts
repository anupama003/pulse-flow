import type { Intake } from "./intake";
import { detectRedFlags } from "./red-flags";

/** Fallback when the AI is unavailable: keep the words, run the deterministic red-flag screen, let a human pick the rest. */
export function manualIntake(text: string, departmentCode = "GENMED"): Intake {
  const redFlags = detectRedFlags(text);
  return {
    patientName: null, ageYears: null, ageText: null, gender: null, phone: null, bookingForSomeoneElse: false,
    symptomSummary: text.trim().slice(0, 200), durationText: null, departmentCode,
    departmentReason: "AI is unavailable. Please choose the department that fits best.",
    preferredDate: null, preferredSlot: null, urgency: redFlags.length ? "EMERGENCY" : "ROUTINE", redFlags,
  };
}
