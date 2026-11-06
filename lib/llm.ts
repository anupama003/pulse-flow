import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// One place for every LLM call in the app: schema-locked JSON out, typed errors in.
// Two interchangeable providers, chosen from .env:
//
//   LLM_PROVIDER=gemini     → GEMINI_API_KEY   (models: GEMINI_MODEL, GEMINI_FAST_MODEL)
//   LLM_PROVIDER=anthropic  → ANTHROPIC_API_KEY
//   (unset)                 → Gemini if only GEMINI_API_KEY is set, otherwise Anthropic
//
// Callers never see the difference: same prompts, same Zod schemas, and the same deterministic
// rules engine runs afterwards, whichever model produced the JSON.

export class ExtractionError extends Error {}
export type Provider = "gemini" | "anthropic";
type Effort = "low" | "medium" | "high";

const env = (k: string) => process.env[k]?.trim() || undefined;

export function provider(): Provider {
  const p = env("LLM_PROVIDER")?.toLowerCase();
  if (p === "gemini" || p === "google") return "gemini";
  if (p === "anthropic" || p === "claude") return "anthropic";
  return env("GEMINI_API_KEY") && !env("ANTHROPIC_API_KEY") ? "gemini" : "anthropic";
}

const ANTHROPIC_MODEL = "claude-opus-5-5";
/** Balanced quality/speed for clinical extraction (handover, rounds, e-Rx). */
const geminiModel = () => env("GEMINI_MODEL") ?? "gemini-3.8-flash";
/** Fastest model for short, latency-sensitive intake (booking, walk-ins). */
const geminiFastModel = () => env("GEMINI_FAST_MODEL") ?? "gemini-3.5-flash-lite";

export function modelFor(effort: Effort = "medium"): string {
  if (provider() === "anthropic") return ANTHROPIC_MODEL;
  return effort === "low" ? geminiFastModel() : geminiModel();
}

/** Stored on every Handover for audits / re-runs. */
export const activeModelMeta = () => ({ provider: provider(), model: modelFor("medium") });

/** Strip our own XML wrapper tags from user-supplied text so it can't fake prompt sections. */
export const fence = (s: string) => s.replace(/<\/?(transcript|ward_census|existing_care_plan|patient|departments|today|mode)>/gi, "");

const notConfigured = () =>
  new ExtractionError(
    `AI isn't configured on this server yet (${provider() === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"}). You can still fill the form by hand.`,
  );

// ─── Anthropic ────────────────────────────────────────────────────────────────

let anthropic: Anthropic | null = null;

async function viaAnthropic<S extends z.ZodTypeAny>(system: string, user: string, schema: S, effort: Effort): Promise<unknown> {
  if (!env("ANTHROPIC_API_KEY")) throw notConfigured();
  anthropic ??= new Anthropic();
  let res;
  try {
    res = await anthropic.messages.parse({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      system,
      output_config: { effort, format: zodOutputFormat(schema) },
      messages: [{ role: "user", content: user }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new ExtractionError("AI key missing or invalid. Check ANTHROPIC_API_KEY.");
    if (err instanceof Anthropic.RateLimitError) throw new ExtractionError("AI is busy. Try again in a few seconds.");
    if (err instanceof Anthropic.APIConnectionError) throw new ExtractionError("Couldn't reach the AI service.");
    throw err;
  }
  if (res.stop_reason === "refusal") throw new ExtractionError("The AI declined to process this dictation.");
  if (res.stop_reason === "max_tokens") throw new ExtractionError("Dictation too long. Split it into two.");
  if (!res.parsed_output) throw new ExtractionError("AI returned an unreadable result.");
  return res.parsed_output;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

let gemini: GoogleGenAI | null = null;

/** Zod → the JSON Schema subset Gemini enforces (no $schema key; nullables as anyOf [T, null]). */
export function geminiSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

const httpStatus = (err: unknown) => {
  const e = err as { status?: number; statusCode?: number };
  return e.status ?? e.statusCode;
};
/** Google-side overload or outage: worth one try on the other model instead of failing the doctor. */
const overloaded = (err: unknown) => {
  const s = httpStatus(err);
  return s === 429 || s === 500 || s === 503 || s === 504 || (err as Error)?.name === "TimeoutError" || /timed? ?out/i.test(String((err as Error)?.message));
};

async function viaGemini<S extends z.ZodTypeAny>(system: string, user: string, schema: S, effort: Effort): Promise<unknown> {
  const apiKey = env("GEMINI_API_KEY");
  if (!apiKey) throw notConfigured();
  gemini ??= new GoogleGenAI({ apiKey });
  const client = gemini;
  const primary = modelFor(effort);
  const fallback = primary === geminiModel() ? geminiFastModel() : geminiModel();
  const call = (model: string) =>
    client.interactions.create(
      {
        model,
        system_instruction: system,
        input: user,
        response_format: { type: "text", mime_type: "application/json", schema: geminiSchema(schema) },
        generation_config: { thinking_level: effort, max_output_tokens: 16000 },
      },
      // Fail fast: the SDK's default retries kept a doctor waiting ~45 s before showing an error.
      { maxRetries: 1, timeout: 40_000 },
    );
  let res;
  try {
    try {
      res = await call(primary);
    } catch (err) {
      if (!overloaded(err) || fallback === primary) throw err;
      console.warn(`[llm] ${primary} unavailable (${httpStatus(err) ?? (err as Error).name}); retrying on ${fallback}`);
      res = await call(fallback);
    }
  } catch (err) {
    const status = httpStatus(err);
    if (status === 400 && /api key/i.test(String((err as Error).message))) throw new ExtractionError("AI key invalid. Check GEMINI_API_KEY.");
    if (status === 401 || status === 403) throw new ExtractionError("AI key missing or invalid. Check GEMINI_API_KEY.");
    if (status === 404) throw new ExtractionError(`Gemini model "${primary}" isn't available to this key. Set GEMINI_MODEL / GEMINI_FAST_MODEL.`);
    if (overloaded(err)) throw new ExtractionError("Google's AI service is overloaded right now. Your dictation is safe: wait ~30 s and try again.");
    if (status === undefined && err instanceof TypeError) throw new ExtractionError("Couldn't reach the AI service.");
    throw err;
  }
  if (res.status === "incomplete" || res.status === "budget_exceeded") throw new ExtractionError("Dictation too long. Split it into two.");
  if (res.status === "failed" || res.status === "cancelled") throw new ExtractionError("The AI declined or failed to process this dictation.");
  if (!res.output_text) throw new ExtractionError("AI returned an empty result.");
  try {
    return JSON.parse(res.output_text);
  } catch {
    throw new ExtractionError("AI returned an unreadable result.");
  }
}

// ─── Public ───────────────────────────────────────────────────────────────────

export async function structured<S extends z.ZodTypeAny>(system: string, user: string, schema: S, effort: Effort = "medium"): Promise<z.infer<S>> {
  const raw = provider() === "gemini" ? await viaGemini(system, user, schema, effort) : await viaAnthropic(system, user, schema, effort);
  const parsed = schema.safeParse(raw); // belt and braces: never trust the shape blindly
  if (!parsed.success) throw new ExtractionError("AI returned data in an unexpected shape. Try again.");
  return parsed.data;
}
