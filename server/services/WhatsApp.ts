import "server-only";
import type { MessageKind, MessageProvider, MessageStatus, Prisma } from "@prisma/client";
import { audit, db } from "@/lib/db";
import { signDocLink } from "@/lib/links";
import { formatDay } from "@/lib/time";

// WhatsApp communication engine.
//
// 1. Builders turn a domain event into a provider-neutral TemplateMessage.
// 2. Adapters turn that into the exact request body for Meta's WhatsApp Cloud API or Twilio.
// 3. sendWhatsApp() checks DPDP consent, sends (or, with no credentials, SIMULATES), and writes
//    MessageLog + an audit SEND entry. Secrets are never stored in the payload log.
//
// Business-initiated WhatsApp messages must use templates pre-approved in Meta Business Manager
// (or Twilio Content Templates). The template text each builder expects is in TEMPLATES below.
//
// Env:
//   WHATSAPP_PROVIDER=meta|twilio          (unset → DRY_RUN: build + log, don't send)
//   META_WA_TOKEN, META_WA_PHONE_NUMBER_ID, META_GRAPH_VERSION (default v21.0)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (+14155238886),
//   TWILIO_CONTENT_SID_APPOINTMENT_TOKEN / _RX_DOCUMENT / _FOLLOW_UP
//   PUBLIC_BASE_URL, LINK_SIGNING_SECRET    (for the signed Rx PDF link)

export const TEMPLATES: Record<MessageKind, { name: string; body: string; header?: "DOCUMENT" }> = {
  APPOINTMENT_TOKEN: {
    name: "opd_token_v1",
    body: "Hello {{1}}, your OPD token at {{2}} is *{{3}}* for {{4}} on {{5}}. Doctor: {{6}}, {{7}}. Please arrive 15 minutes early and show this message at the front desk.",
  },
  RX_DOCUMENT: {
    name: "rx_document_v1",
    header: "DOCUMENT",
    body: "Hello {{1}}, your prescription from {{2}} at {{3}} dated {{4}} is attached. Follow-up: {{5}}.",
  },
  FOLLOW_UP: {
    name: "followup_care_v1",
    body: "Hello {{1}}, care instructions from {{2}}: {{3}}. Next visit: {{4}}. In an emergency call 108 or visit the nearest emergency department.",
  },
};

