# Rebuilding screens from the source

Read in Step 2, when tracing the flow, and again in Step 5, before building the screens. The
rule behind every line: the screen in the video is what the code on that branch renders. Your
memory of what such a screen usually looks like is not a source.

## Trace: what to pull out of the code for each step

| Pull out | Where it lives | Why it matters |
| --- | --- | --- |
| Route and page component | The router: Next.js `app/` or `pages/`, a react-router config, etc. | The URL bar shows the real route; the page component is where tracing starts |
| Literal strings | The JSX, or the i18n catalog for the UI's locale | Copy them verbatim, including the app's own casing, missing accents and typos |
| Layout at 1440 px | The page's classes down to the primitives, plus the shell (sidebar, top bar, breadcrumbs) | Resolve responsive prefixes at 1440 px: with Tailwind's defaults `sm`–`xl` apply, `2xl` (1536) does not |
| Tokens | CSS variables, the Tailwind theme, the token file of the design-system package | Colors, radii, shadows and font of the theme the user sees, light unless told otherwise |
| Primitives | The repo's component library (shadcn copies, a `ui/` package), not the library's defaults | Repos customize heights, paddings, focus rings, and icon stroke width, often from a base stylesheet |
| What each action does | The handler: mutation, refetch, navigation, toast call | Which toast and where, which tab stays active, when data refreshes, where the flow lands next |
| Intermediate states | Loading and disabled branches | "Uploading… 45 %", "Sending…", a disabled button: the video shows them |
| Conditional UI | Role checks, feature flags, account settings | Pick the values the flow assumes and write them in SCRIPT.md |
| Persisted UI state | `localStorage` keys: sidebar pinned, sections collapsed, theme | It changes the layout; pick what a real user of that role has |
| Formatting | Currency, number and date helpers | Render through the same logic, quirks included (one app printed UTC hours on a receipt) |
| Data shape | The query or props each screen renders | Invent neutral rows that satisfy it, with totals that add up across scenes |

Write the screens, states and assumptions you found into SCRIPT.md's header before drafting the
script table: the user approves the setup along with the text.

## Build: how the code is organized

1. **Primitives first**, in `src/screens/primitives.tsx`: the token object (comment which file
   it came from) and only the primitives the flow uses (Button, Input, Checkbox, Select, Dialog,
   Badge, Toast…), each matching the repo's customized version.
2. **The shell once**, in `src/screens/shell.tsx`, parameterized by the active nav item,
   breadcrumbs and anything else that changes between screens.
3. **One file per screen**, `src/screens/<screen>.tsx`: a component whose props are exactly the
   states the script needs: `open` (0–1), typed text, `scrollY`, selected value, `pressed`,
   toast progress. No React state, effects, timers or data fetching.
4. **Export the geometry the cursor aims at**: button centers, row tops, column x, computed
   from the same constants the layout uses, as `example.tsx` does with `EXAMPLE_SAVE`. Never
   read coordinates off a still.
5. **Comment non-obvious numbers with their source class**, e.g. `/* sm:pl-64 → 256 */`, and
   each screen with the component it rebuilds:
   `/* /invoices/create: CreateInvoiceScreen (Card max-w-[860px]) inside the shell, rail pinned. */`

## Animating what the app does

Defaults below come from the repos these videos were made from; where the repo's own animation
classes or props say otherwise, follow the repo.

- **Dialog:** overlay fades in to black at 50 %, the panel fades and zooms from 95 % in ~5–6
  frames; closing takes ~200 ms (6 frames) unless it unmounts instantly.
- **Tooltip:** Radix opens it 700 ms (21 frames) after the pointer arrives unless a
  `TooltipProvider` sets `delayDuration`, then fades in over ~150 ms.
- **Select or popover:** opens over ~5 frames, closes over ~4; the hovered item is highlighted
  before the click.
- **Toast:** slides in from its corner and stays the library's duration (sonner: 4 s) or until
  the scene cuts.
- **Typing:** character by character at ~11–18 characters per second, with the input focused
  (ring and caret) from a few frames before the first character.
- **Scroll:** glide over ~30 frames. When content shrinks (a field hides, a file is picked), the
  browser clamps the scroll offset; reproduce the jump instead of keeping the old offset.
- **Status change:** a badge swapping state may pop; data that refetches swaps at the frame the
  refetch would land, not at the click.
