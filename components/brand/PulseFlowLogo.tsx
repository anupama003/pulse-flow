"use client";

import { useId } from "react";

// Pulse Flow mark: a heartbeat spike that relaxes into a flowing wave (the doctor's voice
// becoming calm, structured data). A bright pastel tracer travels the line on a loop and the
// end-dot breathes. SMIL animation, so it works inline, as /pulse-flow-logo.svg and as the favicon.
// Reduced-motion users get the static mark (see .pf-anim in globals.css).

export const PULSE_PATH = "M7 34 H17 L21 27 L26 43 L31 17 L36 39 L39.5 31 C44 24 48 24 51.5 31 S57.5 38 58 34";

/** tone="light": white disc with deeper pastels, for light surfaces like the notebook splash. */
export function PulseFlowMark({ size = 40, animated = true, className = "", tone = "dark" }: { size?: number; animated?: boolean; className?: string; tone?: "dark" | "light" }) {
  const light = tone === "light";
  const stops = light ? ["#f490a3", "#a99ff2", "#5ecf9b"] : ["#fdcbd5", "#d9d3fb", "#b9ecd2"];
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="Pulse Flow" className={className}>
      <defs>
        <linearGradient id={`pf-g-${id}`} x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
          {animated && <animateTransform className="pf-anim" attributeName="gradientTransform" type="translate" values="-24 0; 24 0; -24 0" dur="6s" repeatCount="indefinite" />}
        </linearGradient>
        <filter id={`pf-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="32" fill={light ? "#ffffff" : "#1f1d2b"} />
      {/* resting line */}
      <path d={PULSE_PATH} stroke={`url(#pf-g-${id})`} strokeOpacity="0.35" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      {animated && (
        <g className="pf-anim">
          {/* glow + tracer travelling along the pulse */}
          <path d={PULSE_PATH} stroke={`url(#pf-g-${id})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray="28 100" filter={`url(#pf-glow-${id})`} opacity="0.8">
            <animate attributeName="stroke-dashoffset" values="128;0" dur="2.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.25 1" />
          </path>
          <path d={PULSE_PATH} stroke={`url(#pf-g-${id})`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" pathLength="100" strokeDasharray="28 100">
            <animate attributeName="stroke-dashoffset" values="128;0" dur="2.4s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.25 1" />
          </path>
        </g>
      )}
      {/* full-strength line: always for the static mark, and for reduced-motion users of the animated one */}
      <path d={PULSE_PATH} className={animated ? "pf-static" : ""} stroke={`url(#pf-g-${id})`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* breathing end-dot */}
      <circle cx="58" cy="34" r="2.6" fill={stops[2]}>
        {animated && <animate className="pf-anim" attributeName="r" values="2.2;3.6;2.2" dur="2.4s" repeatCount="indefinite" />}
      </circle>
    </svg>
  );
}

/** Mark + wordmark, for headers. */
export function PulseFlowLogo({ size = 40, subtitle, className = "" }: { size?: number; subtitle?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <PulseFlowMark size={size} />
      <span className="leading-tight">
        <span className="block text-lg font-semibold tracking-tight text-ink">
          Pulse <span className="bg-gradient-to-r from-blush-300 via-lavender-400 to-mint-400 bg-clip-text text-transparent">Flow</span>
        </span>
        {subtitle && <span className="block text-xs text-slate-500">{subtitle}</span>}
      </span>
    </span>
  );
}

/** Small brand footer used on every route. */
export function PulseFlowFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-wrap items-center justify-center gap-2 py-4 text-xs text-slate-400 ${className}`}>
      <PulseFlowMark size={16} animated={false} />
      <span>
        <span className="font-semibold text-slate-500">Pulse Flow</span> · voice-first care, from handover to pharmacy · Prototype, not a medical device
      </span>
    </footer>
  );
}
