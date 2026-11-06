"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Loader2, Mic, Sparkles, Trash2 } from "lucide-react";
import VoiceIndicator, { type VoicePhase } from "./VoiceIndicator";
import { SPLASH_DONE_EVENT, TOUR_DONE_EVENT } from "./brand/splash-key";
import { useDictationActivity } from "./useDictationActivity";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
  error: string | null;
  eyebrow: string;
  title: string;
  subtitle: string;
  placeholder: string;
  buttonLabel: string;
  pendingLabel: string;
  minWords?: number;
  autoFocus?: boolean;
  /** Stretch to the parent's height (only when the card is alone in a grid cell, e.g. next to Ward overview). */
  fill?: boolean;
  /**
   * The page's main dictation box: focused automatically (once the splash/tour are out of the way)
   * so holding the Wispr key just works, and it catches dictation pasted while nothing was focused.
   */
  primary?: boolean;
}

/** A box behind an open modal (e.g. the ward box behind Live rounds) must not grab focus or dictation. */
const isTopmost = (el: HTMLElement) => {
  const modals = document.querySelectorAll('[aria-modal="true"]');
  const top = modals[modals.length - 1];
  return !top || top.contains(el);
};

/**
 * Lavender "premium course" card used for both the shift brain dump and live rounds.
 * Wispr Flow types into the textarea, so the doctor never touches a keyboard.
 */
