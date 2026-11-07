import React from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, clamp, DictationCard, Eyebrow, GRAD, KeyCap, Kinetic, Mark, MONO, SANS, Stage } from "../kit";
import { AppWindow, Callout, ChatWindow, SceneTitle, Terminal, type Msg } from "./chat";
import { ANJALI, L, MENON, PF, RAHUL } from "./script";

// Ten scenes, each a self-contained story beat. Frame numbers are local to the scene.

const RIGHT: React.CSSProperties = { position: "absolute", right: 80, top: 70 };
const LEFT_BOTTOM: React.CSSProperties = { position: "absolute", left: 90, bottom: 80 };
const WARD = { title: "Lotus Ward", subtitle: "Dr. Rahul, Dr. Menon · 2 agents" };
const ESC = { title: "Lotus Escalations", subtitle: "Consultants · Pulse Flow alerts" };

const agent = (at: number, from: string, text: string, worked?: number, tone?: Msg["tone"]): Msg => ({ at, from, text, agent: true, worked, tone });
const human = (at: number, from: string, text: string): Msg => ({ at, from, text });

/** The fn key held down while Wispr Flow listens. */
const WisprKey: React.FC<{ from: number; to: number; style?: React.CSSProperties; label?: string }> = ({ from, to, style, label = "Hold fn · speak" }) => {
  const frame = useCurrentFrame();
  const vis = interpolate(frame, [from - 10, from, to, to + 12], [0, 1, 1, 0], clamp);
  const pressed = interpolate(frame, [from, from + 6, to - 6, to], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", display: "flex", alignItems: "center", gap: 28, opacity: vis, ...style }}>
      <KeyCap pressed={pressed} size={120} label="fn" />
      <div style={{ fontFamily: SANS, color: C.white }}>
        <div style={{ fontSize: 30, fontWeight: 500 }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: 3, color: C.lav400, marginTop: 6 }}>WISPR FLOW → TELEGRAM</div>
      </div>
    </div>
  );
};

/** A window that slides in at `at`. */
const SlideIn: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; from?: "left" | "right" | "up" }> = ({ at, children, style, from = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 18 } });
  const d = (1 - s) * 80;
  const t = from === "left" ? `translateX(${-d}px)` : from === "right" ? `translateX(${d}px)` : `translateY(${d}px)`;
  return <div style={{ position: "absolute", opacity: s, transform: t, ...style }}>{children}</div>;
};

// ─── 1. Open ────────────────────────────────────────────────────────────────
export const Open: React.FC = () => {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [62, 74], [1, 0], clamp);
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
        <Mark size={130} draw={interpolate(frame, [0, 40], [0, 1], clamp)} />
        <Eyebrow delay={10}>Pulse Flow × Switch</Eyebrow>
        <div style={{ height: 230, display: "grid", placeItems: "center" }}>
          {frame < 74 ? (
            <div style={{ opacity: out }}>
              <Kinetic text="Hospitals already run on chat groups." delay={14} size={92} />
            </div>
          ) : (
            <Kinetic text="Now the group follows up for you." delay={76} size={96} gradientWords={["follows", "up"]} />
          )}
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

