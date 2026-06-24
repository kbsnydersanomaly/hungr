# Design: AI-Coder Prompts from `improvements.txt`

## Objective

Convert `/home/kb/Projects/hungr/docs/improvements.txt` into a set of standalone, full-spec prompts that an AI coder can execute independently.

## Context

`improvements.txt` contains a list of bugs, UX improvements, and feature requests for the Hungr digital-menu platform. The project is built with Next.js 16, React 19, Tailwind CSS 4, Supabase (Postgres, Auth, Storage), and PayFast billing. Conventions are documented in `DESIGN_SYSTEM.md` and `README.md`.

## Decisions

- **Granularity:** One prompt per distinct feature or bug. This maximizes parallelization and keeps each prompt focused.
- **Prompt style:** Full spec-style prompts. Each prompt includes Context, Goal, Acceptance Criteria, Relevant Files/Patterns, Implementation Notes, and Testing.
- **Output format:** A single markdown file `docs/improvements-prompts.md` containing all prompts as top-level sections. This is easier to distribute and review than 15 separate files.
- **Order:** Prompts follow the order in `improvements.txt` to preserve the original priority/grouping.

## Prompt Decomposition

| # | Prompt Title | Source |
|---|---|---|
| 1 | Add loading + disabled state to "Add" buttons | General |
| 2 | Delete draft and published menus | Menus #1 |
| 3 | Bulk menu upload via CSV/Excel modal | Menus #2 |
| 4 | Search bar for media upload panel | Media |
| 5 | Cancel/pause subscription via PayFast | Subscriptions #1 |
| 6 | Hide public menus + show fixed notification when subscription invalid | Subscriptions #2 |
| 7 | Payment retry link + restrict dashboard when unpaid | Subscriptions #3 |
| 8 | Rework team members section / fix invites flow | Team members #1 |
| 9 | Allow team members to switch organisations | Team members #2 |
| 10 | Team member list: edit permissions, delete, promote | Team members #3 |
| 11 | Fix branding save reliability + replace discard icon with delete button | Branding #1 |
| 12 | Add undo + obvious publish-to-apply button in branding | Branding #2 |
| 13 | Build super-admin editable help/FAQ section | Help section |
| 14 | Add back button on public menu about page | Menu #1 |
| 15 | Enforce menu hiding when subscription is paused/cancelled | Menu #2 |

## Standard Prompt Template

Each prompt will contain:

1. **Title** — clear action statement.
2. **Context** — current behavior and why it matters.
3. **Goal** — desired end state.
4. **Acceptance Criteria** — specific, testable behaviors.
5. **Relevant Files / Patterns** — where to look, including `DESIGN_SYSTEM.md` patterns, `README.md` structure, and likely route/component locations.
6. **Implementation Notes** — hints, edge cases, external docs (e.g., PayFast), and integration points.
7. **Testing** — manual, unit, component, or e2e verification steps.
8. **Priority / Order** — implied sequence from `improvements.txt`.

## Out of Scope

- This design only covers prompt generation, not implementation of the improvements themselves.
- No new code will be written in this phase.

## Success Criteria

- All items from `improvements.txt` are represented as prompts.
- Each prompt is self-contained and actionable without reading the original file.
- The generated file is saved to `docs/improvements-prompts.md`.
