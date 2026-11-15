import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, cancelRender, continueRender, delayRender, interpolate, spring, staticFile } from "remotion";

/* ================= per-app settings: set these before building screens ================= */

/** Host shown in the URL bar, before each scene's route. */
export const APP_ORIGIN = "app.example.com";

/** The app's UI font family. Screens and subtitles both use it. */
export const FONT = "Inter";

/**
 * Font files in public/fonts — the files the app itself ships. Leave empty only
 * if FONT is loaded another way (e.g. @remotion/google-fonts); otherwise the
 * frames render in a fallback font.
 */
const FONT_FILES: { file: string; weight: string; style?: string; unicodeRange?: string }[] = [
  // { file: "inter-latin.woff2", weight: "400 800" },
];

/** The app's primary color: tints the click ring. */
export const ACCENT = "#4252FF";

/** What fills the frame behind the browser window. */
export const PAGE_BG = "#F1F1F1";

/* ================= frame geometry ================= */

export const FPS = 30;
export const FRAME_W = 1920;
export const FRAME_H = 1080;

/** Browser bar height, in frame px. */
export const CHROME_H = 60;

/**
 * The app is laid out in CSS px of a 1440-wide browser viewport — the same
 * numbers as its own classes — and scaled 4/3 into the frame under the bar.
 */
export const VIEW_W = 1440;
export const S = FRAME_W / VIEW_W;
export const VIEW_H = (FRAME_H - CHROME_H) / S;

/** Viewport CSS px → frame px. */
export const at = (x: number, y: number) => ({ x: x * S, y: CHROME_H + y * S });

/* ================= fonts ================= */

if (FONT_FILES.length > 0) {
  const handle = delayRender(`Loading ${FONT}`);
  Promise.all(
    FONT_FILES.map(({ file, weight, style, unicodeRange }) =>
      new FontFace(FONT, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, {
        weight,
        style: style ?? "normal",
        ...(unicodeRange ? { unicodeRange } : {}),
      })
        .load()
        .then((face) => document.fonts.add(face)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((error) => cancelRender(error));
}

/* ================= timing helpers (all in frames) ================= */

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 over [from, from + dur], decelerating: entrances. */
export const easeOut = (frame: number, from: number, dur: number) =>
  interpolate(frame, [from, from + dur], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

/** 0→1 over [from, from + dur], ease-in-out: cursor, scroll, camera. */
export const easeInOut = (frame: number, from: number, dur: number) =>
  interpolate(frame, [from, from + dur], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });

/** Linear 0→1 over [from, from + dur]: opacity fades. */
export const fade = (frame: number, from: number, dur: number) =>
  interpolate(frame, [from, from + dur], [0, 1], clamp);

/** Soft spring with no bounce: panels, dialogs, cards. */
export const soft = (frame: number, from: number) =>
  spring({ frame: frame - from, fps: FPS, config: { damping: 200, stiffness: 120 } });

/** Pop with a slight bounce: badges, status changes. */
export const pop = (frame: number, from: number) =>
  spring({ frame: frame - from, fps: FPS, config: { damping: 12, stiffness: 180, mass: 0.6 } });

/** 1 inside [from, to], with fades of `dur` frames at both ends. */
export const between = (frame: number, from: number, to: number, dur = 8) =>
  Math.min(fade(frame, from, dur), 1 - fade(frame, to - dur, dur));

/** Value gliding from `a` to `b` over [from, to], ease-in-out: scroll offsets, zoom. */
export const glide = (frame: number, from: number, to: number, a: number, b: number) =>
  interpolate(frame, [from, to], [a, b], { ...clamp, easing: Easing.inOut(Easing.cubic) });

/** The part of `text` typed by `frame`, when typing runs over [from, to]. */
export const typed = (frame: number, text: string, from: number, to: number) =>
  text.slice(0, Math.floor(interpolate(frame, [from, to], [0, text.length], clamp)));

/* ================= browser window ================= */

const CHROME = { bg: "#E8EAED", border: "#DADCE0", text: "#5F6368" };

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={CHROME.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/** `extend` lets the page run below the viewport, for a camera that zooms near its bottom edge. */
export const Viewport = ({ children, extend = 0 }: { children: ReactNode; extend?: number }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: CHROME_H,
      width: VIEW_W,
      height: VIEW_H + extend,
      transform: `scale(${S})`,
      transformOrigin: "0 0",
      overflow: "hidden",
    }}
  >
    {children}
  </div>
);

/** A generic browser: 60 px bar with the route on APP_ORIGIN, then the app viewport. */
export const BrowserWindow = ({ path, extend = 0, children }: { path: string; extend?: number; children: ReactNode }) => (
  <AbsoluteFill style={{ background: PAGE_BG }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        height: CHROME_H,
        boxSizing: "border-box",
        background: CHROME.bg,
        borderBottom: `1px solid ${CHROME.border}`,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 26px",
      }}
    >
      <div style={{ display: "flex", gap: 9 }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((color) => (
          <div key={color} style={{ width: 13, height: 13, borderRadius: 7, background: color }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <Icon d="M15 18l-6-6 6-6" size={22} />
        <Icon d="M9 18l6-6-6-6" size={22} />
        <Icon d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" size={19} />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 38,
          width: 1080,
          boxSizing: "border-box",
          background: "#fff",
          borderRadius: 19,
          border: `1px solid ${CHROME.border}`,
          padding: "0 18px",
        }}
      >
        <Icon d="M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z" size={15} />
        <span style={{ fontFamily: FONT, fontSize: 18, color: "#202124" }}>
          {APP_ORIGIN}
          <span style={{ color: CHROME.text }}>{path}</span>
        </span>
      </div>
    </div>
    <Viewport extend={extend}>{children}</Viewport>
  </AbsoluteFill>
);

/* ================= camera ================= */

/** Zooms viewport point (vx, vy) onto frame point (fx, fy) at `scale`. */
export type Camera = { scale: number; vx: number; vy: number; fx: number; fy: number };

/** Style for an AbsoluteFill wrapping the BrowserWindow; `t` goes 0→1 (use glide). */
export const cameraStyle = (camera: Camera, t: number): CSSProperties => {
  const x = camera.vx * S;
  const y = CHROME_H + camera.vy * S;
  const scale = 1 + (camera.scale - 1) * t;
  const tx = (camera.fx - camera.scale * x) * t;
  const ty = (camera.fy - camera.scale * y) * t;
  return { transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: "0 0" };
};

/* ================= subtitles (frame px, outside the viewport) ================= */

export type SubtitleEntry = { text: string; from: number; to: number };

/** Distance from the frame's bottom edge. 130 clears toasts that sit ~24–32 px off the bottom-right. */
export const SUBTITLE_BOTTOM = 130;

export const Subtitles = ({ entries, frame }: { entries: SubtitleEntry[]; frame: number }) => {
  const entry = entries.find((item) => frame >= item.from && frame < item.to);
  if (!entry) return null;
  const opacity = Math.min(
    interpolate(frame, [entry.from, entry.from + 6], [0, 1], clamp),
    interpolate(frame, [entry.to - 6, entry.to], [1, 0], clamp),
  );
  const rise = interpolate(frame, [entry.from, entry.from + 6], [8, 0], clamp);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: SUBTITLE_BOTTOM,
        display: "flex",
        justifyContent: "center",
        zIndex: 70,
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: 1760,
          padding: "16px 28px",
          borderRadius: 16,
          background: "rgba(11,15,42,0.70)",
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 40,
          lineHeight: 1.35,
          color: "#fff",
          textAlign: "center",
          transform: `translateY(${rise}px)`,
        }}
      >
        {entry.text}
      </div>
    </div>
  );
};

