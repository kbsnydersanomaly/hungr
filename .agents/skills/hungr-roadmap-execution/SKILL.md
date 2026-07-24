---
name: hungr-roadmap-execution
description: Use when asked "do the next roadmap task", "continue the roadmap", "work the checklist", "what's next", or to work any Hungr P0-P9/D task. Selects and executes exactly one unblocked checklist item, verifies it, and records done, partial, blocked, waiting, or deferred state for the next session.
---

# Hungr Roadmap Execution

Cross-session executor for `HUNGR_PRODUCT_ROADMAP.md`. `docs/ROADMAP_STATE.md` is the only status checklist. Default behavior is to select, execute, verify, and record exactly one atomic task per session.

## Status syntax

- `[ ]`: not started
- `[-]`: partially complete and resumable; item must include `Progress:` with exact remainder
- `[x]`: complete with required verification passing
- `[!]`: blocked by a newly discovered issue; item must include `Blocked by:` with exact unblock condition
- `[>]`: waiting on a human/external owner, including required design acceptance; item must include `Awaiting:` owner/artifact/unblock condition
- `[~]`: deliberately deferred

Never treat `[!]`, `[>]`, or `[~]` as available work. Planned `Depends on:` relationships do not change checkbox status; they control selection.

## Session start (always)

1. Read `docs/ROADMAP_STATE.md` in full, including latest session-log row.
2. Read relevant `HUNGR_PRODUCT_ROADMAP.md` sections and any accepted design/plan for candidate task.
3. Load `hungr-project-workflow` always; load `hungr-next-ui-work` for UI; load `hungr-supabase-actions`, `supabase`, and Postgres guidance for schema/action/RLS work.
4. Inspect current code, tests, schema, callers, and `git status`; state may lag reality.
5. Select one task using algorithm below.
6. Report selected ID, reason, dependencies, and intended verification in a few lines, then proceed immediately. Invocation such as “continue roadmap” or `/roadmap-next` is approval to execute; do not wait for another confirmation.

## Step selection

1. If user names an ID, select it only if dependencies are satisfied; otherwise explain blocker and select no substitute unless user asked for automatic fallback.
2. Resume first `[-]` item whose dependencies remain satisfied and whose `Progress:` does not name an unresolved blocker.
3. Otherwise select first `[ ]` item in lowest active phase whose complete `Depends on:` set is `[x]`.
4. Design checkpoints precede implementation. Never select implementation under a group whose `*-design` checkpoint is not `[x]`.
5. Prefer foundation work that unlocks others, then finishing active group, then smallest independent task. Current stated priority in snapshot overrides raw file order.
6. Skip exit tasks until every required internal non-deferred item in that phase is `[x]` and named exit dependencies pass. `P0-exit` explicitly permits external `[>]` items to remain waiting.
7. Skip `[>]` external items, `[!]` blocked items, and `[~]` deferred items. Mention relevant external waits in final summary only.
8. Treat dependency ranges such as `P2-1..P2-9` as every listed item in range. A group dependency such as `P3-exit` requires that exact exit item `[x]`.

If selected item is too large for one focused session, split it before implementation into stable child IDs under same group, preserve original outcome as parent/exit criterion, record split in session log, and execute only first child.

## Start selected task

Before substantial work, change selected item from `[ ]` to `[-]` and append `Progress: started YYYY-MM-DD; next <exact file/action/command>`. Preserve any existing progress text. Generic targets are insufficient because interruption must leave an executable resume point.

If state and repository disagree, verify reality first. Correct checklist status and explain correction in append-only session log; do not redo completed work.

## During work

- Execute task end-to-end: inspect, design if selected item is design, implement, test, update durable docs, and review resulting diff.
- Follow `hungr-project-workflow`; use smallest correct changes and preserve unrelated worktree edits.
- Reference selected task ID in design/plan filenames or headers, session log, and commits only when user explicitly requests commit.
- Run verification proportional to task and all commands required by accepted design. Code work cannot become `[x]` when required tests were unavailable or failed.
- Discover necessary work: add fresh stable ID under correct group. Do not silently expand current task beyond acceptance criteria.
- Existing roadmap decision is settled. Interactive sessions may ask genuinely new product decisions. Unattended sessions never ask: mark selected item `[>]` with `Awaiting:` details, then stop that task.
- Do not commit, push, deploy, contact vendors, or claim legal/product/security approval unless user explicitly requests or provides it.

## Design checkpoints

- A design task produces focused spec under `docs/superpowers/specs/` and, only when useful, implementation plan under `docs/superpowers/plans/`.
- Agent may establish technical completeness but never supplies acceptance for any approver role, including engineering. Every required acceptance must come from a user-identified human owner.
- If required human acceptance is absent, finish draft and mark task `[>]` with `Awaiting: <owner>; provide <artifact/decision>; then <unblock action>`. In unattended mode, never ask interactively.
- Mark design `[x]` only after required acceptance is explicitly recorded with role/name and date.

## Session end (always, including interrupted sessions)

Update `docs/ROADMAP_STATE.md` before final response, even when interrupted:

1. `[x]`: outcome complete, required verification passed, and required acceptance recorded. Remove stale `Progress:` text.
2. `[-]`: useful work complete but more remains. Replace `Progress:` with exact completed work, exact remainder, and next command/file.
3. `[!]`: unexpected blocker prevents progress. Append `Blocked by:` condition and owner if known.
4. `[>]`: when human/external owner must act; include machine-readable `Awaiting:` owner, requested artifact/decision, and unblock action.
5. Update status snapshot when active phase, priority, or blockers changed.
6. Append one session-log row: date, selected ID, work done, verification actually run, result/status, exact recommended next task.
7. State newly added child IDs or corrections explicitly.

Then stop. Do not begin second checklist task in same session. Final response reports selected task status, changed files, verification, blocker/remaining work, and next candidate.

## Rules

- State file is append-honest: never delete or rewrite history rows.
- Do not duplicate roadmap content into the state file; link by section number.
- If the state file and reality disagree (e.g. code shows a step done that is unchecked), verify against code, then correct the state file and note the correction in the log.
- Never mark parent/exit task complete because children are merely planned.
- Never mark tests “passed” unless command actually ran successfully.
- Exactly one selected task per session; task splitting and state maintenance do not count as extra tasks.
