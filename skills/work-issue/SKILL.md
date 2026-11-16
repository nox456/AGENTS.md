---
name: work-issue
description: Run the development workflow on one issue from the implementation plan onward — plan in this session, hand each plan phase to the implementer subagent while this session keeps the loop and waits on the user's commits, then delegate tests, mutation testing and both reviews to isolated subagents (tester, mutation-tester, code-reviewer, refactor-reviewer) so no verifier grades code it wrote, relay every question they return, fix the findings code-review first, and attach the plan to the issue. Use after `/start-issue` has written the PRD, or when the user says "work this issue", "run the workflow on it", "take it from plan to review", "continue the issue", "do the rest of the workflow", or invokes /work-issue. Only continues an issue that `/start-issue` set up in this worktree, and refuses otherwise. Not for one step run by hand — `/code-review`, `/write-tests`, `/mutation-testing` and `/refactor-review` still run in-session on their own.
---

# Work an issue through the workflow

Runs the `CLAUDE.md` "Development workflow" from step 2 to the end on one issue. Planning, the
phase loop and fixes run here, because they need the user mid-run. Each plan phase is written by
the `implementer` agent, so this session holds one report per phase, never the phase's files and
diffs. Every verifier runs in a subagent that did not write the code: the `tester`,
`mutation-tester`, `code-reviewer` and `refactor-reviewer` agents. All five live in
`~/.claude/agents/`, each wrapping its skill, and this skill is the only path that delegates
them.

## Ground rules

- **Only issues `/start-issue` set up.** Its hand-off record in the worktree's git directory is
  the gate (Step 1). Without it, stop and send the user to `/start-issue`. Never create or edit
  the record to get past the gate; the only edit allowed is Step 3 adding the plan path.
- **Phases and verifiers are delegated, never run here.** Each plan phase goes to `implementer`;
  tests, mutation and both reviews go to their agents. If an agent type is missing from the
  Agent tool's list, stop and tell the user to run `./install.sh` in their `CLAUDE.md` repo.
  Never fall back to running the skill in this session: a verifier would lose the independence
  it exists for, and a phase would fill this session with every file and diff it touches.
- **The user picks the optional steps; required steps always run.** `write-tests` and
  `refactor-review` are optional. `mutation-testing` is required whenever `write-tests` ran.
  `code-review` and "Attach docs" are always required (Step 2).
- **Every gate reaches the user.** A subagent cannot ask anything. A `RESULT: NEEDS_INPUT` is
  relayed with `AskUserQuestion`, using the options the agent gave; never answer it yourself.
- **Inputs are absolute values.** Every delegation carries the plan path, PRD path or `none`,
  worktree path and, for a verifier, the base commit SHA, resolved once in Step 1. A subagent starts cold, and a
  relative path or a branch name makes it search or guess.
- **Agent reports pass through unchanged.** Show the findings, audit and mutation report exactly
  as returned. `fix-review-findings` parses those formats.
- **The user commits.** Never run `git add`, `commit`, `push`, `stash`, `restore`, `reset` or
  `checkout`. Each stage that changes files ends with a commit the user makes, checked with git
  before the next stage starts.
- **The order is fixed:** plan → implementation → tests → mutation → reviews → fixes, code-review
  findings before refactor findings → attach docs. Skipping an optional step never reorders the
  rest.

## Workflow

- [ ] Step 1 — Resolve the issue, worktree, documents and base
- [ ] Step 2 — Agree on the steps to run
- [ ] Step 3 — Plan here, implement through `implementer`
- [ ] Step 4 — Tests: audit, selection, write (if chosen)
- [ ] Step 5 — Mutation testing (whenever Step 4 ran)
- [ ] Step 6 — Both reviews, in parallel
- [ ] Step 7 — Fix the findings, code-review first
- [ ] Step 8 — Attach the docs to the issue
- [ ] Step 9 — Wrap up

---

### Step 1 — Resolve the issue, worktree, documents and base

**Hard gate: the issue must have been set up by `/start-issue`.** It leaves a hand-off record in
the worktree's private git directory. Read it first:

```bash
cat "$(git rev-parse --absolute-git-dir)/start-issue.json"
```

```json
{"issue": "42", "tracker": "github", "title": "…", "url": "…", "branch": "feat/x",
 "worktree": "/abs/path", "prd": "/abs/path/prd.md", "plan": null, "created": "2026-10-29"}
```

