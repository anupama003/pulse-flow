"use client";

import { useEffect } from "react";

const TEXTLIKE = new Set(["text", "search", "email", "tel", "url", "number"]);

type Tracked = (HTMLInputElement | HTMLTextAreaElement) & { _valueTracker?: { getValue(): string } };

/**
 * App-wide fix for dictation into ordinary (controlled) fields: the booking box, Rx editor, front-desk
 * form, "Pending" SBAR boxes…
 *
 * Wispr Flow sometimes inserts text through macOS accessibility, which changes the field's DOM value
 * without an input event. React never hears about it: the text shows, but state stays stale (buttons
 * stay disabled) and the next re-render silently erases it. When the focused field's DOM value differs
 * from the value React last saw, we fire the input event Wispr didn't, so React's onChange runs.
 * Checked on every caret move (selectionchange) and every 100 ms as a fallback.
 */
export default function DictationBridge() {
  useEffect(() => {
    const sync = () => {
      const el = document.activeElement as Tracked | null;
      const textField = el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && TEXTLIKE.has(el.type));
      if (!el || !textField || el.readOnly || el.disabled) return;
      const known = el._valueTracker?.getValue();
      if (known !== undefined && known !== el.value) el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    document.addEventListener("selectionchange", sync);
    const t = setInterval(sync, 100);
    return () => {
      document.removeEventListener("selectionchange", sync);
      clearInterval(t);
    };
  }, []);
  return null;
}
