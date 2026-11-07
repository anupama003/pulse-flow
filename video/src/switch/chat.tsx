import React from "react";
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, MONO, SANS, Typed, WisprHud } from "../kit";

// Building blocks for the Switch film: a Telegram group as it looks on the laptop, a terminal, and
// a browser frame for real app screenshots. Every message pops in at its own frame.

export type Tone = "critical" | "ok" | "refused";

export interface Msg {
  at: number;
  from: string;
  text: string;
  agent?: boolean;
  /** Seconds on Switch's "worked for" card shown just before an agent reply. */
  worked?: number;
  tone?: Tone;
}

const NAME_COLOR: Record<string, string> = {
  "Dr. Rahul Verma": "#d6456b",
  "Dr. Priya Raghavan": "#23865b",
  "Dr. Suresh Menon": "#3b78c4",
  "Anjali Desai": "#a07800",
  "Farhan Sheikh": "#7a4bd6",
};
const TONE: Record<Tone, { bar: string; bg: string }> = {
  critical: { bar: C.blush700, bg: "#fff1f4" },
  ok: { bar: C.mint700, bg: "#effbf5" },
  refused: { bar: "#b45309", bg: "#fff8eb" },
};

const initials = (s: string) =>
  s
    .replace(/^Dr\.?\s+/, "")
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const Avatar: React.FC<{ name: string; agent?: boolean; size?: number }> = ({ name, agent, size = 40 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size,
      flexShrink: 0,
      display: "grid",
      placeItems: "center",
      fontSize: size * 0.36,
      fontWeight: 600,
      color: C.white,
      background: agent ? `linear-gradient(135deg, ${C.lav700}, ${C.blush500})` : NAME_COLOR[name] ?? C.slate,
    }}
  >
    {agent ? "AI" : initials(name)}
  </div>
);

const WorkedCard: React.FC<{ seconds: number; at: number }> = ({ seconds, at }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - at, [0, 6], [0, 1], clamp);
  const counting = Math.min(seconds, Math.max(1, Math.round(((frame - at) / 22) * seconds)));
  return (
    <div style={{ alignSelf: "flex-start", marginLeft: 52, opacity: t, display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 16px", borderRadius: 14, background: "#eef0f4", color: C.slate, fontSize: 17, fontFamily: MONO }}>
      <span style={{ width: 9, height: 9, borderRadius: 9, background: C.lav700, opacity: Math.floor(frame / 8) % 2 ? 1 : 0.35 }} />
      Switch · agent working… {counting}s
    </div>
  );
};

const Bubble: React.FC<{ m: Msg }> = ({ m }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - m.at, fps, config: { damping: 16, mass: 0.7 } });
  const tone = m.tone ? TONE[m.tone] : null;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexShrink: 0, opacity: s, transform: `translateY(${(1 - s) * 30}px) scale(${0.96 + s * 0.04})`, transformOrigin: "bottom left" }}>
      <Avatar name={m.from} agent={m.agent} />
      <div
        style={{
          maxWidth: "86%",
          padding: "11px 18px 13px",
          borderRadius: "20px 20px 20px 6px",
          background: tone ? tone.bg : C.white,
          borderLeft: tone ? `5px solid ${tone.bar}` : "none",
          boxShadow: "0 2px 0 rgba(20,18,40,0.06)",
          fontSize: 20,
          lineHeight: 1.42,
          color: C.ink,
          whiteSpace: "pre-wrap",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3, color: m.agent ? C.lav700 : NAME_COLOR[m.from] ?? C.slate, display: "flex", gap: 8, alignItems: "center" }}>
          {m.from}
          {m.agent && <span style={{ fontSize: 12, fontWeight: 600, padding: "1px 7px", borderRadius: 6, background: C.lav100, color: C.lav700 }}>agent</span>}
        </div>
        {m.text}
      </div>
    </div>
  );
};

export interface Composing {
  who: string;
  text: string;
  start: number;
  /** Frame the message is sent; the input clears. */
  sent: number;
  wispr?: boolean;
  cps?: number;
}

