---
name: flow-video
description: Make a silent 1920×1080 tutorial video of a flow in an app — trace the flow through the app's source code, write a script with one subtitle per action and get it approved, rebuild each screen in Remotion with a scripted cursor, review stills, and render the MP4 into `videos/<flow>/` inside the repo. Use when the user asks to "make a video of this flow", "record a tutorial of <feature>", "video walkthrough", "demo video of the new screen", "show the team how X works in a video", "tutorial video for this issue", or invokes /flow-video — even when they only name a feature or an issue and say "video". Defaults to the app in the current repo. Does not cover branded or marketing videos (intro, logo, music, voice-over), and does not screen-record the running app.
compatibility: Requires Node.js 18+ and npm; the first install and the first render download packages and a headless Chrome. ffprobe is used to check the output.
---

# Make a tutorial video of an app flow

Produces one silent MP4 per flow: the app's screens rebuilt in Remotion from its own source
code, full frame under a generic browser bar, a cursor performing each action, and one
subtitle per action. Nothing else is on screen. It exists to stop the two failures these videos
have had: screens approximated from memory, which get thrown away and rebuilt from the code,
and a cut nobody approved.

## Ground rules

- **Rebuild from the source, never approximate.** Every screen, string, color, spacing, icon and
  post-action behavior comes from the app's code on the branch that has the flow. "Looks about
  right" is a redo.
- **No building before an approved script.** The user approves SCRIPT.md, with its exact
  subtitles, before any screen is built. Approved text is used verbatim; if a line does not fit,
  ask before rewording it.
- **Show the app as it is.** When the code renders something wrong (a bug, an odd format), the
  video shows it, SCRIPT.md's fidelity notes record it, and the user hears about it. Never fix
  the app inside the video.
- **Neutral demo data.** Generic organization and person names, IDs in the app's own format, no
  real customers, banks, emails or credentials. Numbers stay consistent across scenes.
- **Flow only.** No intro, title card, logo, badge, music or outro. Frame 0 is the first screen
  with the first subtitle; the video ends on the flow's last screen.
- **One flow, one video, one directory:** `<repo>/videos/<flow-slug>/`. Several flows means
  several videos, each with its own approved script.
- **The app is read-only.** Never edit app code or repo-level config, and never commit. Ask
  first if the repo's tooling would need to change.

## Workflow

- [ ] Step 1 — Pin down the flow
- [ ] Step 2 — Trace it through the source
- [ ] Step 3 — Write the script and get it approved (gate)
- [ ] Step 4 — Scaffold the video project
- [ ] Step 5 — Rebuild the screens
- [ ] Step 6 — Choreograph the timeline
- [ ] Step 7 — Review stills until clean
- [ ] Step 8 — Render, verify, hand off

---

### Step 1 — Pin down the flow

The app is the current repo unless the user names another. Settle, from the request, the
issue and the code, and ask only what none of them answers:

- Where the flow starts and ends, and which roles act in it (e.g. owner, then admin, then owner).
- The branch that has the flow. Unreleased work lives on the feature branch, not `main`; read
  it without checking it out (`git show <branch>:<path>`) if the working tree is elsewhere.
- The UI language. Subtitles are written in it.

Fixed defaults, not questions: 16:9, 1920×1080, 30 fps, silent, light theme, desktop viewport
1440 px wide. If the app is mobile-only or the user wants a vertical cut, agree the framing with
them before Step 4, because the kit draws a desktop browser.

### Step 2 — Trace it through the source

Read `references/screen-fidelity.md` now. For every step of the flow, pull out the route, the
components, the literal strings, the tokens and primitives, what each action does, and the
conditional and persisted UI state, as its table lists. The output is a list of screens and of
the states each one must show.

### Step 3 — Write the script and get it approved

Create `<repo>/videos/<flow-slug>/SCRIPT.md` from `assets/SCRIPT.md` (the slug is
lowercase-hyphen, e.g. `refund-order`). Fill the header with what Step 2 found: the branch,
the routes and their state, the demo data. Then the table: one row per action.

Writing the subtitles:

- **One sentence per action.** Several clicks in a step means several rows.
- **Present tense, literal, no selling.** Say what the viewer sees happen. No adjectives or
  promises ("instantly", "seamless", "100 % automatic").
- **Quote UI labels exactly as the app writes them**, in the UI language's quotation marks,
  and write locations as breadcrumbs: `Settings › Billing`.
- **The first subtitle already describes the first action.** No welcome line.
- **Fit two lines at most**: about 80 characters per line at 40 px.
- **Time it:** at least ~2.4 s on screen, about 1 s per 12–15 characters for longer lines.

Show the user the full SCRIPT.md and stop until they approve it or send changes. Record the
approval date in the header. A change to the script after approval needs approval too.

### Step 4 — Scaffold the video project

First check that `videos/` stays outside the repo's tooling: workspace globs
(`pnpm-workspace.yaml`, `workspaces` in the root `package.json`), the root `tsconfig.json`
`include`, and the lint and test globs. If one would pick it up, tell the user and ask before
changing anything.

Find the version of the icon library the app resolves (its lockfile), then run from the skill
root, passing that pin (the kit defaults to `lucide-react@0.468.0`; another library goes in the
same way):

```bash
node scripts/new-video.mjs /abs/path/to/repo/videos/<flow-slug> <CompositionId> lucide-react@<app's version>
```

It lays the assets out as the project below, keeps an existing SCRIPT.md, and links a sibling
video's `node_modules` when that one already has every pinned version, otherwise runs
`npm install`. Exit 3 means the directory already holds a project: edit that one. `--help`
lists the rest.

