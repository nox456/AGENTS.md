#!/usr/bin/env bash
# Build per-harness agent files from the canonical agents/<name>.md and agents/models.json.
#
# The canonical file carries the shared body plus both harnesses' non-model frontmatter:
#   Claude Code: name, description, tools, skills, hooks
#   OpenCode:    description, mode, permissions
# The model and effort differ per harness, so they live in models.json and are injected here.
# Output: .build/agents/claude/<name>.md and .build/agents/opencode/<name>.md
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$REPO/.build/agents}"
MODELS="$REPO/agents/models.json"

command -v jq >/dev/null 2>&1 || { echo "build-agents: jq is required" >&2; exit 1; }
[ -f "$MODELS" ] || { echo "build-agents: missing $MODELS" >&2; exit 1; }

# Print one top-level frontmatter key and its indented block from an agent file.
block() { # file key
  awk -v key="$2" '
    NR == 1 { next }
    /^---[[:space:]]*$/ { exit }
    tolower($0) ~ "^" key ":" { inblock = 1; print; next }
    inblock && /^[^[:space:]]/ { inblock = 0 }
    inblock { print }
  ' "$1"
}

model() { jq -er --arg h "$1" --arg a "$2" '.[$h][$a].model' "$MODELS"; }
effort() { jq -r --arg h "$1" --arg a "$2" '.[$h][$a].effort // empty' "$MODELS"; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/claude" "$tmp/opencode"

for src in "$REPO"/agents/*.md; do
  [ -f "$src" ] || continue
  name="$(basename "$src" .md)"

  body_start="$(awk 'NR > 1 && /^---[[:space:]]*$/ { print NR + 1; exit }' "$src")"
  [ -n "$body_start" ] || { echo "build-agents: $src has no closed frontmatter" >&2; exit 1; }
  body="$(tail -n +"$body_start" "$src")"

  claude_model="$(model claude "$name")" || {
    echo "build-agents: no claude model for $name in agents/models.json" >&2; exit 1; }
  opencode_model="$(model opencode "$name")" || {
    echo "build-agents: no opencode model for $name in agents/models.json" >&2; exit 1; }
  claude_effort="$(effort claude "$name")"
  opencode_effort="$(effort opencode "$name")"

  {
    echo '---'
    block "$src" name
    block "$src" description
    block "$src" tools
    echo "model: $claude_model"
    [ -z "$claude_effort" ] || echo "effort: $claude_effort"
    block "$src" skills
    block "$src" hooks
    echo '---'
    printf '%s\n' "$body"
  } > "$tmp/claude/$name.md"

  {
    echo '---'
    block "$src" description
    block "$src" mode
    if [ -n "$opencode_effort" ]; then
      echo "model: ${opencode_model}#${opencode_effort}"
    else
      echo "model: $opencode_model"
    fi
    block "$src" permissions
    echo '---'
    printf '%s\n' "$body"
  } > "$tmp/opencode/$name.md"
done

rm -rf "$OUT"
mkdir -p "$(dirname "$OUT")"
mv "$tmp" "$OUT"
trap - EXIT
echo "built   $OUT/claude"
echo "built   $OUT/opencode"
