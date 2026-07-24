# Hungr

Digital menu platform for restaurants. Build and brand menus in a dashboard, publish them at public URLs, share via QR codes, collect reviews, and track analytics. Billing is handled via PayFast (ZAR).

Built with Next.js 16, React 19, Tailwind CSS 4, and Supabase (Postgres, Auth, Storage, Realtime, Edge Functions).

## Getting started

Prerequisites: Node 22+, pnpm, Docker, and the [Supabase CLI](https://supabase.com/docs/guides/cli) (installed as a dev dependency, so `pnpm install` is enough).

`pnpm db:bootstrap` builds a complete database from empty, so a fresh clone works with no pre-existing Supabase volume.

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Supabase CLI config needs this shell variable for every CLI command.
export NEXT_PUBLIC_APP_URL=http://localhost:3000

# 3. Start the stack, apply migrations, seed, and regenerate types
pnpm db:bootstrap
# Paste the printed credentials into .env.local (see "Switching between local
# and hosted Supabase" below for the preset files).

# 4. Check the result
pnpm db:smoke

# 5. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

`pnpm db:bootstrap` accepts `--fresh` (discard the existing local volume first), `--skip-seed`, and `--skip-types`. It resolves its target from `supabase status`, never from `.env.local`, and aborts on any non-loopback API URL — `.env.local` normally points at the hosted project and `db reset` is destructive.

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest, all three projects (`node`, `components`, `rls`) — the `rls` project needs a local database |
| `pnpm test:ci` | Vitest `node` + `components` only; runs with no database and no `.env.local` |
| `pnpm test:rls` | Vitest `rls` project; requires `.env.local` pointing at a local stack |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm db:bootstrap` | Build a complete local database from empty: start, migrate, seed, regenerate types |
| `pnpm db:migrate` | Apply Supabase migrations |
| `pnpm db:reset` | Rebuild the database from `supabase/migrations/` without seeding |
| `pnpm db:seed` | Seed demo data (idempotent; refuses a non-local target) |
| `pnpm db:smoke` | Runtime checks that the Auth trigger, `review_stats`, and all five storage buckets work |
| `pnpm db:gen-types` | Regenerate `lib/database.types.ts` |
| `pnpm db:check` | Verify committed migration files appear in the database's migration history |
| `pnpm deploy:edge-functions` | Deploy Supabase edge functions |
| `pnpm mail:test <email>` | Render and send test emails |

## Switching between local and hosted Supabase

The app reads its database config from `.env.local`, which is a copy of one of
two (gitignored) presets:

| Command | Points `.env.local` at |
| --- | --- |
| `pnpm env:local` | The local Supabase instance (`127.0.0.1:54321`, console mail) |
| `pnpm env:remote` | The hosted dev project (`*.supabase.co`, Brevo mail) |
| `pnpm env:which` | Print which one is currently active |

The presets live in `.env.local-db` and `.env.remote-db` — edit those, not
`.env.local` (it gets overwritten on switch). Restart `pnpm dev` after
switching. The RLS test suite creates and deletes users, so it refuses to run
unless the active database is local (`RLS_ALLOW_REMOTE=1` overrides).

`pnpm env:local` creates `.env.local-db` on first use and refreshes it on every
switch, taking `NEXT_PUBLIC_SUPABASE_URL`, both keys, and `SUPABASE_DB_URL` from
`supabase status` — so it always matches the stack `pnpm db:bootstrap` just
built. Everything else in the file is left alone; a newly created preset copies
the shared settings from `.env.remote-db` (or `.env.example`) and forces
`MAIL_PROVIDER=console`. With the stack stopped it falls back to the existing
preset, and `pnpm env:local --no-refresh` skips the probe entirely.

`.env.remote-db` holds hosted credentials and cannot be generated — create it
from `.env.example` with the hosted project's URL and keys.

## Database baseline and migrations

`supabase/migrations/20260717120001_baseline.sql` is the single authoritative starting point. It carries the whole `public` schema **and** the non-public objects Hungr owns: the `auth.users` profile-provisioning trigger, the one-time `review_stats` population, and all five storage buckets (`menu-media`, `branding`, `invoices`, `private`, `help-media`) with their 17 policies. Its non-public statements are guarded, so re-running the file against an already-provisioned database is a no-op.

`supabase/schemas/baseline.sql` is a documentation-only snapshot of the `public` schema for reviewers. It is **not** a migration and must never be applied.

Because the baseline covers everything, `pnpm db:bootstrap` (or plain `supabase db reset`) initializes an empty database correctly, and provisioning a new hosted project is just applying migrations to it.

Schema equivalence with the hosted project is checked with the explicit form:

```bash
supabase db diff --from migrations --to linked   # expect no differences
```

Use that form, not bare `supabase db diff --linked`, which emitted a spurious drop list against an identical schema on CLI v2.106.0.

Reviewers should check that any schema-level change has a corresponding migration in `supabase/migrations/`. Schema diffs cannot see the non-public objects above, so run `pnpm db:smoke` after changing them.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to `main`.
It uses **no repository secrets**: database-free jobs run against committed
placeholder values, so fork pull requests get full CI. Node comes from `.nvmrc`
and pnpm from Corepack, which resolves the version pinned in `package.json`.

Reproduce each job locally:

| Job | Local equivalent |
|---|---|
| `lint` | `pnpm lint` |
| `typecheck` | `pnpm exec tsc --noEmit` |
| `unit` | `pnpm test:ci` (must pass with no `.env.local` present) |
| `build` | `pnpm build` |

The `unit` job is why the Vitest projects are split: `tests/rls/**` refuses to
load without a local Supabase URL, so it lives in its own `rls` project and runs
in the database job instead. `pnpm test` still runs all three.

Design and the remaining jobs (clean database bootstrap, schema/RLS checks, and
Playwright smoke tests) are specified in
`docs/superpowers/specs/2026-07-24-ci-foundation-design.md`.

## Project structure

```
app/
  (auth)/        Unified sign-in/sign-up, verify, reset, invitations
  (dashboard)/   Org dashboard, restaurants, menus, settings, admin
  m/             Public restaurant menus
  api/           Webhooks (PayFast), QR, cron, health
components/      UI, dashboard, menu, branding components
lib/             Supabase clients, auth, data actions, schemas, billing
supabase/        Migrations, config, edge functions
emails/          React Email templates
tests/           Vitest + Playwright + RLS specs
```

## Documentation

- `HUNGR_PRODUCT_ROADMAP.md`: planned product and architecture.
- `docs/ROADMAP_STATE.md`: current roadmap execution board.
- `/roadmap-next`: OpenCode command that executes exactly one next unblocked roadmap item and records its status.
- `scripts/roadmap-overnight.sh`: Linux unattended runner that starts a fresh `/roadmap-next` session repeatedly until progress reaches an impasse. Run from a disposable VM/container or dedicated non-root user with a reviewed, committed worktree and minimal credentials: `bash scripts/roadmap-overnight.sh`. Defaults cap execution at 50 sessions/12 hours; see `--help` for overrides.
- `DEPLOYMENT.md`: production setup and operational verification.
- `DESIGN_SYSTEM.md`: current UI conventions and primitives.
- `DEMO_AND_TEST_PLAN.md`: stakeholder demo, manual QA, and release smoke checks.
- `docs/HISTORY.md`: non-authoritative consolidated history.