| Asset | Lands at | What it is |
| --- | --- | --- |
| `assets/kit.tsx` | `src/kit.tsx` | Per-app settings, frame geometry, timing helpers, BrowserWindow, camera, Subtitles, Cursor |
| `assets/Video.tsx` | `src/Video.tsx` | The scene list and the scene runner (cut or 6-frame fade) |
| `assets/timeline.ts` | `src/timeline.ts` | `DURATION`, scene starts `T`, `SUBTITLES` |
| `assets/example.tsx` | `src/screens/example.tsx` | A sample screen showing the pattern. Delete it once real screens exist |
| `assets/Root.tsx`, `assets/index.ts` | `src/` | The composition, registered |
| `assets/stills.mjs` | `stills.mjs` | Renders chosen frames to `stills/`: `npm run stills -- <prefix> <frame>...` |
| `assets/package.json`, `assets/tsconfig.json`, `assets/gitignore` | project root | Pinned Remotion 4 setup; `out/`, `stills/`, `node_modules` ignored |

Then set the per-app block at the top of `src/kit.tsx`: `APP_ORIGIN`, `FONT`, `ACCENT` (the
app's primary color), and the fonts. Copy the font files the app ships into `public/fonts/` and
list them in `FONT_FILES`. If the app loads a Google font through `next/font/google` instead,
use `@remotion/google-fonts/<Font>`. Check with `npm run typecheck` and
`npm run stills -- setup- 0`, both from the video directory.

### Step 5 — Rebuild the screens

Follow the build section of `references/screen-fidelity.md`: primitives, then the shell, then
one file per screen whose props are the states the script needs, with the cursor targets
exported as constants. Every screen draws at viewport CSS px with the app's own numbers,
inside `BrowserWindow path="<real route>"`.

### Step 6 — Choreograph the timeline

Convert the approved times to frames (seconds × 30) in `src/timeline.ts`, one `SUBTITLES` entry
per row, text pasted verbatim. Then one `SCENES` entry per screen change in `src/Video.tsx`,
with each action's frames as named constants (`CLICK_SAVE = 258`) shared by the cursor, the
press state and the state change.

- **Subtitle before action:** it enters ~6 frames before its action, holds while the action
  happens, and fades out over the last 6 frames before the next one.
- **Each action:** the cursor glides there (ease-in-out, ~10–45 frames depending on distance),
  pauses, clicks, and the UI reacts on the click frame or 2 frames after. Leave 0.3–0.7 s before
  the next action. Nothing happens instantly or off-camera.
- **Scene changes:** a cut, or a 6-frame fade (`fadeIn: true`). No slides, spins or decorative
  zooms.
- **Camera:** zoom (up to ~1.3×) only to make a small detail legible or to lift it out of the
  subtitle band. Glide in over ~20 frames with `cameraStyle`, and note the zoom in SCRIPT.md.
- **End:** hold the last screen at least 1 s after its final action. No fade to black.

### Step 7 — Review stills until clean

From the video directory, render the frames that matter: each scene's first frame, the middle
of each subtitle, each click frame, a few frames after each state change, and the last frame.

```bash
npm run stills -- r1- 0 60 245 ...
```

Open each PNG and check it against the source and the script:

- [ ] Strings match the code character for character; the subtitle matches SCRIPT.md.
- [ ] Layout, spacing, colors and icons match the components at 1440 px.
- [ ] The cursor tip sits on its target at every click.
- [ ] Nothing the subtitle talks about is hidden behind the subtitle or under the cursor.
- [ ] The state shown is the state the code would be in at that moment (toast, tab, loading label).
- [ ] The font is the app's font in every frame, not a fallback.

Fix, re-render with a new prefix (`r2-`), and repeat until every box holds.

### Step 8 — Render, verify, hand off

```bash
npm run render
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate -show_entries format=duration -of compact out/<flow-slug>_1920x1080.mp4
```

Expect a single h264 video stream, 1920×1080, `30/1`, no audio stream, and a duration of
`DURATION / 30` seconds. Then report: the video path, the SCRIPT.md path, its fidelity notes
(app bugs shown in particular), and anything you could not verify from the code. `out/` is
gitignored; whether to commit the video's source is the user's call, so offer and do not
commit.

## Gotchas

- Remotion renders every frame on its own. CSS transitions and animations, `useEffect`,
  `setTimeout`, `Date.now()` and `Math.random()` do not animate, or make frames disagree.
  Derive every change from the frame number with the kit's helpers.
- Screens are drawn in viewport CSS px inside a 4/3 scale. Anything inside the viewport that
  must keep a frame-px size (cursor, ring, your own markers) divides by `S`, as `Cursor` does.
  Subtitles live outside the viewport, in frame px.
- Subtitles sit 130 px off the bottom so the toasts in the bottom-right corner stay visible.
  If the app's toaster sits elsewhere, check that it clears the band.
- Anything the subtitle refers to that falls in the bottom ~250 frame px (a dropdown, a warning,
  a total) ends up behind it. Scroll the page or zoom the camera so it clears.
- A camera zoom near the viewport's bottom edge exposes blank space below the page. Pass
  `extend` to `BrowserWindow` and keep the page rendering there.
- A real browser clamps scroll when content gets shorter (a field hides, a file is picked).
  Reproduce the jump; keeping the old offset shows a position the app cannot reach.
- When a video's `node_modules` is a symlink to a sibling's, never run `npm install` through
  it: that rewrites the sibling's dependencies. Replace the link with a real install first.
- A frame in a fallback font means a font file was missing from `public/fonts` or `FONT_FILES`.
  A load error cancels the render, so it never fails silently.
