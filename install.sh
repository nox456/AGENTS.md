#!/usr/bin/env bash
# Link the files tracked in this repo into the directories Claude Code and OpenCode read.
# Safe to re-run: it is idempotent and backs up anything real it would overwrite.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
OPENCODE_DIR="${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}"
AGENTS_DIR="${AGENTS_CONFIG_DIR:-$HOME/.agents}"
STAMP="$(date +%Y%m%d-%H%M%S)"

link() {
  local src="$1" dest="$2"

  if [ -L "$dest" ]; then
    if [ "$(readlink -f "$dest")" = "$(readlink -f "$src")" ]; then
      echo "ok      $dest"
      return
    fi
    echo "relink  $dest (was -> $(readlink "$dest"))"
    rm "$dest"
  elif [ -e "$dest" ]; then
    echo "backup  $dest -> $dest.bak.$STAMP"
    mv "$dest" "$dest.bak.$STAMP"
  fi

  ln -s "$src" "$dest"
  echo "linked  $dest -> $src"
}

# Drop symlinks in a managed directory that still point into this repo but whose source is
# gone (i.e. deleted from the repo). Other symlinks are left alone.
prune() {
  local dir="$1" dest target
  for dest in "$dir"/*; do
    [ -L "$dest" ] || continue
    target="$(readlink "$dest")"
    case "$target" in
      "$REPO"/*)
        if [ ! -e "$target" ]; then
          echo "prune   $dest (source removed from repo)"
          rm "$dest"
        fi
        ;;
    esac
  done
}

mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/agents" "$CLAUDE_DIR/hooks"
mkdir -p "$OPENCODE_DIR/agents"
mkdir -p "$AGENTS_DIR/skills"

# Context: one AGENTS.md, read natively by Claude Code (through ~/.claude/CLAUDE.md for the
# user scope) and by OpenCode (through ~/.config/opencode/AGENTS.md for the global scope).
link "$REPO/AGENTS.md" "$CLAUDE_DIR/CLAUDE.md"
link "$REPO/AGENTS.md" "$OPENCODE_DIR/AGENTS.md"

# Skills: the Agent Skills standard (agentskills.io). ~/.claude/skills is Claude Code's user
# scope; ~/.agents/skills is the cross-agent convention OpenCode also discovers.
for skill in "$REPO"/skills/*/; do
  [ -d "$skill" ] || continue
  link "${skill%/}" "$CLAUDE_DIR/skills/$(basename "$skill")"
  link "${skill%/}" "$AGENTS_DIR/skills/$(basename "$skill")"
done

# Agents: one canonical file per agent; the build step emits native frontmatter for each
# harness and injects that harness's model from agents/models.json.
"$REPO/scripts/build-agents.sh" >/dev/null
for agent in "$REPO"/.build/agents/claude/*.md; do
  [ -f "$agent" ] || continue
  link "$agent" "$CLAUDE_DIR/agents/$(basename "$agent")"
done
for agent in "$REPO"/.build/agents/opencode/*.md; do
  [ -f "$agent" ] || continue
  link "$agent" "$OPENCODE_DIR/agents/$(basename "$agent")"
done

# Hooks are a Claude Code feature: OpenCode gets equivalent restrictions from the agents'
# `permissions` frontmatter instead.
for hook in "$REPO"/hooks/*; do
  [ -f "$hook" ] || continue
  link "$hook" "$CLAUDE_DIR/hooks/$(basename "$hook")"
done

prune "$CLAUDE_DIR/skills"
prune "$CLAUDE_DIR/agents"
prune "$CLAUDE_DIR/hooks"
prune "$AGENTS_DIR/skills"
prune "$OPENCODE_DIR/agents"
