# Implementation phases through `implementer`

Read before the first phase of Step 3. `implementation-loop` runs split in two: this session
keeps its Steps 0–1 and the loop around each phase, and an `implementer` agent runs L1 to L4 for
one phase. Never implement or patch a phase here — even a one-line fix goes back to the agent —
and never send one agent more than one phase.

## Before the first phase

1. **Find the resume point.** Read the plan's build sequence and progress markers, and check
   them against `git log --oneline <base>..HEAD`, as `implementation-loop` Step 1 says. Name the
   phase you start from. Do not read the PRD or the code for it: the agent reads them, and every
   file read here stays in this session's context for the rest of the issue.
2. **No checks.** Worktrees get no dependency install, so neither this session nor the agent
   discovers or runs format, lint, typecheck or tests, and a phase's own `Verify` runs only when
   it needs no toolchain. Tell the user once, here.
3. **Offer Opus, once (Claude Code only).** Under OpenCode the implementer's model comes from
   `agents/models.json`; skip this step. Under Claude Code, scan the phases still to run for ones
   Sonnet is likely to get wrong: a data migration or backfill, transactions or concurrency, auth
   or permission rules, a contract later phases build on, or a phase the plan's risks table names.
   If any qualify, ask with `AskUserQuestion` which of them run on Opus: one option per phase with
   its reason, riskiest first, at most four, `multiSelect: true`; with a single candidate, ask
   Opus or Sonnet for it. Selecting none keeps every phase on Sonnet. No phase runs on Opus
   without the user's yes. The user may also ask for Opus on any phase later.

## Per phase

1. **Commit gate.** `git status --short` lists nothing but, at most, the plan and the PRD.
   Anything else means the last phase is not committed: ask the user to commit it, and wait. The
   agent refuses to start on top of uncommitted code.
2. **Delegate.** Claude Code: Agent tool, `subagent_type: implementer`, plus `model: "opus"` only
   for a phase the user picked. OpenCode: the `subagent` tool with agent `implementer` and its
   configured model.

   ```
   Plan:      <absolute path>
   PRD:       <absolute path | none>
   Worktree:  <absolute path>
   Phase:     <n> — <the step's name, as the plan writes it>
   ```

   Keep the agent ID from the spawn result: answers and change requests go back to that agent.
3. **Handle the RESULT line.** As in SKILL.md's "Handling an agent's result", except:
   - `NEEDS_INPUT` → ask with `AskUserQuestion`, using its options, then `SendMessage` the same
     agent ID: `Answer: <question> → <answer>`. It continues with what it already read and the
     files it already changed. Never re-delegate from scratch while it can be resumed.
   - `BLOCKED` → stop the loop and report it. Offer the next unblocked phase only if it does not
     depend on the blocked one.
   - The agent cannot be resumed → delegate a new `implementer` with the four lines plus the
     `Answer:` or `Change:` line. It picks up the uncommitted files.
4. **Cross-check `OK` without reading the diff.** The code review comes later; here, only
   confirm the report is true:
   - `git status --short` lists exactly the report's files plus the plan.
   - Every file is in the phase's `Covers:` artifacts or explained by a deviation line.
   - No new test file appeared: the agent writes none.

   Send any mismatch back to the agent with `SendMessage`, and show the user what it cannot
   explain.
5. **Report and stop.** Print `implementation-loop`'s between-iterations report from the
   agent's result:

   ```
   Phase <n> — <step name> · <the model it ran on>
   Files:       <path — what, one line each>
   Verify:      <passed — what | not run — the plan's check>
   Checks:      format, lint, typecheck and tests not run (no dependencies in the worktree)
   Run first:   <the agent's Run: commands>               (only when there are any)
   Deviations:  <one line each | none>
   Next:        phase <n+1> — <step name> | last phase
   ```

   Then the commit block, preceded by `git rm <paths>` when the agent listed `Delete:` paths, and
   wait. On "continue", go back to 1. A change request goes to the same agent as
   `Change: <request>`; report its result the same way and wait again.

## After the last phase

Print `implementation-loop`'s wrap-up recap: the phases done, the commit titles, every
deviation, and every `Verify` never run in place of "checks currently green". Say plainly that
the change carries no new tests and that no check ran on it. Then continue with SKILL.md's gate
before Step 4.
