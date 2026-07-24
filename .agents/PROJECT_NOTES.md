# Hungr — Project Notes

## What it is
SaaS digital-menu platform for restaurants (South Africa / PayFast in ZAR).
Owners/staff build menus, publish public URLs, share QR codes, collect reviews, and view analytics.

## Tech stack
- Next.js 16.2.4 (App Router) + React 19.2.4 + TypeScript 5
- Tailwind CSS v4 (`@tailwindcss/postcss`) + shadcn/ui (`components/ui/`)
- Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- PayFast for payments (custom integration)
- React Email + Resend/Brevo for mail
- Vitest + Playwright for tests
- pnpm package manager

## Key directories
- `app/(auth)/` — unified sign-in/sign-up, verify, forgot/reset, accept-invite
- `app/(dashboard)/` — authenticated app shell + dashboard pages
- `app/m/` — public branded menu viewer
- `app/api/` — webhooks (PayFast, QR, cron, health)
- `components/ui/` — shadcn primitives
- `components/dashboard/`, `components/menu/`, `components/branding/`, `components/reviews/` — feature components
- `lib/auth/`, `lib/billing/`, `lib/data/`, `lib/mail/`, `lib/supabase/`, `lib/schemas/` — server/utility code
- `supabase/migrations/` — Postgres schema + RLS
- `supabase/functions/rollup_analytics/` — analytics aggregation edge function
- `emails/` — React Email templates
- `tests/` — Vitest (unit/component/RLS) + Playwright (e2e)

## Important routes
- `/dashboard` — overview
- `/restaurants` — list
- `/restaurants/new` — create + subscribe
- `/restaurants/[id]/menus/[menuId]` — D&D menu workspace
- `/restaurants/[id]/branding` — side-by-side branding editor
- `/restaurants/[id]/qr` — QR manager
- `/restaurants/[id]/reviews` — review moderation
- `/settings/billing` — org billing
- `/admin/*` — super admin
- `/m/[restaurantSlug]` — public menu

## Auth & access
- Supabase Auth email/password + email confirmation
- Org roles: `owner` (100) → `admin` (80) → `manager` (60) → `staff` (40)
- Restaurant roles: `manager`, `staff`
- RLS is the main defense; helpers in `lib/auth/role.ts`
- Active org/restaurant via cookies `active_org` and `active_restaurant`
- Super-admin impersonation via `impersonate_user_id` cookie

## Data patterns
- Server actions in `lib/data/` (zod parse → Supabase → `safeAction()` → revalidate)
- SSR server client: `lib/supabase/server.ts`
- Browser client: `lib/supabase/client.ts`
- Admin/service-role: `lib/supabase/admin.ts`
- Types: `lib/database.types.ts` (regenerate with `pnpm db:gen-types`)
- Storage buckets: `menu-media` (public), `branding` (public), `invoices` (private), `private`

## Notable components
- `MenuWorkspace` — `@dnd-kit` drag-and-drop categories/items
- `BrandingEditor` — iframe preview + postMessage + autosave drafts
- `MenuView` — public menu with search/filter/specials/reviews

## Conventions
- Use `lucide-react` only for icons
- Server action pattern: zod → Supabase → `safeAction()` → toast + redirect
- File names: `page.tsx`, `layout.tsx`, `actions.ts`; kebab-case client components
- Fonts: Poppins (body), Figtree (heading)
- Radius base `0.625rem`; use `rounded-lg`, `rounded-md`, `rounded-xl`
- Add shadcn: `npx shadcn@latest add <component> --yes --overwrite`

## Local dev
```bash
pnpm install
cp .env.example .env.local
export NEXT_PUBLIC_APP_URL=http://localhost:3000
supabase start
pnpm db:migrate
pnpm db:seed           # only if plans is empty; inserts are not idempotent
pnpm dev
```
Confirm local emails with `pnpm db:confirm-user <email>`.

## Tests
```bash
pnpm test -- --run      # Vitest unit/component/RLS
pnpm e2e                # Playwright
```

## Deployment
- Link and run `supabase db push`; the single baseline migration initializes an empty project too
- `pnpm db:seed` is idempotent but refuses a non-local target — set `SEED_ALLOW_REMOTE=1` to seed hosted deliberately
- Configure Auth Site URL + Redirect URLs
- Optional: `supabase functions deploy rollup_analytics`
- Create first super admin: `UPDATE profiles SET is_super_admin = true WHERE email = '...'`
- Vercel import, set env vars, register PayFast ITN URL `/api/webhooks/payfast`
- Cron: `/api/cron/grace-period` daily at 02:00 UTC via `vercel.json` (Hobby-compatible), expects `Authorization: Bearer $CRON_SECRET`

## Key env vars
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX`
- `MAIL_PROVIDER`, `MAIL_FROM`, `RESEND_API_KEY` / `BREVO_API_KEY`
- `CRON_SECRET`, `INVOICE_NUMBER_PREFIX`

## Warnings / gotchas
- Next.js 16 has breaking changes — check `node_modules/next/dist/docs/` before writing Next.js code
- `pnpm db:bootstrap [--fresh]` builds a complete database from empty; `pnpm db:smoke` proves the non-public Auth/Storage objects a schema diff cannot see
- `docs/ROADMAP_STATE.md` is roadmap-progress truth; code, migrations, and tests are implementation truth
- `docs/HISTORY.md` is archival and non-authoritative
- Public menu is read-only (no ordering yet)
- ZAR-only, PayFast-only, no free trial
