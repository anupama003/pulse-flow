import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, Caption, DictationCard, Eyebrow, GRAD, KeyCap, Kinetic, Mark, MONO, Stage, WisprHud, Wordmark, clamp, ease, useIn } from "../kit";

/** 1. Hook: "Typed." gets struck through and becomes "Spoken." */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const strike = interpolate(frame, [58, 72], [0, 1], { ...clamp, easing: ease });
  const swap = interpolate(frame, [74, 90], [0, 1], { ...clamp, easing: ease });
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30 }}>
        <Eyebrow color={C.blush500}>Every shift · every ward · every OPD</Eyebrow>
        <Kinetic text="Every handover. Every prescription." size={92} delay={6} />
        <div style={{ position: "relative", height: 130, width: 900, display: "grid", placeItems: "center" }}>
          <div style={{ position: "absolute", fontSize: 120, fontWeight: 600, letterSpacing: -4, color: "rgba(255,255,255,0.85)", opacity: 1 - swap, transform: `translateY(${-swap * 40}px)`, filter: `blur(${swap * 10}px)` }}>
            <Kinetic text="Typed." size={120} weight={600} delay={30} />
            <div style={{ position: "absolute", left: -20, right: -20, top: "52%", height: 10, borderRadius: 10, background: C.blush500, transform: `scaleX(${strike})`, transformOrigin: "left", boxShadow: `0 0 30px ${C.blush500}` }} />
          </div>
          <div style={{ position: "absolute", fontSize: 140, fontWeight: 700, letterSpacing: -5, opacity: swap, transform: `scale(${0.7 + swap * 0.3})`, backgroundImage: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", filter: `drop-shadow(0 0 40px ${C.lav400}88)` }}>Spoken.</div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/** 2. Logo reveal. */
export const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [4, 40], [0, 1], { ...clamp, easing: ease });
  const t = useIn(0, 14);
  const word = useIn(26);
  const ring = (k: number) => interpolate((frame - k * 14) % 60, [0, 60], [0, 1]);
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 40 }}>
        <div style={{ position: "relative", transform: `scale(${0.5 + t * 0.5})`, opacity: t }}>
          {[0, 1, 2].map((k) => (
            <div key={k} style={{ position: "absolute", left: "50%", top: "50%", width: 240, height: 240, borderRadius: "50%", border: `2px solid ${C.lav400}`, transform: `translate(-50%,-50%) scale(${1 + ring(k) * 1.8})`, opacity: (1 - ring(k)) * 0.5 * (frame > 40 ? 1 : 0) }} />
          ))}
          <div style={{ borderRadius: "50%", boxShadow: `0 0 120px ${C.lav400}66`, padding: 8, background: "rgba(255,255,255,0.06)" }}>
            <Mark size={220} draw={draw} />
          </div>
        </div>
        <div style={{ opacity: word, transform: `translateY(${(1 - word) * 30}px)`, textAlign: "center" }}>
          <Wordmark size={120} />
          <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 26, letterSpacing: 8, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>The voice-first hospital OS</div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/** 3. Wispr: hold one key, speak, and text lands in the focused box. */
export const Wispr: React.FC = () => {
  const frame = useCurrentFrame();
  const pressed = interpolate(frame, [30, 38, 170, 178], [0, 1, 1, 0], clamp);
  const hud = useIn(36);
  const card = useIn(10, 20);
  const text = "Bed ICU-2, Vikram Singh, 58, urosepsis. BP 88 over 58, heart rate 132, sats 89 on 4 litres, lactate 5.2. Gave 1 litre bolus, started noradrenaline…";
  return (
    <Stage hue="lav">
      <AbsoluteFill style={{ padding: "110px 130px", flexDirection: "row", alignItems: "center", gap: 90 }}>
        <div style={{ width: 640 }}>
          <Eyebrow>Powered by Wispr Flow</Eyebrow>
          <div style={{ height: 30 }} />
          <Kinetic text="Hold one key. Just talk." size={86} align="left" gradientWords={["talk."]} delay={4} />
          <div style={{ height: 30 }} />
          <Caption delay={24}>Wispr Flow turns speech into text in any app. Pulse Flow is built around it: every module opens with a dictation box that is already focused, so a doctor never touches a keyboard.</Caption>
          <div style={{ display: "flex", alignItems: "center", gap: 40, marginTop: 50 }}>
            <KeyCap pressed={pressed} size={130} />
            <div style={{ opacity: hud, transform: `translateX(${(1 - hud) * -30}px)` }}>
              <WisprHud active={pressed} label={pressed > 0.5 ? "Listening…" : "Released · inserting"} />
            </div>
          </div>
        </div>
        <div style={{ opacity: card, transform: `perspective(2000px) rotateY(${(1 - card) * -25 - 6}deg) translateX(${(1 - card) * 120}px)` }}>
          <DictationCard eyebrow="Shift brain dump" title="Speak your handover" text={text} start={46} cps={34} width={860} height={300} live={pressed > 0.5 || (frame > 46 && frame < 190)} status={pressed > 0.5 ? "Listening…" : "Receiving text…"} button="Structure handover" />
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
