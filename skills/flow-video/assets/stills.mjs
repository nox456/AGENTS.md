// Render single frames to stills/<prefix><frame>.png for review. Run from the video directory:
//   npm run stills -- <prefix> <frame> [frame...]
// which runs: node stills.mjs <CompositionId> <prefix> <frame> [frame...]
import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [id, prefix, ...rest] = process.argv.slice(2);
const frames = rest.map(Number);
if (!id || prefix === undefined || frames.length === 0 || frames.some((f) => !Number.isInteger(f) || f < 0)) {
  console.error(
    "Usage: npm run stills -- <prefix> <frame> [frame...]   (node stills.mjs <CompositionId> <prefix> <frame>...)\n" +
      "Frames are non-negative integers. Example: npm run stills -- r1- 0 60 245",
  );
  process.exit(2);
}

fs.mkdirSync("stills", { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id });
for (const frame of frames) {
  if (frame >= composition.durationInFrames) {
    console.error(`Skipping frame ${frame}: ${id} has frames 0–${composition.durationInFrames - 1}.`);
    continue;
  }
  const output = `stills/${prefix}${frame}.png`;
  await renderStill({ serveUrl, composition, frame, output });
  console.log(output);
}
