import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Beam, C, Caption, Card, MONO, Pill, PillarTitle, Pop, Stage, Typed, clamp, ease, useIn } from "../kit";

const SbarRow: React.FC<{ k: string; text: string; delay: number; color: string; bg: string }> = ({ k, text, delay, color, bg }) => (
  <Pop delay={delay} from="right" distance={60}>
    <div style={{ display: "flex", gap: 18, alignItems: "flex-start", padding: "14px 0", borderBottom: `1px solid ${C.canvas}` }}>
      <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 46, background: bg, color, display: "grid", placeItems: "center", fontWeight: 600, fontSize: 22 }}>{k}</span>
      <span style={{ fontSize: 24, lineHeight: 1.4, paddingTop: 6 }}>{text}</span>
    </div>
  </Pop>
);

/** 4. Ward handover → SBAR, with the rules engine escalating a "stable" patient. */
export const Handover: React.FC = () => {
  const frame = useCurrentFrame();
  const scan = interpolate(frame, [70, 110], [0, 1], { ...clamp, easing: ease });
  const crit = useIn(150);
  return (
    <Stage hue="blush">
      <AbsoluteFill style={{ padding: "90px 110px" }}>
        <PillarTitle n="01" eyebrow="Ward handover" title="A 3 AM brain dump becomes clean SBAR." grad={["SBAR."]} width={1100} />
        <div style={{ display: "flex", gap: 60, marginTop: 50, alignItems: "flex-start" }}>
          <Pop delay={14} from="left" distance={80}>
            <Card glass style={{ width: 640, color: "white", padding: 34 }}>
              <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 3, color: C.lav200, marginBottom: 16 }}>RAW DICTATION · WISPR</div>
              <div style={{ fontSize: 25, lineHeight: 1.55, color: "rgba(255,255,255,0.88)", position: "relative" }}>
                <Typed text="Vikram in ICU-2 is stable, BP 88 by 58, pulse 132, sats 89 percent, lactate 5.2… gave ibuprofen for the fever, uh, no, paracetamol. Repeat ABG and lactate, call ICU registrar if MAP under 65." start={16} cps={60} burst />
                <div style={{ position: "absolute", left: -10, right: -10, top: `${scan * 100}%`, height: 4, background: C.lav400, boxShadow: `0 0 30px ${C.lav400}`, opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
                <Pop delay={112}><Pill bg={`${C.lav400}33`} fg={C.lav200} mono size={17}>LLM → schema-locked JSON</Pill></Pop>
                <Pop delay={120}><Pill bg={`${C.mint400}33`} fg={C.mint400} mono size={17}>+ deterministic vitals rules</Pill></Pop>
              </div>
            </Card>
          </Pop>
          <Beam d="M 770 560 C 830 560 820 520 880 520" delay={100} />
          <div style={{ position: "relative" }}>
            <Pop delay={104} from="right" distance={100}>
              <Card style={{ width: 880, padding: 34, boxShadow: crit > 0.5 ? `0 0 0 4px ${C.blush300}, 0 40px 100px -20px ${C.blush500}88` : undefined }}>
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <span style={{ width: 64, height: 64, borderRadius: 64, background: C.blush100, color: C.blush700, display: "grid", placeItems: "center", fontWeight: 600, fontSize: 20 }}>ICU-2</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 32, fontWeight: 500 }}>Vikram Singh</div>
                    <div style={{ fontSize: 18, color: C.slate }}>58 yrs · urosepsis</div>
                  </div>
                  <div style={{ transform: `scale(${0.6 + crit * 0.4})`, opacity: crit }}>
                    <Pill bg={C.blush100} fg={C.blush700} size={22}>● Critical</Pill>
                  </div>
                </div>
                <SbarRow k="S" text="Hypotensive and tachycardic overnight; dictated as “stable”." delay={118} bg={C.lav100} color={C.lav700} />
                <SbarRow k="B" text="Urosepsis, day 2 of IV antibiotics." delay={126} bg={C.powder100} color={C.powder700} />
                <SbarRow k="A" text="Likely septic shock: lactate 5.2, MAP < 65." delay={134} bg={C.butter100} color={C.butter700} />
                <SbarRow k="R" text="Repeat ABG + lactate · ICU registrar if MAP < 65." delay={142} bg={C.mint100} color={C.mint700} />
                <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap", opacity: crit }}>
                  {["BP 88/58", "HR 132", "SpO₂ 89%", "Lactate 5.2"].map((r, i) => (
                    <Pop key={r} delay={156 + i * 4}><Pill bg={C.blush100} fg={C.blush700} size={18} mono>{r}</Pill></Pop>
                  ))}
                </div>
                <Pop delay={176}>
                  <div style={{ marginTop: 16, padding: "14px 20px", borderRadius: 20, background: C.lav50, fontSize: 21, display: "flex", gap: 14, alignItems: "center" }}>
                    <span style={{ color: C.lav700, fontWeight: 600 }}>Correction</span>
                    <span style={{ textDecoration: "line-through", color: C.slate }}>Gave ibuprofen</span>→<span style={{ fontWeight: 500 }}>paracetamol</span>
                  </div>
                </Pop>
              </Card>
            </Pop>
            <Pop delay={190} from="scale" style={{ position: "absolute", right: -30, top: -40 }}>
              <Pill bg={C.ink} fg="white" size={20}>⚡ Auto-escalated by vitals check</Pill>
            </Pop>
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/** 5. Human in the loop: nothing reaches the chart without approval. */
export const Approve: React.FC = () => {
  const frame = useCurrentFrame();
  const click = interpolate(frame, [70, 76, 82], [1, 0.92, 1], clamp);
  const fly = interpolate(frame, [84, 120], [0, 1], { ...clamp, easing: ease });
  const tasks = ["Repeat ABG and lactate", "ICU registrar review", "Hourly urine output charting", "If MAP < 65: call ICU registrar"];
  return (
    <Stage hue="mint">
      <AbsoluteFill style={{ padding: "90px 110px", flexDirection: "row", gap: 70, alignItems: "center" }}>
        <div style={{ width: 620 }}>
          <PillarTitle n="02" eyebrow="Human in the loop" title="AI drafts. Doctors approve." grad={["approve."]} color={C.mint400} width={620} />
          <div style={{ height: 30 }} />
          <Caption>Every draft waits in an approval queue with its uncertainties shown in butter and missing sections marked Pending. One click turns it into chart entries and checklist tasks, signed with a name.</Caption>
        </div>
        <div style={{ position: "relative", width: 1000, height: 760 }}>
          <Pop delay={6} from="up">
            <Card style={{ width: 560, padding: 30, opacity: 1 - fly * 0.4, transform: `scale(${1 - fly * 0.06})` }}>
              <div style={{ fontFamily: MONO, fontSize: 16, color: C.slate, letterSpacing: 2 }}>AWAITING APPROVAL · P-4 AARAV</div>
              <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 18, background: C.butter100, color: C.butter700, fontSize: 20 }}>? “Fever since evening”: duration unclear</div>
                <div style={{ padding: 14, borderRadius: 18, border: `2px dashed ${C.lav200}`, color: C.slate, fontSize: 20 }}>Assessment · <b style={{ color: C.lav700 }}>Pending</b></div>
                <div style={{ padding: 14, borderRadius: 18, background: C.mint100, color: C.mint700, fontSize: 20 }}>✓ Added by you: Recommendation</div>
              </div>
              <div style={{ marginTop: 22, display: "flex", gap: 12 }}>
                <div style={{ transform: `scale(${click})`, padding: "14px 26px", borderRadius: 999, background: C.ink, color: "white", fontSize: 21, fontWeight: 500, boxShadow: frame > 70 ? `0 0 40px ${C.mint400}` : undefined }}>Approve with edits</div>
                <div style={{ padding: "14px 22px", borderRadius: 999, background: C.canvas, color: C.slate, fontSize: 21 }}>Discard</div>
              </div>
            </Card>
          </Pop>
          <div style={{ position: "absolute", right: 0, top: 120 }}>
            <Pop delay={30} from="right">
              <Card style={{ width: 460, padding: 28 }}>
                <div style={{ fontSize: 26, fontWeight: 500 }}>Ward checklist</div>
                <div style={{ fontSize: 17, color: C.slate, marginBottom: 10 }}>{Math.round(fly * 4)} new tasks</div>
                {tasks.map((t, i) => {
                  const d = 90 + i * 8;
                  const s = interpolate(frame, [d, d + 12], [0, 1], { ...clamp, easing: ease });
                  const done = i === 0 && frame > 150;
                  return (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", opacity: s, transform: `translateX(${(1 - s) * -200}px)`, borderBottom: `1px solid ${C.canvas}` }}>
                      <span style={{ width: 30, height: 30, borderRadius: 10, background: done ? C.mint400 : C.canvas, color: "white", display: "grid", placeItems: "center", fontSize: 18 }}>{done ? "✓" : ""}</span>
                      <span style={{ fontSize: 20, textDecoration: done ? "line-through" : "none", color: done ? C.slate : C.ink }}>{t}</span>
                    </div>
                  );
                })}
                {frame > 150 && <Pop delay={150}><div style={{ marginTop: 10, fontSize: 16, color: C.mint700 }}>✓ Dr. Priya Raghavan · 08:12</div></Pop>}
              </Card>
            </Pop>
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