/** A Telegram group on the laptop: header, messages stacking from the bottom, and the input bar. */
export const ChatWindow: React.FC<{
  title: string;
  subtitle: string;
  messages: Msg[];
  composing?: Composing[];
  width?: number;
  height?: number;
  highlight?: number;
  style?: React.CSSProperties;
}> = ({ title, subtitle, messages, composing = [], width = 920, height = 900, highlight, style }) => {
  const frame = useCurrentFrame();
  const shown = messages.filter((m) => frame >= m.at);
  const working = messages.filter((m) => m.agent && m.worked && frame >= m.at - 26 && frame < m.at);
  const live = composing.find((c) => frame >= c.start && frame < c.sent);
  const glow = highlight !== undefined ? interpolate(frame - highlight, [0, 10, 50], [0, 1, 0.3], clamp) : 0;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 30,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        fontFamily: SANS,
        background: "linear-gradient(180deg, #e3ebf3, #d9e4ee)",
        boxShadow: `0 40px 120px -30px rgba(0,0,0,0.7), 0 0 0 ${2 + glow * 4}px ${glow > 0.05 ? C.blush500 : "rgba(255,255,255,0.12)"}`,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", background: C.white, borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: 7, marginRight: 6 }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <span key={c} style={{ width: 13, height: 13, borderRadius: 13, background: c }} />
          ))}
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 46, background: `linear-gradient(135deg, #4aa3e8, ${C.lav700})`, display: "grid", placeItems: "center", color: C.white, fontWeight: 600, fontSize: 18 }}>{initials(title)}</div>
        <div>
          <div style={{ fontSize: 23, fontWeight: 600, color: C.ink }}>{title}</div>
          <div style={{ fontSize: 16, color: C.slate }}>{subtitle}</div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 14, letterSpacing: 2, color: "#4aa3e8" }}>TELEGRAM</div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 14, padding: "18px 22px", overflow: "hidden" }}>
        {shown.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {working.map((m, i) => (
          <WorkedCard key={`w${i}`} seconds={m.worked!} at={m.at - 26} />
        ))}
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", background: C.white, borderTop: "1px solid #e5e7eb", minHeight: 80 }}>
        {live?.wispr && (
          <div style={{ position: "absolute", left: "50%", bottom: "100%", transform: "translate(-50%, -16px) scale(0.78)", transformOrigin: "bottom center" }}>
            <WisprHud active={1} label={`Wispr Flow · ${live.who}`} />
          </div>
        )}
        <div style={{ flex: 1, fontSize: 19, lineHeight: 1.4, color: live ? C.ink : "#9aa1ad", maxHeight: 108, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          {live ? <Typed text={live.text} start={live.start} cps={live.cps ?? (live.wispr ? 75 : 30)} burst={live.wispr} /> : "Write a message…"}
        </div>
        {live && <span style={{ fontSize: 14, fontFamily: MONO, color: C.slate, whiteSpace: "nowrap" }}>{live.who}</span>}
        <div style={{ width: 46, height: 46, borderRadius: 46, background: live ? "#4aa3e8" : "#e5e7eb", display: "grid", placeItems: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill={live ? C.white : "#9aa1ad"}>
            <path d="M3 20.5 21 12 3 3.5l2.4 7.1L15 12l-9.6 1.4z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export interface TermLine {
  at: number;
  text: string;
  cmd?: boolean;
  color?: string;
}

/** A macOS terminal: commands type in, output lines appear. */
export const Terminal: React.FC<{ lines: TermLine[]; title?: string; width?: number; height?: number; style?: React.CSSProperties }> = ({ lines, title = "pulse-flow — zsh", width = 820, height = 420, style }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ width, height, borderRadius: 22, overflow: "hidden", background: "#15131f", boxShadow: "0 40px 120px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08)", fontFamily: MONO, ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", background: "#211e2e", color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 12, background: c }} />
        ))}
        <span style={{ marginLeft: 12 }}>{title}</span>
      </div>
      <div style={{ padding: "18px 22px", fontSize: 19, lineHeight: 1.6, color: "#e7e5f5" }}>
        {lines
          .filter((l) => frame >= l.at)
          .map((l, i) =>
            l.cmd ? (
              <div key={i}>
                <span style={{ color: C.mint400 }}>➜ </span>
                <span style={{ color: C.lav400 }}>flow </span>
                <Typed text={l.text} start={l.at} cps={36} caret={false} />
              </div>
            ) : (
              <div key={i} style={{ color: l.color ?? "rgba(231,229,245,0.72)", whiteSpace: "pre-wrap" }}>
                {l.text}
              </div>
            ),
          )}
        {Math.floor(frame / 15) % 2 === 0 && <span style={{ display: "inline-block", width: 11, height: 22, background: C.lav400, verticalAlign: "-4px" }} />}
      </div>
    </div>
  );
};

/** A real app screenshot in a browser-style window, with a slow push-in. */
export const AppWindow: React.FC<{ src: string; url: string; width?: number; zoomTo?: number; dur?: number; origin?: string; style?: React.CSSProperties }> = ({
  src,
  url,
  width = 1240,
  zoomTo = 1.06,
  dur = 240,
  origin = "50% 30%",
  style,
}) => {
  const frame = useCurrentFrame();
  const z = interpolate(frame, [0, dur], [1, zoomTo], clamp);
  return (
    <div style={{ width, borderRadius: 22, overflow: "hidden", background: C.white, boxShadow: "0 50px 140px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", background: "#f1f0f6" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 12, background: c }} />
        ))}
        <div style={{ marginLeft: 16, flex: 1, padding: "6px 16px", borderRadius: 10, background: C.white, fontFamily: MONO, fontSize: 15, color: C.slate }}>{url}</div>
      </div>
      <div style={{ overflow: "hidden" }}>
        <Img src={staticFile(src)} style={{ width: "100%", display: "block", transform: `scale(${z})`, transformOrigin: origin }} />
      </div>
    </div>
  );
};

/** Floating label that says what just happened. */
export const Callout: React.FC<{ at: number; children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ at, children, color = C.lav400, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 15 } });
  return (
    <div style={{ position: "absolute", opacity: s, transform: `translateY(${(1 - s) * 18}px)`, display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 24px", borderRadius: 999, background: "rgba(20,18,32,0.88)", border: `1px solid ${color}88`, color: C.white, fontFamily: SANS, fontSize: 24, boxShadow: `0 0 30px ${color}55`, whiteSpace: "nowrap", ...style }}>
      <span style={{ width: 10, height: 10, borderRadius: 10, background: color, boxShadow: `0 0 12px ${color}` }} />
      {children}
    </div>
  );
};

/** Scene heading at the top-left: number, eyebrow and title. */
export const SceneTitle: React.FC<{ n: string; eyebrow: string; title: string; color?: string }> = ({ n, eyebrow, title, color = C.lav400 }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [4, 22], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: 90, top: 70, opacity: t, transform: `translateX(${(1 - t) * -30}px)`, fontFamily: SANS, color: C.white, width: 640 }}>
      <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 5, color, textTransform: "uppercase" }}>
        {n} · {eyebrow}
      </div>
      <div style={{ fontSize: 54, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1.08, marginTop: 14 }}>{title}</div>
    </div>
  );
};
