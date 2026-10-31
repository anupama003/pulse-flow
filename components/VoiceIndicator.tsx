"use client";

import { Mic } from "lucide-react";

/**
 * idle: box not focused · ready: focused, waiting for the hotkey · holding: a lone modifier key
 * (Wispr's hotkey) is held · transcribing: key released, waiting for Wispr's text · receiving: text
 * is landing. The browser can't see Wispr itself, so holding/transcribing are best-effort hints;
 * dictation works whatever this pill says.
 */
export type VoicePhase = "idle" | "ready" | "holding" | "transcribing" | "receiving";

const LABEL: Record<VoicePhase, string> = {
  idle: "Tap box to dictate",
  ready: "Ready · hold Wispr key",
  holding: "Listening…",
  transcribing: "Transcribing…",
  receiving: "Receiving text…",
};

export default function VoiceIndicator({ phase }: { phase: VoicePhase }) {
  const live = phase === "holding" || phase === "receiving";
  const busy = live || phase === "transcribing";
  return (
    <div className="flex items-center gap-3 rounded-full bg-white/70 py-1.5 pl-1.5 pr-4 shadow-sm backdrop-blur" aria-live="polite">
      <span
        className={`relative grid size-9 place-items-center rounded-full transition-colors ${
          busy ? "bg-ink text-white" : phase === "ready" ? "bg-lavender-100 text-lavender-700" : "bg-white text-ink/50"
        }`}
      >
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-lavender-400/40" />}
        <Mic className="relative size-4" />
      </span>
      <div className="flex h-5 items-center gap-[3px]" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`h-full w-[3px] origin-center rounded-full ${
              live ? "animate-listening bg-lavender-700" : phase === "transcribing" ? "scale-y-[0.5] animate-pulse bg-lavender-500" : "scale-y-[0.3] bg-ink/20"
            }`}
            style={live ? { animationDelay: `${(i % 3) * 0.14}s` } : phase === "transcribing" ? { animationDelay: `${i * 0.1}s` } : undefined}
          />
        ))}
      </div>
      <span className={`text-xs font-medium ${busy ? "text-lavender-700" : "text-ink/60"}`}>{LABEL[phase]}</span>
    </div>
  );
}