export interface TemplateMessage {
  kind: MessageKind;
  /** E.164 */
  to: string;
  template: string;
  language: string;
  bodyParams: string[];
  document?: { url: string; filename: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "98123 45678" / "+91-9812345678" / "09812345678" → "+919812345678" (Indian mobiles only). */
export function toE164India(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  const ten = d.length === 12 && d.startsWith("91") ? d.slice(2) : d;
  return /^[6-9]\d{9}$/.test(ten) ? `+91${ten}` : null;
}

/** Meta template params can't contain newlines/tabs or >4 consecutive spaces; cap length. */
const param = (s: string | null | undefined, fallback = "-") =>
  (s?.trim() || fallback).replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").slice(0, 900);

const firstName = (name: string) => name.trim().split(/\s+/)[0];

// ─── Builders ─────────────────────────────────────────────────────────────────

export function buildAppointmentToken(a: {
  phone: string; patientName: string; facilityName: string; token: string; department: string; date: Date | string; consultant: string | null; room: string;
}): TemplateMessage | null {
  const to = toE164India(a.phone);
  if (!to) return null;
  return {
    kind: "APPOINTMENT_TOKEN", to, template: TEMPLATES.APPOINTMENT_TOKEN.name, language: "en",
    bodyParams: [firstName(a.patientName), a.facilityName, a.token, a.department, formatDay(a.date), a.consultant ?? "Duty doctor", a.room].map((p) => param(p)),
  };
}

export function buildRxDocument(r: {
  phone: string; patientName: string; doctor: string; facilityName: string; date: Date; followUp: string | null; pdfUrl: string; rxId: string;
}): TemplateMessage | null {
  const to = toE164India(r.phone);
  if (!to) return null;
  return {
    kind: "RX_DOCUMENT", to, template: TEMPLATES.RX_DOCUMENT.name, language: "en",
    bodyParams: [firstName(r.patientName), r.doctor, r.facilityName, formatDay(r.date), r.followUp ?? "as advised"].map((p) => param(p)),
    document: { url: r.pdfUrl, filename: `Prescription-${r.rxId.slice(-6).toUpperCase()}.pdf` },
  };
}

export function buildFollowUp(f: { phone: string; patientName: string; doctor: string; instructions: string[]; followUp: string | null }): TemplateMessage | null {
  const to = toE164India(f.phone);
  if (!to || (!f.instructions.length && !f.followUp)) return null;
  return {
    kind: "FOLLOW_UP", to, template: TEMPLATES.FOLLOW_UP.name, language: "en",
    bodyParams: [firstName(f.patientName), f.doctor, f.instructions.join("; ") || "as discussed", f.followUp ?? "as advised"].map((p) => param(p)),
  };
}

// ─── Provider adapters ────────────────────────────────────────────────────────

/** POST https://graph.facebook.com/{version}/{phone-number-id}/messages (Bearer token). */
export function toMetaPayload(m: TemplateMessage) {
  const version = process.env.META_GRAPH_VERSION || "v21.0";
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID || "{PHONE_NUMBER_ID}";
  const components: Record<string, unknown>[] = [];
  if (m.document) components.push({ type: "header", parameters: [{ type: "document", document: { link: m.document.url, filename: m.document.filename } }] });
  components.push({ type: "body", parameters: m.bodyParams.map((text) => ({ type: "text", text })) });
  return {
    url: `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: m.to.replace(/^\+/, ""),
      type: "template",
      template: { name: m.template, language: { code: m.language }, components },
    },
  };
}

/** POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json (form-encoded, Basic auth). */
export function toTwilioPayload(m: TemplateMessage) {
  const sid = process.env.TWILIO_ACCOUNT_SID || "{ACCOUNT_SID}";
  const vars: Record<string, string> = Object.fromEntries(m.bodyParams.map((v, i) => [String(i + 1), v]));
  if (m.document) vars[String(m.bodyParams.length + 1)] = m.document.url; // media variable in the Content Template
  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    form: {
      From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM || "+14155238886"}`,
      To: `whatsapp:${m.to}`,
      ContentSid: process.env[`TWILIO_CONTENT_SID_${m.kind}`] || `{CONTENT_SID_${m.kind}}`,
      ContentVariables: JSON.stringify(vars),
    },
  };
}

// ─── Send ─────────────────────────────────────────────────────────────────────

function provider(): MessageProvider {
  const p = process.env.WHATSAPP_PROVIDER?.toLowerCase();
  if (p === "meta" && process.env.META_WA_TOKEN && process.env.META_WA_PHONE_NUMBER_ID) return "META";
  if (p === "twilio" && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return "TWILIO";
  return "DRY_RUN";
}

async function deliver(p: MessageProvider, m: TemplateMessage): Promise<{ status: MessageStatus; id?: string; error?: string; payload: unknown }> {
  if (p === "DRY_RUN") return { status: "SIMULATED", payload: toMetaPayload(m).body };
  const signal = AbortSignal.timeout(10_000);
  try {
    if (p === "META") {
      const { url, body } = toMetaPayload(m);
      const res = await fetch(url, { method: "POST", signal, headers: { Authorization: `Bearer ${process.env.META_WA_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      return res.ok ? { status: "SENT", id: data.messages?.[0]?.id, payload: body } : { status: "FAILED", error: data.error?.message ?? `HTTP ${res.status}`, payload: body };
    }
    const { url, form } = toTwilioPayload(m);
    const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await fetch(url, { method: "POST", signal, headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form) });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    return res.ok ? { status: "SENT", id: data.sid, payload: form } : { status: "FAILED", error: data.message ?? `HTTP ${res.status}`, payload: form };
  } catch (err) {
    return { status: "FAILED", error: err instanceof Error ? err.message : String(err), payload: null };
  }
}

/** Never throws: a failed WhatsApp must not fail a booking or a prescription. */
export async function sendWhatsApp(m: TemplateMessage, opts: { patientId: string; consent: boolean }) {
  const p = provider();
  const outcome = opts.consent ? await deliver(p, m) : { status: "SKIPPED_NO_CONSENT" as const, payload: toMetaPayload(m).body };
  try {
    const log = await db.messageLog.create({
      data: {
        patientId: opts.patientId, kind: m.kind, provider: p, to: m.to, payload: outcome.payload as Prisma.InputJsonValue,
        status: outcome.status, providerMessageId: "id" in outcome ? outcome.id ?? null : null, error: "error" in outcome ? outcome.error ?? null : null,
      } as Prisma.MessageLogUncheckedCreateInput,
    });
    await audit("SEND", "WhatsApp", { entityId: log.id, patientIds: [opts.patientId], meta: { kind: m.kind, provider: p, status: outcome.status, template: m.template } });
    return { id: log.id, status: outcome.status, provider: p };
  } catch (err) {
    console.error("WhatsApp log failed", err);
    return { id: null, status: outcome.status, provider: p };
  }
}

// ─── Domain events ────────────────────────────────────────────────────────────

export async function sendAppointmentToken(appointmentId: string) {
  try {
    return await tokenMessage(appointmentId);
  } catch (err) {
    console.error("WhatsApp token delivery failed", err); // the booking itself already succeeded
    return { id: null, status: "FAILED" as const, provider: "DRY_RUN" as const };
  }
}

async function tokenMessage(appointmentId: string) {
  const a = await db.appointment.findUnique({ where: { id: appointmentId }, include: { patient: true, department: true, consultant: true, facility: true } });
  if (!a?.patient.phone) return null;
  const m = buildAppointmentToken({
    phone: a.patient.phone, patientName: a.patient.name, facilityName: a.facility.name, token: a.tokenLabel, department: a.department.name,
    date: a.date, consultant: a.consultant?.name ?? null, room: a.department.room,
  });
  return m ? sendWhatsApp(m, { patientId: a.patientId, consent: a.patient.whatsappConsent }) : null;
}

/** After signing: the Rx PDF (signed 7-day link), plus care instructions if any were dictated. Never throws. */
export async function sendRxDocuments(rxId: string) {
  const sent: Awaited<ReturnType<typeof sendWhatsApp>>[] = [];
  try {
    const rx = await db.prescription.findUnique({ where: { id: rxId }, include: { patient: true, consultant: true, facility: true } });
    if (!rx?.patient.phone || rx.status !== "SIGNED" || !rx.signedAt) return sent;
    const doc = buildRxDocument({
      phone: rx.patient.phone, patientName: rx.patient.name, doctor: rx.consultant.name, facilityName: rx.facility.name, date: rx.signedAt,
      followUp: rx.followUp, pdfUrl: signDocLink("rx", rx.id), rxId: rx.id,
    });
    if (doc) sent.push(await sendWhatsApp(doc, { patientId: rx.patientId, consent: rx.patient.whatsappConsent }));
    const fu = buildFollowUp({ phone: rx.patient.phone, patientName: rx.patient.name, doctor: rx.consultant.name, instructions: rx.advice, followUp: rx.followUp });
    if (fu) sent.push(await sendWhatsApp(fu, { patientId: rx.patientId, consent: rx.patient.whatsappConsent }));
  } catch (err) {
    // The prescription is already signed and routed; a messaging problem must not undo or hide that.
    console.error("WhatsApp Rx delivery failed", err);
    sent.push({ id: null, status: "FAILED", provider: "DRY_RUN" });
  }
  return sent;
}
