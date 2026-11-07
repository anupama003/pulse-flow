import React from "react";
import { Audio, interpolate, staticFile, useVideoConfig } from "remotion";
import { linearTiming, springTiming, TransitionSeries, type TransitionPresentation } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { FollowUp, Groups, Handover, Open, Outro, Pharmacy, Rounds, UnderTheHood, WalkIn, WebApp } from "./scenes";

// Pulse Flow on Switch: a ~2 minute product demo with music and no narration (voice goes on top).

/** Set to "switch/console-agents.png" once the Switch Console screenshot is in public/switch/. */
export const CONSOLE_SHOT: string | undefined = undefined;

const SCENES: { C: React.FC; frames: number }[] = [
  { C: Open, frames: 170 },
  { C: Groups, frames: 230 },
  { C: Handover, frames: 540 },
  { C: FollowUp, frames: 600 },
  { C: Rounds, frames: 540 },
  { C: WalkIn, frames: 400 },
  { C: Pharmacy, frames: 540 },
  { C: WebApp, frames: 420 },
  { C: () => <UnderTheHood consoleShot={CONSOLE_SHOT} />, frames: 330 },
  { C: Outro, frames: 210 },
];
const T = 16;
export const SWITCH_DURATION = SCENES.reduce((n, s) => n + s.frames, 0) - T * (SCENES.length - 1);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transitions: TransitionPresentation<any>[] = [fade(), slide({ direction: "from-right" }), wipe({ direction: "from-left" }), slide({ direction: "from-bottom" })];

const Music: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return <Audio src={staticFile("music.wav")} loop volume={(f) => interpolate(f, [0, 30, durationInFrames - 60, durationInFrames], [0, 0.6, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />;
};

export const SwitchFilm: React.FC = () => (
  <>
    <TransitionSeries>
      {SCENES.flatMap(({ C, frames }, i) => {
        const seq = (
          <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames}>
            <C />
          </TransitionSeries.Sequence>
        );
        if (i === SCENES.length - 1) return [seq];
        return [
          seq,
          <TransitionSeries.Transition key={`t${i}`} presentation={transitions[i % transitions.length]} timing={i % 2 ? springTiming({ config: { damping: 200 }, durationInFrames: T }) : linearTiming({ durationInFrames: T })} />,
        ];
      })}
    </TransitionSeries>
    <Music />
  </>
);
