---
name: hungr-project-workflow
description: Use for any Hungr repository task involving exploration, planning, implementation, review, documentation, or verification. Establishes source precedence, repository structure, planning conventions, and proportional test requirements.
---

# Hungr Project Workflow

## Source Precedence

Always obey nearest `AGENTS.md`.

When sources disagree, use this order:

1. Current package/configuration, application code, migrations, generated types, and tests.
2. `README.md` and `.agents/PROJECT_NOTES.md`.
3. `DESIGN_SYSTEM.md`, `DEPLOYMENT.md`, and `DEMO_AND_TEST_PLAN.md`.
4. `docs/HISTORY.md` and historical Git revisions.

Verify historical claims against current implementation before reusing patterns. Some project documents describe removed routes or older component APIs.

## Repository Map

- `app/`: Next.js routes, layouts, route handlers, and server-rendered pages.
- `components/`: UI primitives and feature components.
- `lib/auth/`: session, role, active-organisation, invitation, and impersonation rules.
- `lib/data/`: server actions and data loaders.
- `lib/supabase/`: browser, server, and admin clients.
- `lib/schemas/`: shared validation.
- `supabase/migrations/`: all committed schema changes.
- `supabase/schemas/baseline.sql`: documentation snapshot only, never a migration substitute.
- `tests/unit/`, `tests/components/`, `tests/rls/`, `tests/e2e/`: verification layers.
- `emails/`: React Email templates.

## Exploration

Before planning or editing:

1. Inspect current implementation, callers, tests, schema, and recent migrations.
2. Check `git status` and preserve unrelated worktree changes.
3. Identify tenant boundary and required role for every affected operation.
4. Identify public and dashboard routes affected by cache revalidation.
5. Find existing patterns before adding helpers or abstractions.

## Planning Documents

- Design specs: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
- Implementation plans: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`.
- Consolidated historical notes: `docs/HISTORY.md`; add only durable lessons after work is verified.
- Product-wide roadmaps may live in repository root when explicitly requested.

Design specs should include context, goal, exclusions, product behaviour, data model, authorization, errors, testing, migration, rollout, open decisions, affected files, and success criteria.

Implementation plans should include goal, architecture, stack, file map, ordered tasks, migration/type-generation steps, and exact verification commands. Treat any commit commands in historical plans as documentary; commit only when user explicitly requests it.

## Change Discipline

- Prefer smallest correct change.
- Do not add compatibility paths without a concrete persisted/external requirement.
- Keep subscription billing, public-menu behaviour, and future restaurant-order commerce as distinct domains.
- Never copy full historical file replacements without rereading current files.
- Update `.agents/PROJECT_NOTES.md`, roadmap state, or `docs/HISTORY.md` when project structure or durable conventions change.

## Verification Matrix

- Utility or server action: targeted Vitest unit tests.
- Interactive client UI: component test covering success, pending, error, and destructive/close behaviour.
- Schema, grants, or RLS: local migration, generated types, allow/deny RLS tests.
- User journey: targeted Playwright test.
- Broad/cross-cutting change: lint, full relevant Vitest projects, and production build.

Report commands actually run. Separate failures caused by current change from pre-existing/environment failures.

## References

Read as needed:

- `AGENTS.md`
- `.agents/PROJECT_NOTES.md`
- `README.md`
- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `DESIGN_SYSTEM.md`
- `DEMO_AND_TEST_PLAN.md`
- `DEPLOYMENT.md`
- `docs/HISTORY.md`
- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
