import "server-only";
import { ExtractionError } from "./llm";
import { ForbiddenError } from "./staff";
import { StoreError } from "./store";
import type { ActionResult } from "./types";

/** Errors meant for the user become a friendly message; anything else is logged and hidden. */
export function fail(err: unknown): { ok: false; error: string } {
  if (err instanceof ExtractionError || err instanceof StoreError || err instanceof ForbiddenError || err instanceof UserError) {
    return { ok: false, error: err.message };
  }
  console.error(err);
  return { ok: false, error: "Something went wrong. Nothing was lost. Try again." };
}

export class UserError extends Error {}

export async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return fail(err);
  }
}
