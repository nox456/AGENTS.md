#!/usr/bin/env node
// Scaffold a flow-video Remotion project from this skill's assets. See --help.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HELP = `Usage: node scripts/new-video.mjs [--no-install] VIDEO_DIR COMPOSITION_ID [PKG@VERSION ...]

Create a Remotion project for one flow video in VIDEO_DIR (normally
<repo>/videos/<flow-slug>), then give it a node_modules: a symlink to a sibling
video's node_modules when that one already has every pinned version, otherwise
\`npm install\`. VIDEO_DIR may already exist with only SCRIPT.md in it.

Arguments:
  VIDEO_DIR       Target directory; its basename is the flow slug (lowercase-hyphen).
  COMPOSITION_ID  PascalCase Remotion composition id, e.g. IvaPerRate.
  PKG@VERSION     Extra or overriding dependency pins, e.g. lucide-react@0.441.0
                  to match the icon library version the app resolves.

Options:
  --no-install    Skip node_modules entirely.
  -h, --help      Show this help.

Output: one JSON object on stdout {dir, compositionId, output, nodeModules}.
npm's own output goes to stderr.

Exit codes:
  0  Scaffolded.
  2  Usage error.
  3  VIDEO_DIR already holds a project (package.json or src/ exists).
  4  npm install failed; the files are in place, re-run npm install there.

Example:
  node scripts/new-video.mjs ~/code/shop/videos/refund-order RefundOrder lucide-react@0.441.0`;

const fail = (code, message) => {
  console.error(`Error: ${message}`);
  if (code === 2) console.error("Run with --help for usage.");
  process.exit(code);
};

const args = process.argv.slice(2);
if (args.includes("-h") || args.includes("--help")) {
  console.log(HELP);
  process.exit(0);
}
const install = !args.includes("--no-install");
const positional = args.filter((a) => a !== "--no-install");
const unknown = positional.find((a) => a.startsWith("-"));
if (unknown) fail(2, `unknown option "${unknown}".`);
const [dirArg, id, ...pins] = positional;
if (!dirArg || !id) fail(2, "VIDEO_DIR and COMPOSITION_ID are required.");

const dir = path.resolve(dirArg);
const slug = path.basename(dir);
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  fail(2, `the directory name "${slug}" must be a lowercase-hyphen flow slug, e.g. "refund-order".`);
}
if (!/^[A-Z][A-Za-z0-9]*$/.test(id)) {
  fail(2, `COMPOSITION_ID must be PascalCase letters and digits, e.g. "RefundOrder". Received: "${id}".`);
}
const parsedPins = pins.map((pin) => {
  const at = pin.lastIndexOf("@");
  if (at <= 0) fail(2, `dependency pins look like name@exact-version. Received: "${pin}".`);
  const version = pin.slice(at + 1);
  if (!/^\d+\.\d+\.\d+/.test(version)) fail(2, `pin an exact version, not a range. Received: "${pin}".`);
  return [pin.slice(0, at), version];
});

if (fs.existsSync(path.join(dir, "package.json")) || fs.existsSync(path.join(dir, "src"))) {
  fail(3, `${dir} already holds a project. Edit it in place instead of scaffolding again.`);
}

const assets = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
const output = `${slug}_1920x1080.mp4`;
const fill = (text) =>
  text.replaceAll("__ID__", id).replaceAll("__NAME__", `${slug}-video`).replaceAll("__OUT__", output);

/** asset file → path inside the video project */
const LAYOUT = {
  "package.json": "package.json",
  "tsconfig.json": "tsconfig.json",
  gitignore: ".gitignore",
  "index.ts": "src/index.ts",
  "Root.tsx": "src/Root.tsx",
  "timeline.ts": "src/timeline.ts",
  "Video.tsx": "src/Video.tsx",
  "kit.tsx": "src/kit.tsx",
  "example.tsx": "src/screens/example.tsx",
  "stills.mjs": "stills.mjs",
};

for (const [from, to] of Object.entries(LAYOUT)) {
  const target = path.join(dir, to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, fill(fs.readFileSync(path.join(assets, from), "utf8")));
}
fs.mkdirSync(path.join(dir, "public", "fonts"), { recursive: true });
if (!fs.existsSync(path.join(dir, "SCRIPT.md"))) {
  fs.copyFileSync(path.join(assets, "SCRIPT.md"), path.join(dir, "SCRIPT.md"));
}

const pkgPath = path.join(dir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
for (const [name, version] of parsedPins) {
  if (pkg.devDependencies?.[name]) pkg.devDependencies[name] = version;
  else pkg.dependencies[name] = version;
}
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

/** A sibling node_modules that already has every exact version this project pins. */
const findSharedModules = () => {
  const wanted = { ...pkg.dependencies, ...pkg.devDependencies };
  const parent = path.dirname(dir);
  for (const sibling of fs.readdirSync(parent).sort()) {
    const modules = path.join(parent, sibling, "node_modules");
    if (sibling === slug || !fs.existsSync(modules)) continue;
    const real = fs.realpathSync(modules);
    const satisfied = Object.entries(wanted).every(([name, version]) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(real, name, "package.json"), "utf8")).version === version;
      } catch {
        return false;
      }
    });
    if (satisfied) return real;
  }
  return null;
};

let nodeModules = "skipped";
if (install) {
  const shared = findSharedModules();
  if (shared) {
    fs.symlinkSync(path.relative(dir, shared), path.join(dir, "node_modules"));
    nodeModules = `linked:${shared}`;
  } else {
    const result = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
      cwd: dir,
      stdio: ["ignore", process.stderr, process.stderr],
    });
    if (result.status !== 0) fail(4, `npm install failed in ${dir} (exit ${result.status}). Fix the cause and re-run npm install there.`);
    nodeModules = "installed";
  }
}

console.log(JSON.stringify({ dir, compositionId: id, output: `out/${output}`, nodeModules }));