/** 6. Live rounds: the consultant's orders diffed into the care plan. */
export const Rounds: React.FC = () => {
  const frame = useCurrentFrame();
  const lock = interpolate(frame, [150, 165], [0, 1], { ...clamp, easing: ease });
  const orders: [string, "-" | "+", number][] = [
    ["IV ceftriaxone 1 g BD", "-", 80],
    ["Pip-taz 4.5 g IV q8h", "+", 90],
    ["Repeat echo today", "+", 100],
    ["Nephrology consult if creatinine ↑ tomorrow", "+", 110],
    ["Daily weights", "-", 120],
  ];
  return (
    <Stage hue="powder">
      <AbsoluteFill style={{ padding: "90px 110px" }}>
        <PillarTitle n="03" eyebrow="Consultant live rounds" title="Rapid-fire orders, merged into the plan." grad={["merged"]} color="#7fb2f0" width={1300} />
        <div style={{ display: "flex", gap: 50, marginTop: 50 }}>
          <Pop delay={10} from="left">
            <Card glass style={{ width: 700, color: "white" }}>
              <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: 3, color: "#a9cdf7" }}>DR. MENON · BED 12 · ARJUN</div>
              <div style={{ marginTop: 18, fontSize: 30, lineHeight: 1.5, fontStyle: "italic" }}>
                “<Typed text="Stop the ceftriaxone, start pip-taz. Repeat echo. If creatinine's still up tomorrow, nephro consult. Drop daily weights." start={14} cps={45} burst />”
              </div>
            </Card>
          </Pop>
          <Pop delay={70} from="right">
            <Card style={{ width: 820 }}>
              <div style={{ fontSize: 28, fontWeight: 500, marginBottom: 12 }}>Care-plan diff</div>
              {orders.map(([t, s, d]) => (
                <Pop key={t} delay={d} from="right" distance={50}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 18px", marginBottom: 10, borderRadius: 18, background: s === "+" ? C.mint100 : C.blush100, color: s === "+" ? C.mint700 : C.blush700, fontSize: 23 }}>
                    <b style={{ fontSize: 26 }}>{s === "+" ? "⊕" : "⊖"}</b>
                    <span style={{ textDecoration: s === "-" ? "line-through" : "none" }}>{t}</span>
                  </div>
                </Pop>
              ))}
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ padding: "14px 26px", borderRadius: 999, background: lock > 0.5 ? C.ink : `${C.ink}44`, color: "white", fontSize: 21, fontWeight: 500 }}>{lock > 0.5 ? "🔓 Consultant sign-off" : "🔒 Consultant sign-off"}</div>
                <span style={{ fontSize: 19, color: C.slate, opacity: 1 - lock * 0.3 }}>{lock > 0.5 ? "Signed by Dr. Menon" : "PGs draft · only consultants approve"}</span>
              </div>
            </Card>
          </Pop>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