| Finding | Action |
| --- | --- |
| No record | Stop: "This branch was not set up with `/start-issue`. Run `/start-issue <issue> <branch>` first; `/work-issue` only continues issues it set up." Never write the record yourself |
| `branch` or `worktree` differs from `git branch --show-current` / `git rev-parse --show-toplevel` | Stop. The record belongs to another checkout; name both values |
| `prd` is `null` | `write-prd` never finished. Ask whether to finish it first or continue with `PRD: none` |
| `plan` is set | Resume: Step 3 skips writing the plan |

Then resolve the base:

```bash
git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null   # default branch, e.g. origin/main
git merge-base <default branch> HEAD                            # Base: a SHA, not a branch name
git status --short
```

Fall back to the local default branch when there is no `origin`. If the user rebases later,
recompute the base before the next delegation.

Report the four values in one block. They fill every delegation prompt:

```
Plan:      <absolute path | not written yet>
PRD:       <absolute path | none>
Worktree:  <absolute path>
Scope:     git diff <base SHA>...HEAD
```

### Step 2 — Agree on the steps to run

Ask once, with `AskUserQuestion` (`multiSelect: true`), which optional steps run. Recommend
both on team work. The user may instead name a subset ("only the reviews"); follow it, but say
which required step that leaves out and ask whether to drop it.

| This skill | Runs | Rule | Where |
| --- | --- | --- | --- |
| Step 3 | `write-implementation-plan`, `implementation-loop` | Required, unless already done | Plan here · phases in `implementer` |
| Step 4 | `write-tests` | Optional | `tester` agent, two passes |
| Step 5 | `mutation-testing` | Required if Step 4 ran | `mutation-tester` agent |
| Step 6 | `code-review` + `refactor-review` | CR required · RR optional | Both agents, one message |
| Step 7 | `fix-review-findings` | When the user picks findings | Here |
| Step 8 | Attach docs | Required | Here, after asking |

### Step 3 — Plan here, implement through `implementer`

- No plan yet → invoke `write-implementation-plan` with the Skill tool, passing the PRD path
  and the issue. Follow it to the end, including where it asks to save the plan. Then store the
  plan's absolute path in the record, so a later session resumes from it:

  ```bash
  f="$(git rev-parse --absolute-git-dir)/start-issue.json"
  jq --arg plan "<absolute plan path>" '.plan = $plan' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  ```
- Then implement the plan one phase at a time, one `implementer` agent per phase, waiting on the
  user's commit after each. Read `references/implementation-phases.md` before the first phase:
  it is the loop this session runs around the agent, including the one-time offer to run risky
  phases on Opus. Do not invoke `implementation-loop` here; the agent preloads it.
- A plan whose build sequence is already marked done skips both. Say so.

Before Step 4, `git status --short` must show no uncommitted production code. If it does, ask
the user to commit it. The agents review `HEAD`, and a dirty tree makes the scope ambiguous.

### Step 4 — Tests: audit, selection, write

Skip this step if it was not chosen. Delegate the audit pass with the Agent tool,
`subagent_type: tester`, and this prompt:

```
Plan:      <absolute path>
PRD:       <absolute path | none>
Worktree:  <absolute path>
Scope:     git diff <base SHA>...HEAD
Mode:      audit
```

Show the audit unchanged. Then ask, with `AskUserQuestion`, which gaps to cover, recommending
every HIGH, and whether to add integration tests. With more than 4 gaps, ask for the `B-n`
refs, as `fix-review-findings` Step 2 does. Then delegate the write pass to a new `tester`:

```
Plan:      <absolute path>
PRD:       <absolute path | none>
Worktree:  <absolute path>
Scope:     git diff <base SHA>...HEAD
Mode:      write
Selection: B-2, B-5 · integration: yes | no
Audit:
<the audit pass's report, verbatim, without its RESULT line>
```

Show its hand-off. The agent ran nothing. Give the user the test command it named and a
`test(<scope>): …` commit title, then wait. Once the user says it is done, check that
`git status --short` lists none of the test files or the plan. Only then go on to Step 5.

### Step 5 — Mutation testing

Required whenever Step 4 ran. Ask the budget with `AskUserQuestion`, recommending the skill's
default of 20 mutants or 10 minutes. Then delegate to `subagent_type: mutation-tester`:

```
Plan:      <absolute path>
PRD:       <absolute path | none>
Worktree:  <absolute path>
Scope:     git diff <base SHA>...HEAD
Budget:    20 mutants | 10 minutes
```

**No `node_modules` in the worktree → park, don't ask.** Mutation testing runs the suite, and
worktrees get no install. Before delegating, check `<worktree>/node_modules`. If it is missing:
1. Run `worktree-temp-task` to park the branch in the main checkout.
2. Delegate with `Worktree:`, `Plan:` and `PRD:` pointing at the main checkout's copies.
3. When pnpm's shim fails non-interactively ("No version is set"), tell the agent to run pnpm
   through `bash -lic '…'`.
