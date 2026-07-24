---
description: Execute exactly one next unblocked Hungr roadmap checklist task
agent: roadmap-overnight
---

Load the `hungr-roadmap-execution` skill. Select the next appropriate unblocked item from `docs/ROADMAP_STATE.md`, execute exactly that one item end-to-end, run required verification, update its status and append the session log, then stop. Do not begin a second checklist item.

When command argument contains a task ID, automation already selected it. Verify its dependencies, then execute exactly that ID. Do not split tasks or substitute another ID in unattended mode. Automation-selected task: `$ARGUMENTS`.

Never ask an interactive question. When human input or acceptance is required, complete all safe work possible, mark item `[>]` with `Awaiting:` owner/artifact/unblock condition, and continue to final result.

Final response must end with exactly one machine-readable line using one of these forms:

`ROADMAP_RESULT: completed TASK: <ID>`
`ROADMAP_RESULT: partial TASK: <ID>`
`ROADMAP_RESULT: blocked TASK: <ID>`
`ROADMAP_RESULT: waiting TASK: <ID>`
`ROADMAP_RESULT: impasse TASK: none`
`ROADMAP_RESULT: selector_error TASK: none`

Use `impasse` only when no unblocked checklist item exists. Use `selector_error` when state is malformed or selection cannot be determined safely.

Session-log row must name selected task ID, final result word (`completed`, `partial`, `blocked`, or `waiting`), and verification actually run.