export default function DictationBox({
  value,
  onChange,
  onSubmit,
  pending,
  error,
  eyebrow,
  title,
  subtitle,
  placeholder,
  buttonLabel,
  pendingLabel,
  minWords = 3,
  autoFocus,
  fill = false,
  primary = false,
}: Props) {
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(value);
  latest.current = value;
  /** The text we last saw in (or wrote to) the DOM. */
  const synced = useRef(value);

  // The textarea is deliberately *uncontrolled*: the browser owns its text and we only read from it.
  // A controlled textarea gets its DOM value overwritten with React state on every re-render (the
  // "receiving" glow, word count, auto-refresh…). Wispr's accessibility insertion doesn't fire an
  // input event, so text it had just inserted was wiped by the next render: dictation landed in
  // 2–3 word fragments, or not at all.
  const pull = useCallback(() => {
    const el = ref.current;
    if (!el || el.value === synced.current) return;
    synced.current = el.value;
    onChange(el.value);
  }, [onChange]);

  // Push changes that came from outside the box (Clear, restored draft, caught paste) into the DOM.
  useEffect(() => {
    const el = ref.current;
    if (!el || value === synced.current) return;
    synced.current = value;
    if (el.value !== value) el.value = value;
  }, [value]);

  // Catch insertions that fire no input event. Polled rather than focus-gated, because focus events
  // don't fire while the browser window itself isn't the active app.
  useEffect(() => {
    const t = setInterval(() => {
      pull();
      if (ref.current && document.activeElement === ref.current) setFocused(true);
    }, 120);
    return () => clearInterval(t);
  }, [pull]);

  // Wispr's hotkey is handled by macOS, so the page can't know for sure that it's listening. When
  // the browser does see a modifier (Fn, Ctrl, ⌥, ⌘) held on its own while this box is focused,
  // that's almost certainly the push-to-talk key: show "Listening…" and, after release,
  // "Transcribing…" until Wispr's text arrives (it inserts the text only after you let go).
  const [hold, setHold] = useState<"none" | "holding" | "transcribing">("none");
  useEffect(() => {
    const MODIFIERS = new Set(["Fn", "Control", "Alt", "Meta"]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let down: string | null = null;
    const reset = () => {
      clearTimeout(timer);
      down = null;
      setHold("none");
    };
    const onDown = (e: KeyboardEvent) => {
      if (document.activeElement !== ref.current) return;
      if (!MODIFIERS.has(e.key)) return reset(); // a shortcut like ⌘C, not dictation
      if (e.repeat || down) return;
      down = e.key;
      clearTimeout(timer);
      timer = setTimeout(() => down && setHold("holding"), 250);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key !== down) return;
      clearTimeout(timer);
      down = null;
      setHold((h) => (h === "holding" ? "transcribing" : "none"));
      timer = setTimeout(() => setHold("none"), 8000); // Wispr never sent anything
    };
    window.addEventListener("keydown", onDown, true);
    window.addEventListener("keyup", onUp, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onDown, true);
      window.removeEventListener("keyup", onUp, true);
    };
  }, []);

  // Primary box: keep it focused so the Wispr hotkey always has somewhere to type: after load, after
  // the splash/tour, and after a click on plain (non-interactive) parts of the page. Never steals focus
  // from another field, never from behind a modal, and not on touch devices (it would pop the keyboard).
  useEffect(() => {
    if (!primary) return;
    const focusIfIdle = () => {
      const el = ref.current;
      if (!el || el.disabled || !isTopmost(el)) return;
      const active = document.activeElement;
      const idle = !active || active === document.body || active === document.documentElement;
      const selecting = !!window.getSelection()?.toString();
      if (idle && !selecting && !document.getElementById("pf-splash") && !document.querySelector('[aria-label="Product tour"]') && matchMedia("(pointer: fine)").matches) {
        el.focus({ preventScroll: true });
      }
    };
    const afterClick = () => setTimeout(focusIfIdle, 0);
    const t = setTimeout(focusIfIdle, 150);
    window.addEventListener(SPLASH_DONE_EVENT, focusIfIdle);
    window.addEventListener(TOUR_DONE_EVENT, focusIfIdle);
    document.addEventListener("pointerup", afterClick);
    return () => {
      clearTimeout(t);
      window.removeEventListener(SPLASH_DONE_EVENT, focusIfIdle);
      window.removeEventListener(TOUR_DONE_EVENT, focusIfIdle);
      document.removeEventListener("pointerup", afterClick);
    };
  }, [primary]);

  // Primary box: Wispr pastes into whatever is focused. If nothing was, catch the paste here.
  useEffect(() => {
    if (!primary) return;
    const onPaste = (e: ClipboardEvent) => {
      const active = document.activeElement;
      const editable = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active as HTMLElement | null)?.isContentEditable;
      if (editable || !ref.current || ref.current.disabled || !isTopmost(ref.current)) return;
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      e.preventDefault();
      onChange(latest.current ? `${latest.current} ${text}` : text);
      ref.current.focus({ preventScroll: true });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [primary, onChange]);
  const { receiving, words } = useDictationActivity(value);
  // Text arrived: the transcribing hint has done its job.
  useEffect(() => {
    if (receiving) setHold((h) => (h === "transcribing" ? "none" : h));
  }, [receiving]);
  const phase: VoicePhase = receiving ? "receiving" : hold !== "none" ? hold : focused ? "ready" : "idle";
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section
      className={`relative ${fill ? "h-full" : ""} overflow-clip rounded-[2rem] bg-gradient-to-br from-lavender-200 via-[#dcdafc] to-powder-200 p-6 transition-shadow duration-500 md:p-8 ${
        receiving ? "shadow-[0_0_0_4px_rgb(255_255_255/0.9),0_30px_80px_-20px_rgb(140_120_240/0.6)]" : "shadow-widget"
      }`}
    >
      {/* soft decorative orbs */}
      <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-10 size-56 rounded-full bg-blush-100/60 blur-3xl" />

      <header className="relative mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-lavender-700">
            <Sparkles className="size-3.5" /> {eyebrow}
          </p>
          <h2 className="text-3xl font-normal tracking-tight text-ink md:text-4xl">{title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink/60">{subtitle}</p>
        </div>
        <VoiceIndicator phase={phase} />
      </header>

      <textarea
        ref={ref}
        defaultValue={value}
        onInput={pull}
        onChange={pull}
        onKeyUp={pull}
        onCompositionEnd={pull}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          pull();
          setFocused(false);
        }}
        disabled={pending}
        autoFocus={autoFocus}
        rows={7}
        placeholder={placeholder}
        aria-label={title}
        className="relative block min-h-48 w-full resize-y rounded-3xl border border-white/80 bg-white/70 p-5 text-lg leading-relaxed text-ink shadow-[inset_0_1px_0_rgb(255_255_255)] backdrop-blur-sm placeholder:text-ink/30 focus:bg-white/90 focus:outline-none focus:ring-4 focus:ring-white/70 disabled:opacity-60 md:text-xl"
      />

      <footer className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink/60">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/60 py-1 pl-1 pr-3">
            <span className="grid size-7 place-items-center rounded-full bg-ink text-white">
              <CalendarDays className="size-3.5" />
            </span>
            {today}
          </span>
          <span className="rounded-full bg-white/60 px-3 py-1.5 font-mono text-xs tabular-nums">{words} words</span>
          {value && !pending && (
            <button onClick={() => onChange("")} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 hover:bg-white/60 hover:text-blush-700">
              <Trash2 className="size-4" /> Clear
            </button>
          )}
          {error && <span className="rounded-full bg-blush-100 px-3 py-1.5 text-blush-700">{error}</span>}
        </div>

        <motion.button
          whileHover={{ scale: pending ? 1 : 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onSubmit}
          disabled={pending || words < minWords}
          className="inline-flex items-center gap-3 rounded-full bg-ink py-2 pl-2 pr-6 text-base font-medium text-white shadow-[0_14px_30px_-10px_rgb(31_29_43/0.6)] transition disabled:cursor-not-allowed disabled:bg-ink/30 disabled:shadow-none"
        >
          <span className="grid size-10 place-items-center rounded-full bg-white/15">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Mic className="size-5" />}
          </span>
          {pending ? pendingLabel : buttonLabel}
        </motion.button>
      </footer>
    </section>
  );
}