// ─── 2. The groups ──────────────────────────────────────────────────────────
const GROUPS = [
  { name: "Lotus Ward", agent: "lotus-ward-scribe · lotus-ward-coordinator", job: "Handovers, rounds, approvals, late tasks", people: [RAHUL, MENON], color: C.lav400 },
  { name: "Lotus Escalations", agent: "lotus-ward-coordinator · Pulse Flow", job: "Critical patients and anything still not done", people: [MENON], color: C.blush500 },
  { name: "Lotus OPD Desk", agent: "lotus-opd-desk", job: "Walk-ins, tokens, red flags", people: [ANJALI], color: "#f2c94c" },
  { name: "Lotus Pharmacy & Lab", agent: "lotus-fulfilment", job: "Signed prescriptions, orders moved by chat", people: [ANJALI], color: C.mint400 },
];
export const Groups: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Stage hue="powder">
      <div style={{ position: "absolute", top: 90, width: "100%", textAlign: "center" }}>
        <Kinetic text="Four Telegram groups. Four agents." size={72} gradientWords={["agents."]} />
        <div style={{ marginTop: 18, fontFamily: SANS, fontSize: 28, color: "rgba(255,255,255,0.65)", opacity: interpolate(frame, [20, 34], [0, 1], clamp) }}>Brought into the chat by Switch. Each one acts for the person who asked.</div>
      </div>
      <div style={{ position: "absolute", left: 170, right: 170, top: 330, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34 }}>
        {GROUPS.map((g, i) => {
          const s = spring({ frame: frame - 30 - i * 9, fps, config: { damping: 16 } });
          return (
            <div key={g.name} style={{ opacity: s, transform: `translateY(${(1 - s) * 40}px)`, padding: "28px 34px", borderRadius: 28, background: "rgba(255,255,255,0.06)", border: `1px solid ${g.color}55`, fontFamily: SANS, color: C.white }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 54, height: 54, borderRadius: 54, background: `linear-gradient(135deg, #4aa3e8, ${C.lav700})`, display: "grid", placeItems: "center", fontWeight: 600, fontSize: 20 }}>{g.name.split(" ")[1][0]}</div>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 500 }}>{g.name}</div>
                  <div style={{ fontSize: 20, color: "rgba(255,255,255,0.6)" }}>{g.job}</div>
                </div>
              </div>
              <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", gap: 10 }}>
                <span style={{ padding: "6px 14px", borderRadius: 999, background: `${g.color}22`, color: g.color, fontFamily: MONO, fontSize: 16 }}>@{g.agent}</span>
                {g.people.map((p) => (
                  <span key={p} style={{ padding: "6px 14px", borderRadius: 999, background: "rgba(255,255,255,0.08)", fontSize: 17 }}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

// ─── 3. Handover ────────────────────────────────────────────────────────────
export const Handover: React.FC = () => (
  <Stage>
    <SceneTitle n="01" eyebrow="Night to day handover" title="Dr. Rahul speaks the handover into the ward group." />
    <WisprKey from={40} to={180} style={{ left: 90, top: 340 }} />
    <Callout at={295} color={C.blush500} style={{ left: 90, top: 330 }}>
      The vitals rule overrides “stable”
    </Callout>
    <Callout at={360} color={C.lav400} style={{ left: 90, top: 410 }}>
      Dr. Menon sees it in Escalations
    </Callout>
    <SlideIn at={300} style={{ ...LEFT_BOTTOM }}>
      <ChatWindow {...ESC} width={760} height={420} messages={[agent(312, PF, L.critAlert, undefined, "critical"), agent(370, "lotus-ward-scribe", L.scribeEsc, 8)]} highlight={312} />
    </SlideIn>
    <ChatWindow
      {...WARD}
      style={RIGHT}
      width={900}
      height={940}
      composing={[{ who: RAHUL, text: L.handover, start: 40, sent: 180, wispr: true }]}
      messages={[
        human(180, RAHUL, L.handover),
        agent(215, "lotus-ward-scribe", L.scribeStructuring),
        agent(290, "lotus-ward-scribe", L.draft21, 14, "critical"),
        agent(318, "lotus-ward-scribe", L.draft7),
      ]}
    />
  </Stage>
);

// ─── 4. Follow-up ───────────────────────────────────────────────────────────
export const FollowUp: React.FC = () => (
  <Stage hue="blush">
    <SceneTitle n="02" eyebrow="The coordinator follows up" title="A late test is chased. If nobody acts, the consultant hears." color={C.blush500} />
    <SlideIn at={6} style={{ left: 90, top: 300 }}>
      <Terminal
        width={760}
        height={330}
        lines={[
          { at: 14, text: "npm run switch:nudge -- --at 07:00", cmd: true },
          { at: 50, text: "Simulating a check at 07:00 IST." },
          { at: 64, text: "Lotus Ridge Hospital: 1 item(s) → #ward (sent)", color: C.mint400 },
          { at: 250, text: "npm run switch:nudge -- --at 08:00", cmd: true },
          { at: 286, text: "Simulating a check at 08:00 IST." },
          { at: 300, text: "Lotus Ridge Hospital: 1 item(s) → #ward (sent)", color: C.mint400 },
        ]}
      />
    </SlideIn>
    <Callout at={200} color="#f2c94c" style={{ left: 90, top: 615 }}>
      07:00 → 08:00 · no reply from Dr. Rahul
    </Callout>
    <SlideIn at={320} style={{ ...LEFT_BOTTOM, bottom: 60 }}>
      <ChatWindow {...ESC} width={760} height={330} messages={[agent(352, "lotus-ward-coordinator", L.escalate, 14, "critical")]} highlight={352} />
    </SlideIn>
    <ChatWindow
      {...WARD}
      style={RIGHT}
      width={900}
      height={940}
      composing={[{ who: RAHUL, text: L.rahulDone, start: 420, sent: 470 }]}
      messages={[
        agent(-1, "lotus-ward-scribe", L.draft7),
        agent(70, PF, L.nudge0700),
        agent(140, "lotus-ward-coordinator", L.remind, 8),
        agent(305, PF, L.nudge0800),
        human(470, RAHUL, L.rahulDone),
        agent(530, "lotus-ward-coordinator", L.coordDone, 5, "ok"),
      ]}
    />
  </Stage>
);

// ─── 5. Rounds ──────────────────────────────────────────────────────────────
export const Rounds: React.FC = () => (
  <Stage hue="powder">
    <SceneTitle n="03" eyebrow="Consultant rounds" title="Dr. Menon dictates rounds. Only he can approve the plan." color="#7fb2f0" />
    <WisprKey from={30} to={140} style={{ left: 90, top: 340 }} label="Dr. Menon · hold fn" />
    <Callout at={230} color={C.lav400} style={{ left: 90, top: 330 }}>
      New tasks added, the registrar call stopped
    </Callout>
    <Callout at={365} color="#f2c94c" style={{ left: 90, top: 410 }}>
      A PG can’t approve the consultant’s plan
    </Callout>
    <Callout at={475} color={C.mint400} style={{ left: 90, top: 490 }}>
      Approved: the ward’s tasks update
    </Callout>
    <ChatWindow
      {...WARD}
      style={RIGHT}
      width={900}
      height={940}
      composing={[
        { who: MENON, text: L.rounds, start: 30, sent: 140, wispr: true },
        { who: RAHUL, text: L.rahulApprove, start: 280, sent: 312 },
        { who: MENON, text: L.menonApprove, start: 400, sent: 430 },
      ]}
      messages={[
        human(140, MENON, L.rounds),
        agent(225, "lotus-ward-scribe", L.roundsPlan, 12),
        human(312, RAHUL, L.rahulApprove),
        agent(362, "lotus-ward-scribe", L.refused, 5, "refused"),
        human(430, MENON, L.menonApprove),
        agent(472, "lotus-ward-scribe", L.roundsApproved, 6, "ok"),
      ]}
    />
  </Stage>
);

// ─── 6. Walk-in ─────────────────────────────────────────────────────────────
export const WalkIn: React.FC = () => (
  <Stage hue="mint">
    <SceneTitle n="04" eyebrow="OPD front desk" title="The counter types the way it talks. The record comes out clean." color={C.mint400} />
    <Callout at={250} color={C.blush500} style={{ left: 90, top: 330 }}>
      Red flag found by Pulse Flow, not typed
    </Callout>
    <SlideIn at={262} style={{ ...LEFT_BOTTOM }}>
      <ChatWindow {...ESC} width={760} height={420} messages={[agent(280, PF, L.emergency, undefined, "critical"), agent(330, "lotus-opd-desk", L.opdEsc, 6)]} highlight={280} />
    </SlideIn>
    <ChatWindow
      title="Lotus OPD Desk"
      subtitle="Front desk · 1 agent"
      style={RIGHT}
      width={900}
      height={940}
      composing={[{ who: ANJALI, text: L.walkIn, start: 30, sent: 165, cps: 34 }]}
      messages={[human(165, ANJALI, L.walkIn), agent(240, "lotus-opd-desk", L.token, 10, "ok")]}
    />
  </Stage>
);

// ─── 7. Prescription → pharmacy ─────────────────────────────────────────────
const Stamp: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - at, fps, config: { damping: 11, mass: 0.6 } });
  return (
    <div style={{ position: "absolute", left: 150, top: 760, opacity: s, transform: `rotate(-8deg) scale(${1.6 - s * 0.6})`, padding: "14px 26px", borderRadius: 18, border: `4px solid ${C.mint400}`, color: C.mint400, fontFamily: MONO, fontSize: 26, fontWeight: 500, background: "rgba(10,20,15,0.6)" }}>
      SIGNED · HPR 71-0000-0000-0001
    </div>
  );
};
export const Pharmacy: React.FC = () => (
  <Stage hue="mint">
    <SceneTitle n="05" eyebrow="OPD to pharmacy" title="Signed in OPD, moved along in chat." color={C.mint400} />
    <div style={{ position: "absolute", left: 90, top: 340, transform: "scale(0.8)", transformOrigin: "top left" }}>
      <DictationCard eyebrow="OPD E-PRESCRIPTION · GEN-002" title="Dictate the prescription" text={L.rxDictation} start={20} cps={60} width={900} height={210} status="Wispr Flow" button="Sign with HPR" />
    </div>
    <Stamp at={175} />
    <ChatWindow
      title="Lotus Pharmacy & Lab"
      subtitle="Pharmacy · lab · 1 agent"
      style={RIGHT}
      width={900}
      height={940}
      composing={[
        { who: ANJALI, text: L.anjaliPreparing, start: 250, sent: 285 },
        { who: ANJALI, text: L.anjaliReady, start: 375, sent: 425 },
      ]}
      messages={[
        agent(205, PF, L.rxSigned, undefined, "ok"),
        human(285, ANJALI, L.anjaliPreparing),
        agent(338, "lotus-fulfilment", L.preparingOk, 5),
        human(425, ANJALI, L.anjaliReady),
        agent(478, "lotus-fulfilment", L.readyOk, 5, "ok"),
      ]}
    />
  </Stage>
);

// ─── 8–9. The web app ───────────────────────────────────────────────────────
interface Shot {
  src: string;
  where: string;
  label: string;
  origin?: string;
}
const WARD_SHOTS: Shot[] = [
  { src: "app/ward-handover.png", where: "Ward · Handover", label: "Speak the handover with Wispr Flow" },
  { src: "app/ward-approve.png", where: "Ward · To approve", label: "Drafts wait for a doctor's approval", origin: "50% 60%" },
  { src: "app/ward-patients.png", where: "Ward · Patients", label: "Critical patients first" },
  { src: "app/ward-rounds.png", where: "Ward · Live rounds", label: "Consultant orders merge into the plan" },
  { src: "app/ward-tasks.png", where: "Ward · Tasks", label: "One checklist, ticked off by name" },
];
const DESK_SHOTS: Shot[] = [
  { src: "app/opd.png", where: "OPD console", label: "Dictate the prescription, sign with HPR ID" },
  { src: "app/front-desk.png", where: "Front desk", label: "A walk-in registered in one sentence" },
  { src: "app/pharmacy.png", where: "Pharmacy board", label: "Queued → preparing → ready → dispensed" },
  { src: "app/lab.png", where: "Diagnostics board", label: "Ordered → collected → processing → reported" },
  { src: "app/queue.png", where: "Queue TV", label: "The waiting room sees who's next" },
  { src: "app/booking.png", where: "Patient booking", label: "Patients book by voice, in their own words" },
  { src: "app/audit-switch.png", where: "Audit log · Switch rooms", label: "Every agent action, under a person" },
  { src: "app/audit-access.png", where: "Audit log · Access log", label: "Who saw what, and why: DPDP-ready" },
];
const Slideshow: React.FC<{ shots: Shot[]; per: number; n: string; eyebrow: string; title: string; hue?: "lav" | "mint" | "powder" | "blush" }> = ({ shots, per, n, eyebrow, title, hue = "lav" }) => {
  const frame = useCurrentFrame();
  return (
    <Stage hue={hue}>
      <SceneTitle n={n} eyebrow={eyebrow} title={title} />
      {shots.map((s, i) => {
        const a = i * per;
        const last = i === shots.length - 1;
        const op = interpolate(frame, [a, a + 12, a + per, a + per + 12], [0, 1, 1, last ? 1 : 0], clamp);
        return (
          <React.Fragment key={s.src}>
            <Sequence from={a} durationInFrames={last ? per + 60 : per + 14} layout="none">
              <div style={{ position: "absolute", right: 70, top: 110, opacity: op }}>
                <AppWindow src={s.src} url={s.where} width={1120} dur={per + 20} origin={s.origin} />
              </div>
            </Sequence>
            <Sequence from={a} durationInFrames={last ? per + 60 : per} layout="none">
              <Callout at={6} color={C.lav400} style={{ left: 90, top: 380 }}>
                {s.label}
              </Callout>
            </Sequence>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 90, top: 470, display: "flex", gap: 10 }}>
        {shots.map((s, i) => (
          <span key={s.src} style={{ width: 34, height: 6, borderRadius: 6, background: frame >= i * per ? C.lav400 : "rgba(255,255,255,0.15)" }} />
        ))}
      </div>
    </Stage>
  );
};
export const WEB_PER = 84;
export const WebWard: React.FC = () => <Slideshow shots={WARD_SHOTS} per={WEB_PER} n="06" eyebrow="The ward screen" title="Everything the chat does lands in the ward." />;
export const WebDesks: React.FC = () => <Slideshow shots={DESK_SHOTS} per={WEB_PER} n="07" eyebrow="OPD, pharmacy and lab" title="One web app for every desk in the hospital." hue="mint" />;
export const WEB_WARD_FRAMES = WARD_SHOTS.length * WEB_PER + 50;
export const WEB_DESKS_FRAMES = DESK_SHOTS.length * WEB_PER + 50;

// ─── 9. Under the hood ──────────────────────────────────────────────────────
const AGENTS = [
  { name: "lotus-ward-scribe", tools: "submit_handover · submit_rounds · approve_handover_note" },
  { name: "lotus-ward-coordinator", tools: "ward_followups · ward_board · complete_task" },
  { name: "lotus-opd-desk", tools: "register_walk_in · opd_queue · list_departments" },
  { name: "lotus-fulfilment", tools: "pharmacy_queue · update_pharmacy_order · update_lab_order" },
];
export const UnderTheHood: React.FC<{ consoleShot?: string }> = ({ consoleShot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Stage hue="lav">
      <SceneTitle n="08" eyebrow="Under the hood" title="Switch rooms, Claude Code agents, Pulse Flow over MCP." />
      <div style={{ position: "absolute", left: 90, top: 330, width: 700, display: "flex", flexDirection: "column", gap: 16 }}>
        {AGENTS.map((a, i) => {
          const s = spring({ frame: frame - 20 - i * 8, fps, config: { damping: 16 } });
          return (
            <div key={a.name} style={{ opacity: s, transform: `translateX(${(1 - s) * -40}px)`, padding: "18px 24px", borderRadius: 22, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.lav400}44`, fontFamily: SANS, color: C.white }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 22 }}>
                <span style={{ width: 10, height: 10, borderRadius: 10, background: C.mint400, boxShadow: `0 0 10px ${C.mint400}` }} />@{a.name}
                <span style={{ marginLeft: "auto", fontSize: 14, color: C.lav400 }}>CLAUDE CODE</span>
              </div>
              <div style={{ marginTop: 8, fontFamily: MONO, fontSize: 16, color: "rgba(255,255,255,0.55)" }}>{a.tools}</div>
            </div>
          );
        })}
      </div>
      <SlideIn at={40} from="right" style={{ right: 80, top: 150 }}>
        {consoleShot ? (
          <div style={{ width: 960, borderRadius: 22, overflow: "hidden", boxShadow: "0 50px 140px -30px rgba(0,0,0,0.8)" }}>
            <Img src={staticFile(consoleShot)} style={{ width: "100%", display: "block" }} />
          </div>
        ) : (
          <Terminal
            width={960}
            height={560}
            title="Switch · rooms and agents (local server)"
            lines={[
              { at: 70, text: "Pulse Flow MCP server · 15 tools · one hospital per agent", color: C.mint400 },
              { at: 120, text: "room  Lotus Ward          → ward-scribe, ward-coordinator" },
              { at: 135, text: "room  Lotus Escalations   → ward-coordinator, pulse-flow-events" },
              { at: 150, text: "room  Lotus OPD Desk      → opd-desk" },
              { at: 165, text: "room  Lotus Pharmacy & Lab → fulfilment" },
              { at: 195, text: "Every tool call: actor → role check → clinical rules → audit log", color: C.lav400 },
            ]}
          />
        )}
      </SlideIn>
    </Stage>
  );
};

// ─── 10. Outro ──────────────────────────────────────────────────────────────
const BADGES = ["Switch", "Telegram", "Claude Code", "MCP", "Wispr Flow"];
export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 34 }}>
        <Mark size={120} draw={interpolate(frame, [0, 34], [0, 1], clamp)} />
        <Kinetic text="Speak it. Approve it. Pulse Flow follows up." delay={10} size={82} gradientWords={["follows", "up."]} />
        <div style={{ display: "flex", gap: 14 }}>
          {BADGES.map((b, i) => {
            const s = spring({ frame: frame - 40 - i * 5, fps, config: { damping: 15 } });
            return (
              <span key={b} style={{ opacity: s, transform: `translateY(${(1 - s) * 20}px)`, padding: "12px 24px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: C.white, fontFamily: SANS, fontSize: 24 }}>
                {b}
              </span>
            );
          })}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: 2, opacity: interpolate(frame, [70, 90], [0, 1], clamp), backgroundImage: GRAD, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>github.com/anupama003/pulse-flow</div>
      </AbsoluteFill>
    </Stage>
  );
};
