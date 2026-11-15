import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { DURATION, SUBTITLES, T } from "./timeline";
import { BrowserWindow, Cursor, PAGE_BG, Subtitles, clamp, type CursorPoint } from "./kit";
import { EXAMPLE_SAVE, ExamplePage } from "./screens/example";

export { DURATION };

const p = (at: number, x: number, y: number): CursorPoint => ({ at, x, y });

/* ---------- 1. example: replace with the first scene of the script ---------- */

const CLICK_SAVE = 60;

type Scene = { from: number; to: number; fadeIn: boolean; render: (frame: number) => ReactNode };

/** One entry per screen change. `fadeIn: false` cuts; true fades in over FADE frames. */
const SCENES: Scene[] = [
  {
    from: T.example,
    to: DURATION,
    fadeIn: false,
    render: (f) => (
      <BrowserWindow path="/settings">
        <ExamplePage saved={f >= CLICK_SAVE + 2} pressed={f >= CLICK_SAVE && f < CLICK_SAVE + 6} />
        <Cursor
          frame={f}
          path={[p(4, 900, 420), p(48, EXAMPLE_SAVE.x, EXAMPLE_SAVE.y)]}
          clicks={[CLICK_SAVE]}
        />
      </BrowserWindow>
    ),
  },
];

/** Scene fade in frames (0.2 s). */
const FADE = 6;

export const Video = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: PAGE_BG, overflow: "hidden" }}>
      {SCENES.map((scene, index) => {
        const next = SCENES[index + 1];
        // Keep a scene on screen until the next one has faded in over it.
        const holdUntil = scene.to + (next?.fadeIn ? FADE : 0);
        if (frame < scene.from || frame >= holdUntil) return null;
        const opacity = scene.fadeIn ? interpolate(frame, [scene.from, scene.from + FADE], [0, 1], clamp) : 1;
        return (
          <AbsoluteFill key={scene.from} style={{ opacity }}>
            {scene.render(frame)}
          </AbsoluteFill>
        );
      })}

      <Subtitles entries={SUBTITLES} frame={frame} />
    </AbsoluteFill>
  );
};
