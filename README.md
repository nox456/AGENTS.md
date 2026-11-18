# Agent config

Personal, model-agnostic agent configuration shared by Claude Code and OpenCode: global
instructions, custom skills and subagents.

Every real file lives here and is symlinked into each harness's config directory. Skills and
context are live once linked; agents are generated per harness from one canonical file, so after
editing an agent run `./install.sh` (or `scripts/build-agents.sh`) to regenerate it.

## Layout

```
AGENTS.md              ->  ~/.claude/CLAUDE.md
                           ~/.config/opencode/AGENTS.md
skills/<name>/         ->  ~/.claude/skills/<name>
                           ~/.agents/skills/<name>
agents/<name>.md           canonical agent body + both harnesses' non-model frontmatter
agents/models.json         per-harness model and effort
.build/agents/claude/   -> ~/.claude/agents/<name>.md
.build/agents/opencode/ -> ~/.config/opencode/agents/<name>.md
hooks/<name>           ->  ~/.claude/hooks/<name>          (Claude Code only)
scripts/build-agents.sh    emits the per-harness agent files
scripts/verify.sh          checks the skills, links, and both harnesses' parsing/discovery
install.sh                 builds agents and creates/refreshes the symlinks
.claude/settings.local.json  repo-local Claude Code settings, not installed
```

## Portable formats

The three layers have different levels of standardization, so they are handled differently.

### Context: `AGENTS.md`