4. Once the report is in, run `worktree-temp-task`'s Restore, before Step 6, which keeps the
   worktree paths.

Never ask to install instead.

Show the report unchanged. Survivors are test gaps, not code fixes. Offer another Step 4 write
pass for them; do not start one unasked. Confirm `git status --short` matches what it showed
before the run.

### Step 6 — Both reviews, in parallel

Send **one message with two Agent calls**: `code-reviewer`, plus `refactor-reviewer` when it
was chosen. Two messages run them one after the other. Same four lines for both; the refactor
reviewer gets one more:

```
Plan:        <absolute path>
PRD:         <absolute path | none>
Worktree:    <absolute path>
Scope:       git diff <base SHA>...HEAD
Code review: running in parallel — proceed          (refactor-reviewer only)
```

Wait for both. Show the code review first, then the refactor review, each unchanged.

### Step 7 — Fix the findings, code-review first

If either review has findings, invoke `fix-review-findings` with the Skill tool, with both
reports in context. Its Step 2 orders every `CR-` before any `RR-`. Do not change that order,
even when the user picks only refactor findings to start. With open CR findings, ask whether to
fix those first. Offer to re-run Step 6 once the fixes are committed; do not re-run it unasked.

A fix that resolves a row in the plan's "Test coverage" section, such as an expected failure or
an open gap, leaves that section stale. Update the row and the coverage line after the fix is
committed, and give the user a `docs(plan): …` title for it, so Step 8 attaches a current plan.

### Step 8 — Attach the docs to the issue

Required. Post to the issue in the record: the final PRD (when there is one) and the final
plan. It runs last because both changed along the way. Show the user what will be posted and
where, and **ask with `AskUserQuestion` before posting**. On GitHub:

```bash
gh issue comment <n> --body-file <absolute plan path>
gh issue comment <n> --body-file <absolute PRD path>
```

On Linear, use its MCP tools to add each file as a comment. If they are not connected, give
the user the paths to attach by hand.

### Step 9 — Wrap up

Report, compactly:
- the steps that ran and the ones skipped, and why
- the commits the user made, and the phases run on Opus
- the checks that never ran: format, lint, typecheck, the suite, and each phase `Verify` the
  `implementer` could not run
- coverage before → after
- the mutation score
- both review scores
- the findings fixed and still open
- where the docs were posted

Then stop. Opening the PR is the user's next step: offer it, do not do it.

## Handling an agent's result

The first line of every agent's final message is its RESULT line:

| RESULT | Do |
| --- | --- |
| `OK` | Show the report unchanged and move to the next step. An `implementer` report is cross-checked and reported as `references/implementation-phases.md` says |
| `NEEDS_INPUT — <question · options>` | Ask the user with `AskUserQuestion`, using those options. Then delegate again, with the missing input line filled in (`Selection:`, `Budget:`, `Code review:`) or `Answer: <question> → <user's answer>` appended. An `implementer` is resumed with `SendMessage` instead, since it may have edited files already |
| `BLOCKED — <reason · where it looked>` | Stop the chain. Report the reason, and ask whether to fix the cause and retry, or skip the step if it is optional. A required step is never skipped. **Exception:** blocked because the worktree has no installed dependencies → don't ask; park with `worktree-temp-task` and re-delegate, as in Step 5 |

A message with no RESULT line counts as `BLOCKED — agent returned no RESULT line`. Show what it
returned.

## Gotchas

- Agents run in the background, and a notification arrives when each one finishes. Never
  predict or summarize an agent's result before it arrives, and never start a step that depends
  on it.
- A permission prompt raised inside an agent reaches the user, not you. Tell them a pending
  approval may be waiting if an agent seems stuck.
- The agents' hooks need `jq` and `~/.claude/hooks/agent-guard.sh`. A denial saying
  `jq is not installed`, or a "command not found" from the hook, means the guards are off. Stop
  and report it; do not run the agent unguarded.
- `CLAUDE_CONFIG_DIR` set to anything but `~/.claude` breaks the agents' hook path, and the
  guards then fail open. Check `echo "${CLAUDE_CONFIG_DIR:-unset}"` in Step 1 and warn if it is
  set.
- The reviewers review `HEAD`, not the working tree. Uncommitted fixes are invisible to a
  re-review, so commit first.
- The hand-off record lives in `.git/worktrees/<name>/`, not in the working tree. It is never
  committed, `git status` never shows it, and `git worktree remove` deletes it along with the
  worktree. Use `--absolute-git-dir`: plain `--git-dir` is relative in the main checkout.
