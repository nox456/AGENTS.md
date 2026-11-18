#!/usr/bin/env bash
# Verify the portable setup: skills against the Agent Skills spec, the symlinks install.sh
# creates, and — when OpenCode is installed — the agents it actually discovers. OpenCode reads
# skills from ~/.agents/skills, so the link checks below cover their discovery path.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
OPENCODE_DIR="${OPENCODE_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/opencode}"
AGENTS_DIR="${AGENTS_CONFIG_DIR:-$HOME/.agents}"

failed=0
ok() { printf 'ok      %s\n' "$1"; }
bad() { printf 'FAIL    %s\n' "$1"; failed=$((failed + 1)); }

check_link() { # src dest
  if [ -L "$2" ] && [ "$(readlink -f "$2")" = "$(readlink -f "$1")" ]; then
    ok "$2"
  else
    bad "$2 -> ${1#"$REPO"/} (run ./install.sh)"
  fi
}

echo "Context"
check_link "$REPO/AGENTS.md" "$CLAUDE_DIR/CLAUDE.md"
check_link "$REPO/AGENTS.md" "$OPENCODE_DIR/AGENTS.md"

echo
echo "Agent build"
if "$REPO/scripts/build-agents.sh" >/dev/null; then
  ok "per-harness agents built from agents/ and agents/models.json"
  for agent in "$REPO"/agents/*.md; do
    [ -f "$agent" ] || continue
    name="$(basename "$agent" .md)"
    model="$(jq -r --arg a "$name" '.claude[$a].model // empty' "$REPO/agents/models.json")"
    effort="$(jq -r --arg a "$name" '.claude[$a].effort // empty' "$REPO/agents/models.json")"
    generated="$REPO/.build/agents/claude/$name.md"
    if grep -qx "model: $model" "$generated" && grep -qx "effort: $effort" "$generated"; then
      ok "Claude model $name — $model · $effort"
    else
      bad "Claude model mismatch for $name (expected $model · $effort)"
    fi
  done
else
  bad "scripts/build-agents.sh failed"
fi

echo
echo "Skill spec"
if bash "$REPO/skills/write-skill/scripts/validate-skill.sh" "$REPO"/skills/*/; then
  ok "all skills pass the agentskills.io checks"
else
  bad "one or more skills fail the agentskills.io checks"
fi

echo
echo "Links"
for skill in "$REPO"/skills/*/; do
  [ -d "$skill" ] || continue
  name="$(basename "$skill")"
  check_link "${skill%/}" "$CLAUDE_DIR/skills/$name"
  check_link "${skill%/}" "$AGENTS_DIR/skills/$name"
done
for agent in "$REPO"/agents/*.md; do
  [ -f "$agent" ] || continue
  name="$(basename "$agent")"
  check_link "$REPO/.build/agents/claude/$name" "$CLAUDE_DIR/agents/$name"
  check_link "$REPO/.build/agents/opencode/$name" "$OPENCODE_DIR/agents/$name"
done

if command -v claude >/dev/null 2>&1; then
  echo
  echo "Claude Code parsing"
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/.claude/agents"
  cp "$REPO"/.build/agents/claude/*.md "$tmp/.claude/agents/"
  if claude plugin validate "$tmp/.claude/agents" >/dev/null 2>&1; then
    ok "agent frontmatter loads in Claude Code"
  else
    bad "Claude Code rejects one or more agent files"
  fi
  rm -rf "$tmp"
fi

if command -v opencode >/dev/null 2>&1; then
  echo
  echo "OpenCode discovery"
  agents="$(opencode debug agents 2>/dev/null | jq -r '.[].id' 2>/dev/null)"
  if [ -z "$agents" ]; then
    bad "could not read 'opencode debug agents'"
  else
    for agent in "$REPO"/agents/*.md; do
      name="$(basename "$agent" .md)"
      if printf '%s\n' "$agents" | grep -qx "$name"; then
        ok "agent $name"
      else
        bad "OpenCode does not see agent $name"
      fi
      model="$(jq -r --arg a "$name" '.opencode[$a].model // empty' "$REPO/agents/models.json")"
      effort="$(jq -r --arg a "$name" '.opencode[$a].effort // empty' "$REPO/agents/models.json")"
      actual="$(opencode debug agents 2>/dev/null \
        | jq -r --arg id "$name" '.[] | select(.id == $id) | "\(.model.providerID)/\(.model.id)#\(.model.variant)"' 2>/dev/null)"
      if [ "$actual" = "$model#$effort" ]; then
        ok "OpenCode model $name — $actual"
      else
        bad "OpenCode model mismatch for $name (expected $model#$effort, got ${actual:-none})"
      fi
    done
  fi
else
  echo
  echo "OpenCode not installed; skipped agent discovery checks."
fi

echo
if [ "$failed" -eq 0 ]; then
  echo "Everything checks out."
else
  echo "$failed check(s) failed."
fi
[ "$failed" -eq 0 ]
