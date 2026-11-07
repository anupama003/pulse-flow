import React from "react";
import { Composition } from "remotion";
import { SWITCH_DURATION, SwitchFilm } from "./SwitchFilm";

export const SwitchRoot: React.FC = () => <Composition id="SwitchDemo" component={SwitchFilm} durationInFrames={SWITCH_DURATION} fps={30} width={1920} height={1080} />;
