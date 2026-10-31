import React from "react";
import { AbsoluteFill, Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const { fontFamily: SANS } = loadOutfit("normal", { weights: ["300", "400", "500", "600", "700"], subsets: ["latin"] });
export const { fontFamily: MONO } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

// Same palette as the app's Tailwind @theme tokens.
export const C = {
  ink: "#1f1d2b",
  ink2: "#2a2740",
  night: "#0c0b14",
  canvas: "#f6f5fb",
  white: "#ffffff",
  lav50: "#f4f2ff",
  lav100: "#ece9ff",
  lav200: "#d9d3fb",
  lav400: "#a99ff2",
  lav700: "#5b4bd6",
  blush100: "#ffe4ec",
  blush300: "#fdcbd5",
  blush500: "#f490a3",
  blush700: "#d6456b",
  mint100: "#dcf7ec",
  mint400: "#5ecf9b",
  mint700: "#23865b",
  powder100: "#e0efff",
  powder700: "#3b78c4",
  butter100: "#fff4cc",
  butter700: "#a07800",
  slate: "#6b6880",
};
export const GRAD = `linear-gradient(90deg, ${C.blush500}, ${C.lav400}, ${C.mint400})`;

export const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** 0→1 spring starting at `delay` frames. */
export function useIn(delay = 0, damping = 18, mass = 0.9) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass } });
}

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ─── Stage ──────────────────────────────────────────────────────────────────

