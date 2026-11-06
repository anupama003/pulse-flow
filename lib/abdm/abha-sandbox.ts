import "server-only";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { base } from "../db";

// ABDM Milestone 1 (ABHA creation/verification + linking) SIMULATION.
//
// The real flow calls the ABDM gateway (sandbox: abhasbx.abdm.gov.in) with client credentials
// issued after facility registration on the ABDM sandbox. This module mirrors the same steps
// (mobile OTP → verify → pick or create ABHA → link to the facility's patient record) against a
// local `AbhaSandboxAccount` table so the UX can be demoed without credentials.
//
// The OTP is returned to the UI (clearly labelled "sandbox") instead of being sent by SMS.
// To go live, replace these functions with ABDM gateway calls. The UI and booking code don't change.

interface Txn {
  mobile: string;
  otpHash: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}
const g = globalThis as unknown as { __abhaTxns?: Map<string, Txn>; __abhaSends?: Map<string, number[]> };
const txns = (g.__abhaTxns ??= new Map());
const sends = (g.__abhaSends ??= new Map());

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 3;
const MAX_SENDS_PER_10_MIN = 3;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export class AbhaError extends Error {}

export const maskMobile = (m: string) => `XXXXXX${m.slice(-4)}`;

export function requestMobileOtp(mobile: string) {
  const m = mobile.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(m)) throw new AbhaError("Enter a valid 10-digit Indian mobile number.");
  const recent = (sends.get(m) ?? []).filter((t: number) => Date.now() - t < 10 * 60_000);
  if (recent.length >= MAX_SENDS_PER_10_MIN) throw new AbhaError("Too many OTP requests. Try again in 10 minutes.");
  sends.set(m, [...recent, Date.now()]);

  const otp = String(randomInt(100000, 1000000));
  const txnId = randomUUID();
  txns.set(txnId, { mobile: m, otpHash: hash(`${txnId}:${otp}`), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, verified: false });
  return { txnId, sentTo: maskMobile(m), sandboxOtp: otp, expiresInSec: OTP_TTL_MS / 1000 };
}

export async function verifyMobileOtp(txnId: string, otp: string) {
  const t = txns.get(txnId);
  if (!t || Date.now() > t.expiresAt) throw new AbhaError("OTP expired. Request a new one.");
  if (t.attempts >= MAX_ATTEMPTS) throw new AbhaError("Too many wrong attempts. Request a new OTP.");
  t.attempts++;
  if (hash(`${txnId}:${otp.trim()}`) !== t.otpHash) throw new AbhaError(`Incorrect OTP. ${MAX_ATTEMPTS - t.attempts} attempt(s) left.`);
  t.verified = true;
  const accounts = await base.abhaSandboxAccount.findMany({ where: { mobile: t.mobile } });
  return {
    mobile: t.mobile,
    accounts: accounts.map((a) => ({ abhaNumber: a.abhaNumber, abhaAddress: a.abhaAddress, name: a.name, gender: a.gender, yearOfBirth: a.yearOfBirth })),
  };
}

/** Create a new (sandbox) ABHA after a verified mobile OTP. */
export async function createAbha(txnId: string, profile: { name: string; gender: "MALE" | "FEMALE" | "OTHER"; yearOfBirth: number }) {
  const t = txns.get(txnId);
  if (!t?.verified || Date.now() > t.expiresAt) throw new AbhaError("Verify your mobile OTP first.");
  const name = profile.name.trim();
  if (name.length < 2) throw new AbhaError("Enter the full name as on Aadhaar/ID.");
  const year = new Date().getFullYear();
  if (profile.yearOfBirth < year - 120 || profile.yearOfBirth > year) throw new AbhaError("Enter a valid year of birth.");

  // "99-…" prefix marks sandbox numbers so they can never be mistaken for real ABHA numbers.
  const digits = `99${String(randomInt(0, 1e12)).padStart(12, "0")}`;
  const abhaNumber = `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
  const handle = name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 18) || "user";
  const abhaAddress = `${handle}${randomInt(10, 9999)}@sbx`;
  const acc = await base.abhaSandboxAccount.create({ data: { abhaNumber, abhaAddress, mobile: t.mobile, name, gender: profile.gender, yearOfBirth: profile.yearOfBirth } });
  return { abhaNumber: acc.abhaNumber, abhaAddress: acc.abhaAddress, name: acc.name, gender: acc.gender, yearOfBirth: acc.yearOfBirth };
}

/** Booking calls this to confirm the ABHA really belongs to the OTP-verified mobile before linking. */
export async function assertLinkable(txnId: string, abhaNumber: string) {
  const t = txns.get(txnId);
  if (!t?.verified) throw new AbhaError("ABHA link expired. Verify the OTP again.");
  const acc = await base.abhaSandboxAccount.findUnique({ where: { abhaNumber } });
  if (!acc || acc.mobile !== t.mobile) throw new AbhaError("This ABHA isn't linked to the verified mobile.");
  return acc;
}
