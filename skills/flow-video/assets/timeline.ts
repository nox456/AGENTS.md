import type { SubtitleEntry } from "./kit";

/** Total length in frames (seconds × 30), from the approved script in SCRIPT.md. */
export const DURATION = 150;

/** Scene starts, in frames. */
export const T = {
  example: 0,
};

/** One entry per action, text verbatim from the approved script; `from`/`to` in frames. */
export const SUBTITLES: SubtitleEntry[] = [
  { text: "Replace with the first subtitle of the approved script.", from: 4, to: 120 },
];
