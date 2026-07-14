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

## Database baseline and migrations

`supabase/schemas/baseline.sql` is a documentation-only snapshot of the production `public` schema. It is **not** a migration. To rebuild an environment from scratch:

1. Start a fresh local Supabase instance (`supabase start` or `supabase db reset`).
2. Apply migrations with `pnpm db:migrate` (runs `supabase migration up`).
3. Seed demo data with `pnpm db:seed`.

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