`AGENTS.md` is the cross-tool instruction file ([agents.md](https://agents.md)). Claude Code
reads it natively, and OpenCode reads it natively. Claude Code's user scope still only looks for
`~/.claude/CLAUDE.md`, and OpenCode's global scope looks for `~/.config/opencode/AGENTS.md`, so
`install.sh` links the same file to both names. There is no `CLAUDE.md` copy to maintain.

### Skills: Agent Skills standard

Skills follow the [Agent Skills](https://agentskills.io) open standard — a folder with a
`SKILL.md` whose frontmatter has `name` and `description`, plus optional `references/`,
`scripts/`, and `assets/`. Both harnesses read the same files, so a skill is written once.

- Claude Code reads `~/.claude/skills/<name>/SKILL.md`.
- OpenCode reads `~/.agents/skills/<name>/SKILL.md` (and also `~/.claude/skills/`), with the
  same progressive-disclosure behavior: only the description is advertised until the skill loads.
- `~/.agents/skills/` is the cross-agent convention, so the same link serves other tools that
  adopt the standard.

`scripts/verify.sh` validates every skill against the spec, checks the links each harness reads,
and — when the harness is installed — confirms Claude Code parses every agent file and OpenCode
discovers every agent in this repo.

### Agents: one source, generated per harness

There is no cross-tool standard for subagent definitions yet. Emerging formats such as OpenGAP
and Open Agent Spec exist, but neither Claude Code nor OpenCode reads them natively. Both do read
Markdown files with YAML frontmatter, but their fields differ, so `agents/<name>.md` is the one
source and `scripts/build-agents.sh` emits native files under `.build/agents/`:

- **Canonical file**: the shared body plus the fields each harness needs. Claude Code gets
  `name`, `description`, `tools`, `skills` and `hooks`; OpenCode gets `description`,
  `mode: subagent` and `permissions`.
- **`agents/models.json`**: the per-harness `model` and `effort`. This is the part that cannot be
  shared, because Claude Code and OpenCode use different model IDs and effort syntax.
- **Generated files**: `.build/agents/claude/<name>.md` and
  `.build/agents/opencode/<name>.md`, each with clean frontmatter for that harness and no unknown
  fields.

| Field in `agents/<name>.md` | Goes to | Purpose |
| --- | --- | --- |
| `name` | Claude Code | Agent name; OpenCode derives its ID from the filename |
| `description` | both | When the harness should delegate to the agent |
| `mode: subagent` | OpenCode | Only launchable as a subagent |
| `tools` | Claude Code | Claude's tool allowlist |
| `skills` | Claude Code | Skill preloaded into the agent's context |
| `hooks` | Claude Code | `PreToolUse` guard — see [Hooks](#hooks) |
| `permissions` | OpenCode | Equivalent edit/subagent denials — see [Permissions](#permissions) |

The agent body is the system prompt for both harnesses. It refers to the wrapped skill by name
and gives the skill's path in each harness, rather than assuming `~/.claude/`.

The configured models are:

| Agent | Claude Code | OpenCode |
| --- | --- | --- |
| `code-reviewer` | `claude-opus-5` · high | `deepseek/deepseek-flash#high` |
| `implementer` | `claude-sonnet-5-5` · high | `deepseek/deepseek-flash#high` |
| `mutation-tester` | `claude-sonnet-5-5` · medium | `deepseek/deepseek-flash#low` |
| `refactor-reviewer` | `claude-opus-5` · high | `deepseek/deepseek-flash#high` |
| `tester` | `claude-sonnet-5-5` · high | `deepseek/deepseek-flash#high` |

`deepseek/deepseek-flash` is the OpenCode ID for the DeepSeek V4.1 Flash model; the `#high` and
`#low` suffixes select its variant.

## Skills

### Authored here

| Name | Description | Depends on |
| --- | --- | --- |
| [write-skill](skills/write-skill/) | Authors or revises an Agent Skill against the agentskills.io spec — docs first, grounded expertise, progressive-disclosure budget, validated before hand-off. | — |
| [start-issue](skills/start-issue/) | Sets up a dedicated session for one issue — checks your existing branch, creates its worktree, moves in, starts the PRD, and leaves the hand-off record `/work-issue` continues from. | `using-git-worktrees`, `write-prd` |
| [work-issue](skills/work-issue/) | Runs the workflow on an issue `start-issue` set up — plans in the session, hands each plan phase to the `implementer` agent, delegates tests, mutation testing and both reviews to the isolated agents below, relays their questions, fixes the findings code-review first, and attaches the docs to the issue. | `start-issue`, `write-implementation-plan`, `implementation-loop`, `fix-review-findings`, the five agents |
| [start-pr-review](skills/start-pr-review/) | Sets up a dedicated session for one pull request — checks your local branch is at the PR head, creates its worktree, moves in, runs the PR review, and offers to remove the worktree afterwards. | `using-git-worktrees`, `pr-review` |
| [write-prd](skills/write-prd/) | Interviews the requester and grounds the result in the codebase to produce a PRD with scope, numbered requirements and Given/When/Then acceptance criteria, reviewed with you before hand-off. | — |
| [write-implementation-plan](skills/write-implementation-plan/) | Turns an issue or PRD into a technical plan: change list by layer, numbered requirements, ordered build sequence, rollback path. | `write-prd` (optional input) |
| [implementation-loop](skills/implementation-loop/) | Executes an implementation plan one phase at a time — implement, verify, suggest a commit, mark the phase done. | `write-implementation-plan` |
| [write-tests](skills/write-tests/) | Audits the existing coverage behavior by behavior, writes the missing unit tests (happy path, edge cases, error path) plus optional flow-based integration tests, and records the result in the plan. | `write-implementation-plan`, `implementation-loop` |
| [mutation-testing](skills/mutation-testing/) | Injects one deliberate defect at a time into the code under test and reports which mutants the suite killed, which survived, and the mutation score. | `write-tests` (optional input) |
| [code-review](skills/code-review/) | Reviews changed code for functional defects against the document it was built from, with severities and a merge-readiness score. | `write-prd` or `write-implementation-plan` |
| [refactor-review](skills/refactor-review/) | Reviews working code for behavior-preserving cleanups — duplication, misplaced helpers, convention drift, dead code — with a refactor score. | `write-implementation-plan`, `code-review` |
| [pr-review](skills/pr-review/) | Publishes a code review to a GitHub pull request — inline comments on the findings you pick plus one summary comment carrying the finding list and the merge-readiness score. | `code-review` |
| [fix-pr-review](skills/fix-pr-review/) | Triages the review comments on a pull request against the code and the plan, fixes the ones you pick one at a time, and replies to every comment — fixed and skipped alike. | `write-implementation-plan` or `write-prd` |
| [fix-review-findings](skills/fix-review-findings/) | Fixes the `code-review` / `refactor-review` findings you pick one at a time — verify, suggest a Conventional Commits title, and wait for your commit before starting the next. | `code-review`, `refactor-review` |
| [fix-merge-conflicts](skills/fix-merge-conflicts/) | Resolves the conflicts of a stopped rebase and stages them — one line per file on how each was fixed, anything ambiguous left unmerged for you, and `git rebase --continue` left to you. | — |
| [worktree-temp-task](skills/worktree-temp-task/) | Lends a worktree's branch and its uncommitted files to the main checkout for a task that only runs there, then puts the branch, the files and the main checkout's previous branch back — never deleting the worktree. | — |
| [flow-video](skills/flow-video/) | Makes a silent tutorial video of one app flow — screens rebuilt in Remotion from the app's own source, one subtitle per action from a script you approve, rendered into the repo's `videos/` folder. | — |
| [english-coach](skills/english-coach/) | Appends a short English-coaching note to every response, rewriting the phrasings that read non-native. | — |

### External

Skills authored elsewhere and vendored in. `install.sh` links them like any other
skill, but they are not ours to maintain: fixes belong upstream, and edits here are
a deliberate local fork that the next update will have to be reconciled against.

| Name | Description | Origin |
| --- | --- | --- |
| [using-git-worktrees](skills/using-git-worktrees/) | Ensures feature work starts in an isolated workspace — detects existing isolation, prefers the harness's native worktree tool, falls back to `git worktree add`, then runs project setup and a baseline test. Pairs with `write-implementation-plan` / `implementation-loop`, which it is meant to run before. | Third-party, installed into `~/.agents/skills/`; upstream not recorded in `.skill-lock.json` |

## Agents

Subagents that run one workflow skill each. `implementer` writes one plan phase per run, so the
main session never holds the phase's files and diffs; the four verifiers run their skill in a
context that did not write the code. Only `/work-issue` delegates to them; invoking any of these
skills by hand still runs it in-session, as before. Each agent returns a
`RESULT: OK | NEEDS_INPUT | BLOCKED` line followed by its skill's own report.

Each canonical file is generated into both harnesses with its configured model; the shared body
is identical in both.

| Name | Wraps | Tools (Claude Code) | Guard modes (Claude Code) |
| --- | --- | --- | --- |
| [implementer](agents/implementer.md) | `implementation-loop`, one phase per run; runs no format, lint, typecheck or tests | Read, Grep, Glob, Bash, Edit, Write | `readonly`, `skills-read` |
| [code-reviewer](agents/code-reviewer.md) | `code-review` | Read, Grep, Glob, Bash | `readonly`, `skills-read` |
| [refactor-reviewer](agents/refactor-reviewer.md) | `refactor-review` | Read, Grep, Glob, Bash | `readonly`, `skills-read` |
| [tester](agents/tester.md) | `write-tests`, in an audit pass and a write pass | Read, Grep, Glob, Bash, Edit, Write | `no-git`, `tests-only`, `skills-read` |
| [mutation-tester](agents/mutation-tester.md) | `mutation-testing` | Read, Grep, Glob, Bash, Edit | `no-git`, `src-only`, `skills-read` |

### Hooks

Claude Code only. The `PreToolUse` guard turns the agents' "report only", "never commit" and
"never touch that kind of file" rules from instructions into denials.

| Name | Description | Used by |
| --- | --- | --- |
| [agent-guard.sh](hooks/agent-guard.sh) | `PreToolUse` guard with five modes. `readonly` limits Bash to a read-only allowlist. `no-git` denies git commands that change state. `tests-only` and `src-only` limit which files Edit/Write may touch. `skills-read` lets an agent read the skill it wraps without a permission prompt. Fails closed, and needs `jq`. | Every agent, through its frontmatter `hooks:` |

### Permissions

OpenCode has no hooks. It enforces the `permissions` list in each agent's frontmatter instead:

- `code-reviewer`, `refactor-reviewer`: deny all `edit`, deny every `subagent` launch.
- `implementer`, `tester`, `mutation-tester`: deny every `subagent` launch.
- Every agent: the body's rules still cover what OpenCode's permission model cannot express —
  the read-only shell allowlist, `no-git`, `tests-only` and `src-only`.

## Setup on a new machine

```bash
git clone https://github.com/nox456/CLAUDE.md ~/Documents/Projects/agent-config
cd ~/Documents/Projects/agent-config
./install.sh
./scripts/verify.sh
```

`install.sh` is idempotent. It backs up any real file it would replace to
`<name>.bak.<timestamp>`, and removes stale symlinks left behind by skills, agents
or hooks that were deleted from the repo.

The Claude Code agents' guard hook needs `jq` on the `PATH`.

Set `CLAUDE_CONFIG_DIR` to link somewhere other than `~/.claude`,
`OPENCODE_CONFIG_DIR` for OpenCode's config directory (default
`~/.config/opencode`), or `AGENTS_CONFIG_DIR` for the cross-agent skills directory
(default `~/.agents`). The agents' hook commands still point at
`$HOME/.claude/hooks/`, so with `CLAUDE_CONFIG_DIR` set the Claude Code guards do not run.

## Adding a skill

Create `skills/<name>/SKILL.md` here, add a row to the Skills table above, then run
`./install.sh` to link it into both harnesses. The `/write-skill` skill walks the whole process,
including validation with `skills/write-skill/scripts/validate-skill.sh`.

For a skill written by someone else, copy its folder into `skills/` and add the row
to the External table instead, recording where it came from.

## Adding an agent

Create `agents/<name>.md` with the fields described in
[Agents](#agents-one-source-generated-per-harness), add its Claude Code and OpenCode models to
`agents/models.json`, add a row to the Agents table, and run `./install.sh`. Keep the filename
equal to the `name` so Claude Code and OpenCode agree on the identity. Add the matching OpenCode
`permissions` when the agent writes files or must not launch other agents.