/* ================= cursor (viewport CSS px, inside the BrowserWindow) ================= */

export type CursorPoint = { at: number; x: number; y: number };

const cursorPosition = (frame: number, path: CursorPoint[]) => {
  if (path.length === 0 || frame < path[0].at) return null;
  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1];
    const next = path[i];
    if (frame <= next.at) {
      const t = interpolate(frame, [prev.at, next.at], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
      return { x: prev.x + (next.x - prev.x) * t, y: prev.y + (next.y - prev.y) * t };
    }
  }
  const last = path[path.length - 1];
  return { x: last.x, y: last.y };
};

/**
 * Arrow cursor gliding between waypoints (hold a position by repeating it with a
 * later `at`). Each click shrinks it for 5 frames and drops a ring. It renders
 * inside the scaled viewport, so frame-px sizes are divided by S.
 */
export const Cursor = ({ frame, path, clicks }: { frame: number; path: CursorPoint[]; clicks: number[] }) => {
  const position = cursorPosition(frame, path);
  if (!position) return null;
  const press = clicks.some((click) => frame >= click && frame < click + 5);
  const ringSize = 80 / S;
  return (
    <>
      {clicks.map((click) => {
        const progress = interpolate(frame, [click, click + 14], [0, 1], clamp);
        if (frame < click || progress >= 1) return null;
        const ring = cursorPosition(click, path);
        if (!ring) return null;
        return (
          <div
            key={click}
            style={{
              position: "absolute",
              left: ring.x - ringSize / 2,
              top: ring.y - ringSize / 2,
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              boxSizing: "border-box",
              border: `${3 / S}px solid ${ACCENT}`,
              opacity: 0.9 * (1 - progress),
              transform: `scale(${0.25 + progress * 0.9})`,
              zIndex: 65,
            }}
          />
        );
      })}
      <svg
        width={30 / S}
        height={34 / S}
        viewBox="0 0 24 28"
        style={{
          position: "absolute",
          left: position.x - 1.5,
          top: position.y - 1.5,
          zIndex: 66,
          transform: `scale(${press ? 0.86 : 1})`,
          transformOrigin: "1.5px 1.5px",
          filter: "drop-shadow(0 1.5px 2px rgba(0,0,0,0.35))",
        }}
      >
        <path
          d="M2 1.8 L2 21.5 L7.4 16.2 L11.6 25.6 L15 24.1 L11 14.9 L18.4 14.9 Z"
          fill="#111"
          stroke="#fff"
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