/** Dark high-tech stage: perspective grid, drifting pastel aurora, scanline and grain. */
export const Stage: React.FC<{ children?: React.ReactNode; hue?: "lav" | "blush" | "mint" | "powder" }> = ({ children, hue = "lav" }) => {
  const frame = useCurrentFrame();
  const glow = { lav: C.lav400, blush: C.blush500, mint: C.mint400, powder: "#7fb2f0" }[hue];
  const drift = frame * 0.6;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 0%, #1a1830 0%, ${C.night} 60%)`, fontFamily: SANS, overflow: "hidden" }}>
      {/* aurora */}
      <div style={{ position: "absolute", width: 1400, height: 1400, left: -300 + Math.sin(frame / 70) * 120, top: -700, borderRadius: "50%", background: `radial-gradient(circle, ${glow}55, transparent 60%)`, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", width: 1100, height: 1100, right: -400 + Math.cos(frame / 60) * 100, bottom: -600, borderRadius: "50%", background: `radial-gradient(circle, ${C.blush500}33, transparent 60%)`, filter: "blur(50px)" }} />
      {/* perspective grid floor */}
      <div style={{ position: "absolute", left: "-50%", right: "-50%", bottom: -200, height: 700, transform: "perspective(600px) rotateX(62deg)", transformOrigin: "50% 100%", backgroundImage: `linear-gradient(${C.lav400}22 1px, transparent 1px), linear-gradient(90deg, ${C.lav400}22 1px, transparent 1px)`, backgroundSize: "80px 80px", backgroundPosition: `0 ${drift}px`, maskImage: "linear-gradient(to top, black 10%, transparent 90%)", WebkitMaskImage: "linear-gradient(to top, black 10%, transparent 90%)" }} />
      {/* dust particles */}
      {Array.from({ length: 40 }).map((_, i) => {
        const x = random(`x${i}`) * 1920;
        const y = (random(`y${i}`) * 1200 - frame * (0.3 + random(`s${i}`) * 0.8)) % 1200;
        return <div key={i} style={{ position: "absolute", left: x, top: y < 0 ? y + 1200 : y, width: 3, height: 3, borderRadius: 3, background: i % 3 ? C.lav200 : C.mint400, opacity: 0.25 + random(`o${i}`) * 0.4 }} />;
      })}
      {children}
      {/* scanline sweep */}
      <div style={{ position: "absolute", left: 0, right: 0, height: 160, top: ((frame * 9) % 1500) - 200, background: `linear-gradient(transparent, ${C.lav400}10, transparent)`, pointerEvents: "none" }} />
      {/* vignette */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

// ─── Type ───────────────────────────────────────────────────────────────────

/** Word-by-word blur-up reveal. */
export const Kinetic: React.FC<{ text: string; delay?: number; size?: number; weight?: number; color?: string; gradientWords?: string[]; stagger?: number; style?: React.CSSProperties; align?: "center" | "left" }> = ({
  text,
  delay = 0,
  size = 96,
  weight = 500,
  color = C.white,
  gradientWords = [],
  stagger = 3,
  style,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", gap: `0 ${size * 0.26}px`, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.03, lineHeight: 1.08, color, ...style }}>
      {words.map((w, i) => {
        const t = interpolate(frame - delay - i * stagger, [0, 14], [0, 1], { ...clamp, easing: ease });
        const grad = gradientWords.includes(w.replace(/[.,!?]/g, ""));
        return (
          <span key={i} style={{ display: "inline-block", opacity: t, transform: `translateY(${(1 - t) * size * 0.5}px)`, filter: `blur(${(1 - t) * 12}px)`, ...(grad ? { backgroundImage: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } : {}) }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number; color?: string; dark?: boolean }> = ({ children, delay = 0, color = C.lav400, dark = true }) => {
  const t = useIn(delay);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 22px", borderRadius: 999, border: `1px solid ${color}55`, background: dark ? `${color}18` : `${color}22`, color, fontFamily: MONO, fontSize: 20, letterSpacing: 4, textTransform: "uppercase", opacity: t, transform: `translateY(${(1 - t) * 20}px)` }}>
      <span style={{ width: 8, height: 8, borderRadius: 8, background: color, boxShadow: `0 0 14px ${color}` }} />
      {children}
    </div>
  );
};

/** Typed-out text (dictation landing), with caret. */
export const Typed: React.FC<{ text: string; start: number; cps?: number; caret?: boolean; style?: React.CSSProperties; burst?: boolean }> = ({ text, start, cps = 40, caret = true, style, burst }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // burst: Wispr inserts whole phrases at once, not char-by-char
  let n = Math.max(0, Math.floor(((frame - start) / fps) * cps));
  if (burst) {
    const words = text.split(" ");
    const per = Math.max(1, Math.round(words.length / 6));
    const chunks = Math.floor(n / Math.max(1, (text.length / words.length) * per));
    n = words.slice(0, chunks * per).join(" ").length;
  }
  const shown = text.slice(0, n);
  const blink = Math.floor(frame / 15) % 2 === 0;
  return (
    <span style={style}>
      {shown}
      {caret && n < text.length + 1 && <span style={{ display: "inline-block", width: 3, height: "1em", verticalAlign: "-0.15em", marginLeft: 2, background: C.lav700, opacity: blink ? 1 : 0.2 }} />}
    </span>
  );
};

// ─── UI atoms (mirroring the product) ───────────────────────────────────────

export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; glass?: boolean }> = ({ children, style, glass }) => (
  <div
    style={{
      borderRadius: 40,
      background: glass ? "rgba(255,255,255,0.08)" : C.white,
      border: glass ? "1px solid rgba(255,255,255,0.14)" : "none",
      backdropFilter: glass ? "blur(20px)" : undefined,
      boxShadow: glass ? "0 30px 80px -20px rgba(0,0,0,0.6)" : "0 40px 100px -30px rgba(10,8,30,0.7), 0 0 0 1px rgba(255,255,255,0.6)",
      padding: 36,
      color: C.ink,
      fontFamily: SANS,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{ children: React.ReactNode; bg?: string; fg?: string; size?: number; style?: React.CSSProperties; mono?: boolean }> = ({ children, bg = C.lav100, fg = C.lav700, size = 20, style, mono }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: `${size * 0.35}px ${size * 0.8}px`, borderRadius: 999, background: bg, color: fg, fontSize: size, fontWeight: 500, fontFamily: mono ? MONO : SANS, whiteSpace: "nowrap", ...style }}>
    {children}
  </span>
);

/** Pops in with a spring at `delay`. */
export const Pop: React.FC<{ delay: number; children: React.ReactNode; from?: "up" | "left" | "right" | "scale"; style?: React.CSSProperties; distance?: number }> = ({ delay, children, from = "up", style, distance = 40 }) => {
  const t = useIn(delay, 16);
  const tr = from === "up" ? `translateY(${(1 - t) * distance}px)` : from === "left" ? `translateX(${(t - 1) * distance}px)` : from === "right" ? `translateX(${(1 - t) * distance}px)` : `scale(${0.6 + t * 0.4})`;
  return <div style={{ opacity: Math.min(1, t * 1.4), transform: tr, ...style }}>{children}</div>;
};

/** Gentle 3D float for hero UI panels. */
export const Tilt: React.FC<{ children: React.ReactNode; rx?: number; ry?: number; style?: React.CSSProperties }> = ({ children, rx = 8, ry = -12, style }) => {
  const frame = useCurrentFrame();
  const t = useIn(0, 22);
  return (
    <div style={{ perspective: 2200, ...style }}>
      <div style={{ transform: `rotateX(${rx * (1 - t * 0.4) + Math.sin(frame / 40) * 1.5}deg) rotateY(${ry * (1 - t * 0.3) + Math.cos(frame / 50) * 2}deg) translateZ(0) scale(${0.9 + t * 0.1})`, transformStyle: "preserve-3d", opacity: t }}>{children}</div>
    </div>
  );
};

// ─── Brand ──────────────────────────────────────────────────────────────────

export const PULSE_PATH = "M7 34 H17 L21 27 L26 43 L31 17 L36 39 L39.5 31 C44 24 48 24 51.5 31 S57.5 38 58 34";

export const Mark: React.FC<{ size?: number; draw?: number }> = ({ size = 120, draw = 1 }) => {
  const frame = useCurrentFrame();
  const tracer = (frame * 1.4) % 128;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <defs>
        <linearGradient id="mk" x1="0" x2="64" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.blush300} />
          <stop offset="0.5" stopColor={C.lav200} />
          <stop offset="1" stopColor="#b9ecd2" />
        </linearGradient>
        <filter id="mkg">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="32" fill={C.ink} />
      <path d={PULSE_PATH} stroke="url(#mk)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      {draw >= 1 && <path d={PULSE_PATH} stroke="url(#mk)" strokeWidth="5" strokeLinecap="round" fill="none" pathLength={100} strokeDasharray="28 100" strokeDashoffset={128 - tracer} filter="url(#mkg)" />}
      <circle cx="58" cy="34" r={2.4 + Math.sin(frame / 6) * 0.8 * draw} fill="#b9ecd2" opacity={draw} />
    </svg>
  );
};

export const Wordmark: React.FC<{ size?: number; color?: string }> = ({ size = 64, color = C.white }) => (
  <span style={{ fontSize: size, fontWeight: 600, letterSpacing: -size * 0.03, color }}>
    Pulse <span style={{ backgroundImage: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Flow</span>
  </span>
);

// ─── Voice ──────────────────────────────────────────────────────────────────

/** Live audio bars. `active` 0..1 scales the amplitude. */
export const Waveform: React.FC<{ bars?: number; height?: number; active?: number; color?: string; width?: number }> = ({ bars = 28, height = 60, active = 1, color = C.lav400, width = 6 }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: width * 0.7, height }}>
      {Array.from({ length: bars }).map((_, i) => {
        const a = (Math.sin(frame / 3 + i * 0.9) * 0.5 + 0.5) * (Math.sin(frame / 7 + i * 0.35) * 0.5 + 0.5);
        const h = 0.12 + a * active * 0.88;
        return <div key={i} style={{ width, height: height * h, borderRadius: width, background: color, opacity: 0.5 + h * 0.5 }} />;
      })}
    </div>
  );
};

/** A keyboard key being held (Wispr's push-to-talk). */
export const KeyCap: React.FC<{ label?: string; pressed: number; size?: number }> = ({ label = "fn", pressed, size = 140 }) => (
  <div style={{ position: "relative", width: size, height: size }}>
    <div style={{ position: "absolute", inset: 0, top: size * 0.08, borderRadius: size * 0.2, background: "#08070e" }} />
    <div
      style={{
        position: "absolute",
        inset: 0,
        bottom: size * 0.08,
        transform: `translateY(${pressed * size * 0.07}px)`,
        borderRadius: size * 0.2,
        background: `linear-gradient(180deg, #3a3655, ${C.ink2})`,
        border: `1px solid rgba(255,255,255,${0.12 + pressed * 0.3})`,
        boxShadow: `0 0 ${pressed * 60}px ${C.lav400}${pressed > 0.1 ? "aa" : "00"}, inset 0 2px 0 rgba(255,255,255,0.15)`,
        display: "grid",
        placeItems: "center",
        color: C.white,
        fontFamily: SANS,
        fontSize: size * 0.3,
        fontWeight: 500,
      }}
    >
      {label}
    </div>
  </div>
);

/** Floating "Wispr Flow" dictation HUD, like the OS-level bubble. */
export const WisprHud: React.FC<{ active: number; label?: string }> = ({ active, label = "Wispr Flow · listening" }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 18, padding: "16px 28px 16px 18px", borderRadius: 999, background: "rgba(20,18,32,0.88)", border: `1px solid ${C.lav400}66`, boxShadow: `0 0 ${40 * active}px ${C.lav400}88`, color: C.white, fontFamily: SANS }}>
    <div style={{ width: 44, height: 44, borderRadius: 44, background: GRAD, display: "grid", placeItems: "center" }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4" strokeLinecap="round">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
      </svg>
    </div>
    <Waveform bars={18} height={34} active={active} color={C.lav200} width={4} />
    <span style={{ fontSize: 22, opacity: 0.85 }}>{label}</span>
  </div>
);

/** Lavender dictation card, like DictationBox in the app. */
export const DictationCard: React.FC<{ title: string; eyebrow: string; text: string; start: number; cps?: number; width?: number; height?: number; status?: string; live?: boolean; button?: string }> = ({
  title,
  eyebrow,
  text,
  start,
  cps = 38,
  width = 900,
  height = 300,
  status = "Listening…",
  live = true,
  button = "Structure",
}) => {
  const frame = useCurrentFrame();
  const words = Math.max(0, text.slice(0, Math.floor(((frame - start) / 30) * cps)).split(/\s+/).filter(Boolean).length);
  return (
    <div style={{ width, borderRadius: 40, padding: 34, background: `linear-gradient(135deg, ${C.lav200}, #dcdafc 50%, #d6e8ff)`, boxShadow: live ? `0 0 0 5px rgba(255,255,255,0.9), 0 40px 100px -20px ${C.lav400}aa` : "0 40px 100px -30px rgba(10,8,30,0.7)", fontFamily: SANS, color: C.ink }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Pill bg="rgba(255,255,255,0.6)" fg={C.lav700} size={16} mono>
            ✦ {eyebrow}
          </Pill>
          <div style={{ fontSize: 40, marginTop: 14, letterSpacing: -1 }}>{title}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 18px 8px 8px", borderRadius: 999, background: "rgba(255,255,255,0.7)" }}>
          <div style={{ width: 38, height: 38, borderRadius: 38, background: live ? C.ink : C.lav100, display: "grid", placeItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={live ? C.white : C.lav700} strokeWidth="2.4" strokeLinecap="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
            </svg>
          </div>
          <Waveform bars={6} height={20} active={live ? 1 : 0.1} color={C.lav700} width={3} />
          <span style={{ fontSize: 16, color: live ? C.lav700 : C.slate, fontWeight: 500 }}>{status}</span>
        </div>
      </div>
      <div style={{ marginTop: 22, height, borderRadius: 28, background: "rgba(255,255,255,0.8)", padding: 26, fontSize: 27, lineHeight: 1.5, overflow: "hidden" }}>
        <Typed text={text} start={start} cps={cps} />
      </div>
      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Pill bg="rgba(255,255,255,0.6)" fg={C.slate} size={17} mono>
          {words} words
        </Pill>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 28px 8px 8px", borderRadius: 999, background: words > 3 ? C.ink : `${C.ink}55`, color: C.white, fontSize: 22, fontWeight: 500 }}>
          <span style={{ width: 44, height: 44, borderRadius: 44, background: "rgba(255,255,255,0.15)", display: "grid", placeItems: "center" }}>🎙</span>
          {button}
        </div>
      </div>
    </div>
  );
};

/** Section header used by every pillar scene: number + eyebrow + headline. */
export const PillarTitle: React.FC<{ n: string; eyebrow: string; title: string; grad?: string[]; color?: string; width?: number }> = ({ n, eyebrow, title, grad = [], color = C.lav400, width = 760 }) => (
  <div style={{ width }}>
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <span style={{ fontFamily: MONO, fontSize: 22, color: `${color}` }}>{n}</span>
      <Eyebrow color={color}>{eyebrow}</Eyebrow>
    </div>
    <div style={{ height: 26 }} />
    <Kinetic text={title} size={72} align="left" gradientWords={grad} delay={6} />
  </div>
);

export const Caption: React.FC<{ children: React.ReactNode; delay?: number; style?: React.CSSProperties }> = ({ children, delay = 20, style }) => {
  const t = useIn(delay);
  return <div style={{ fontSize: 28, lineHeight: 1.45, color: "rgba(255,255,255,0.66)", opacity: t, transform: `translateY(${(1 - t) * 16}px)`, ...style }}>{children}</div>;
};

/** Animated connector line that "draws" between two points (SVG overlay). */
export const Beam: React.FC<{ d: string; delay: number; color?: string; dur?: number }> = ({ d, delay, color = C.lav400, dur = 20 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, dur], [0, 1], { ...clamp, easing: ease });
  const pulse = ((frame - delay) % 40) / 40;
  return (
    <svg style={{ position: "absolute", inset: 0, pointerEvents: "none" }} width="1920" height="1080">
      <path d={d} stroke={color} strokeOpacity={0.35} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      {p >= 1 && <path d={d} stroke={color} strokeWidth={5} fill="none" pathLength={1} strokeDasharray="0.08 1" strokeDashoffset={-pulse} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${color})` }} />}
    </svg>
  );
};
