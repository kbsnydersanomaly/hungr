# Hungr

Digital menu platform for restaurants. Build and brand menus in a dashboard, publish them at public URLs, share via QR codes, collect reviews, and track analytics. Billing is handled via PayFast (ZAR).

Built with Next.js 16, React 19, Tailwind CSS 4, and Supabase (Postgres, Auth, Storage, Realtime, Edge Functions).

## Getting started

Prerequisites: Node 20+, pnpm, and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Start local Supabase, then paste credentials from `supabase status` into .env.local
supabase start

# 3. Apply migrations and seed data
pnpm db:migrate
pnpm db:seed

# 4. Run the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit/component tests |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm db:migrate` | Apply Supabase migrations |
| `pnpm db:reset` | Reset the local database |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:gen-types` | Regenerate `lib/database.types.ts` |
| `pnpm deploy:edge-functions` | Deploy Supabase edge functions |

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

## Database baseline and migrations

`supabase/schemas/baseline.sql` is a documentation-only snapshot of the production `public` schema. It is **not** a migration. To rebuild an environment from scratch:

1. Start a fresh local Supabase instance (`supabase start` or `supabase db reset`).
2. Apply the baseline: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/schemas/baseline.sql`.
3. Apply migrations with `pnpm db:migrate` (runs `supabase migration up`).
4. Seed demo data with `pnpm db:seed`.

Note the baseline only covers the `public` schema. Objects outside it (the `on_auth_user_created` trigger on `auth.users`, storage buckets and their policies) are restored by the `20260714150000_restore_non_public_schema_objects` migration in step 3 — if signups or uploads fail after a rebuild, check that it ran.

Reviewers should check that any schema-level change has a corresponding migration in `supabase/migrations/`; the baseline makes the starting state visible.

## Project structure

```
app/
  (marketing)/   Landing, pricing, contact
  (auth)/        Sign in/up, verify, reset, invitations
  (dashboard)/   Org dashboard, restaurants, menus, settings, admin
  m/             Public restaurant menus
  api/           Webhooks (PayFast), QR, cron, health
components/      UI, dashboard, menu, branding components
lib/             Supabase clients, auth, data actions, schemas, billing
supabase/        Migrations, config, edge functions
emails/          React Email templates
tests/           Vitest + Playwright + RLS specs
```

See `PROJECT_STATUS.md` and `DESIGN_SYSTEM.md` for more detail.
