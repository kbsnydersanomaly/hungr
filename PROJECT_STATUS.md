# Hungr Rebuild — Master Status Document

> **Single source of truth. Replaces:** `REBUILD_STATUS_REPORT.md`, `REBUILD_GAP_ANALYSIS.md`, `QA_TEST_PLAN.md`, `ISSUE_FIX_PLAN.md`  
> **Last verified:** 2026-05-13  
> **Build:** ✅ `pnpm build` passes (50 routes, no errors, no warnings)  
> **Framework:** Next.js 16.2.4 + Supabase + Tailwind v4 + shadcn/ui

---

## 1. Executive Summary

The rebuild is **~95% feature-complete** and **builds cleanly**. Previous status reports were significantly outdated — most items marked "not started" or "placeholder" were already fully built and functional.

**What's done:** Auth, dashboard shell, public menu viewer, restaurant/menu CRUD (with drag-drop), branding editor, about editor, media library, QR management, specials, reviews moderation, team/invitations, PayFast checkout + ITN webhook, invoice PDFs, billing UI (org + per-restaurant), plan change flow, grace period cron, super admin pages (users, orgs, plans, subscriptions, transactions, health, impersonation), insights dashboard with Recharts, analytics tracking, audit logs, impersonation, contact-sales, Playwright smoke tests.

**What's NOT done:** Edge function deployment (code written, not deployed), some UI polish, notifications UI (schema exists, no UI).

---

## 2. Build Verification

```bash
cd rebuild && pnpm build
```

**Result:** ✅ Passes — compiled in ~14s, TypeScript in ~18s, static pages generated.

**No warnings:** Middleware deprecation resolved (`middleware.ts` → `proxy.ts`).

---

## 3. Route Inventory (Verified)

| Route | Status | Notes |
|-------|--------|-------|
| `/` | ✅ | Redirects logged-out users to `/sign-in` |
| `/sign-in` | ✅ | Unified auth page (sign-in + embedded sign-up) |
| `/forgot`, `/reset`, `/verify` | ✅ | Full auth flow |
| `/accept-invite/[token]` | ✅ | Signed-in + sign-up-and-accept |
| `/dashboard` | ✅ | Real stats, checklist |
| `/insights` | ✅ | Recharts: line, pie, bar charts + top items |
| `/restaurants` | ✅ | List + empty state |
| `/restaurants/new` | ✅ | `createRestaurantAndSubscribe` → PayFast |
| `/restaurants/[id]` | ✅ | Setup checklist |
| `/restaurants/[id]/menus` | ✅ | Menu list |
| `/restaurants/[id]/menus/new` | ✅ | Create menu |
| `/restaurants/[id]/menus/[menuId]` | ✅ | Workspace: D&D reorder, item CRUD, MediaPicker |
| `/restaurants/[id]/specials` | ✅ | Full specials + combos |
| `/restaurants/[id]/branding` | ✅ | Side-by-side preview, publish/discard |
| `/restaurants/[id]/about` | ✅ | Editor with MediaPicker |
| `/restaurants/[id]/qr` | ✅ | PNG/SVG download, regenerate |
| `/restaurants/[id]/reviews` | ✅ | Moderation queue, filters, bulk actions |
| `/restaurants/[id]/media` | ✅ | Upload, grid, delete, usage tracking |
| `/restaurants/[id]/team` | ✅ | Restaurant-level team |
| `/restaurants/[id]/billing` | ✅ | Subscription + transactions |
| `/restaurants/[id]/settings` | ✅ | Basic settings |
| `/settings/profile` | ✅ | Display + edit |
| `/settings/organization` | ✅ | Name edit |
| `/settings/security` | ✅ | Password change |
| `/settings/notifications` | ✅ | Preferences |
| `/settings/billing` | ✅ | Org-level billing, upgrade to Pro |
| `/settings/team` | ✅ | Org-level team |
| `/admin` | ✅ | Admin landing |
| `/admin/users` | ✅ | Searchable user list |
| `/admin/orgs` | ✅ | Org list with metrics |
| `/admin/plans` | ✅ | Plan CRUD |
| `/admin/subscriptions` | ✅ | Sub list + search + force status |
| `/admin/subscriptions/[id]` | ✅ | **NEW** — Full edit form + transaction history |
| `/admin/transactions` | ✅ | Transaction list + search |
| `/admin/health` | ✅ | **NEW** — DB latency, webhooks, queue depth, env info |
| `/admin/impersonate` | ✅ | Search + impersonate + banner |
| `/m/[slug]`, `/m/[slug]/[menuSlug]` | ✅ | Public menu viewer |
| `/m/[slug]/item/[itemId]` | ✅ | Item detail + reviews |
| `/m/[slug]/about` | ✅ | About page viewer |
| `/api/webhooks/payfast` | ✅ | Full ITN handling |
| `/api/health` | ✅ | Health check endpoint |
| `/api/qr/[menuId]` | ✅ | QR generation |
| `/api/cron/grace-period` | ✅ | Cron-protected grace period |

---

## 4. Feature Deep-Dive

### 4.1 Authentication & User Management

| Feature | Status | Files |
|---------|--------|-------|
| Email/password auth | ✅ | Supabase Auth |
| Password reset | ✅ | `sendMail("password-reset")` |
| Email verification | ✅ | Sign-up flow |
| Org auto-creation on signup | ✅ | Trigger |
| Team invitations | ✅ | `lib/data/team-actions.ts` |
| Role changes | ✅ | Owner/Admin/Staff/Member |
| Accept invite (signed-in + new user) | ✅ | `/accept-invite/[token]` |
| Impersonation | ✅ | `lib/auth/impersonation.ts`, amber banner |

### 4.2 Restaurant & Menu CRUD

| Feature | Status | Files |
|---------|--------|-------|
| Create restaurant | ✅ | `createRestaurantAndSubscribe` |
| Multi-menu support | ✅ | `menus` table |
| Category CRUD | ✅ | Drag-drop reorder |
| Item CRUD | ✅ | Advanced fields, MediaPicker |
| Item drag-drop reorder | ✅ | `@dnd-kit/sortable` |
| Auto QR on publish | ✅ | `menus.qr_code_id` |
| Setup checklist | ✅ | Restaurant detail page |

### 4.3 Branding & Content

| Feature | Status | Files |
|---------|--------|-------|
| Branding editor | ✅ | Side-by-side iframe preview |
| CSS vars injection | ✅ | Public menu viewer |
| Draft vs published | ✅ | `branding_drafts` table |
| About page editor | ✅ | Markdown-style editor |
| Media library | ✅ | Upload, grid, picker, delete |
| Usage tracking | ✅ | `media_usage` table |

### 4.4 Billing & Payments (PayFast)

| Feature | Status | Files |
|---------|--------|-------|
| PayFast checkout | ✅ | `lib/billing/payfast.ts` |
| ITN webhook | ✅ | Signature verify, validation, idempotency |
| Transaction recording | ✅ | `transactions` table |
| Subscription state mgmt | ✅ | Active/paused/failed/cancelled |
| Receipt email (COMPLETE) | ✅ | `sendMail("payment-receipt")` |
| Failure email (FAILED) | ✅ | `sendMail("payment-failed")` |
| Invoice PDF generation | ✅ | `@react-pdf/renderer`, sequential numbering |
| Invoice storage | ✅ | Supabase Storage `invoices` bucket |
| Pause/cancel/resume APIs | ✅ | PayFast API calls |
| Plan change (Starter → Pro) | ✅ | `lib/data/plan-change-actions.ts` |
| Grace period cron | ✅ | `vercel.json` + `/api/cron/grace-period` |
| Per-restaurant billing UI | ✅ | `/restaurants/[id]/billing` |
| Org billing UI | ✅ | `/settings/billing` |

### 4.5 Super Admin

| Feature | Status | Files |
|---------|--------|-------|
| Users list + search | ✅ | `/admin/users` |
| Orgs list + metrics | ✅ | `/admin/orgs` |
| Plans CRUD | ✅ | `/admin/plans` |
| Subscriptions list + search | ✅ | `/admin/subscriptions` |
| **Subscription detail + override** | ✅ | `/admin/subscriptions/[id]` |
| Transactions list + search | ✅ | `/admin/transactions` |
| **Health dashboard** | ✅ | `/admin/health` |
| Impersonation | ✅ | `/admin/impersonate` |
| Audit logs | ✅ | `lib/utils/audit.ts`, written by key actions |

### 4.6 Analytics & Insights

| Feature | Status | Files |
|---------|--------|-------|
| Event tracking (view/search/click) | ✅ | `trackEvent` in MenuView + ItemCard |
| `analytics_events` table | ✅ | Inserted from public viewer |
| `analytics_daily` table | ✅ | Schema ready |
| Insights dashboard | ✅ | Recharts: line, pie, bar, top items |
| Dashboard "Menu views" stat | ✅ | Real query |
| Rollup edge function | ✅ | `supabase/functions/rollup_analytics/index.ts` |
| **PostHog** | ✅ | `PostHogProvider.tsx`, `$pageview` capture |

### 4.7 Email

| Template | Status |
|----------|--------|
| Invitation | ✅ |
| Password reset | ✅ |
| Payment receipt | ✅ |
| Payment failed | ✅ |
| Contact sales | ✅ |
| Plan changed | ✅ |
| Welcome | ✅ |
| Member removed | ✅ |
| Role changed | ✅ |
| Restaurant unpublished | ✅ |

---

## 5. Data Model

All tables created with RLS policies. Key tables:

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (trigger-created) |
| `organizations` | Orgs (trigger-created on signup) |
| `organization_members` | Org membership + role |
| `restaurants` | Restaurant entities |
| `restaurant_members` | Restaurant-level membership |
| `invitations` | Pending invites |
| `menus`, `categories`, `menu_items` | Menu structure |
| `specials`, `special_targets` | Time-limited offers |
| `branding`, `branding_drafts` | Published + draft branding |
| `about_pages` | About content |
| `reviews`, `review_stats` | Reviews + materialized stats |
| `media`, `media_usage` | File storage + usage tracking |
| `plans` | Pricing plans (Starter/Pro/Enterprise) |
| `subscriptions` | Recurring subscriptions |
| `transactions` | PayFast payment records |
| `invoices` | Generated invoices |
| `invoice_counters` | Per-org sequential numbering |
| `notifications` | User notifications (schema only, no UI) |
| `audit_logs` | Action audit trail |
| `analytics_events` | Raw event stream |
| `analytics_daily` | Rolled-up daily aggregates |

---

## 6. Known Issues & Fix Status

| # | Issue | Status | Fix |
|---|-------|--------|-----|
| 1 | `middleware.ts` deprecated | ✅ **Fixed** | Renamed → `proxy.ts` |
| 2 | Recharts `any` cast | ✅ **Fixed** | `PieLabelRenderProps` + narrow body cast |
| 3 | Supabase `.update()` `any` casts | ✅ **Fixed** | `Database['...']['Update']` types |
| 4 | Invoice race condition | ✅ **Fixed** | Atomic RPC `increment_invoice_counter()` with `FOR UPDATE` |
| 5 | Edge function not deployed | 📝 **Ops** | `pnpm deploy:edge-functions` (requires `supabase login`) |
| 6 | `CRON_SECRET` needs real value | 📝 **Ops** | Generate + set in Vercel dashboard |
| 7 | Playwright dep name | ✅ **Fixed** | `@playwright/test` in `package.json` |
| 8 | PostHog key optional | ✅ **By design** | Gracefully skips init if empty |

---

## 7. Testing Guide

### 7.1 Unit / Integration

```bash
cd rebuild
pnpm test        # Vitest
```

### 7.2 E2E (Playwright)

```bash
npx playwright install chromium   # one-time
pnpm e2e                          # run all tests
npx playwright test tests/e2e/onboarding.spec.ts   # single test
```

### 7.3 Manual Smoke Tests

| Flow | Steps |
|------|-------|
| **Onboarding** | Sign up → verify email → create restaurant → PayFast sandbox checkout → land on dashboard |
| **Menu creation** | Create menu → add category → add item with image → publish → check QR |
| **Public menu** | Open `/m/[slug]/[menuSlug]` → search → click item → submit review |
| **Team invite** | Settings → Team → Invite by email → accept from email → verify access |
| **Billing** | Create restaurant → complete payment → check `/settings/billing` → test pause/resume |
| **Admin** | Set `is_super_admin=true` on profile → visit `/admin/health`, `/admin/subscriptions` |
| **Impersonation** | `/admin/impersonate` → search user → Impersonate → amber banner → Stop |

---

## 8. Deployment Checklist

- [ ] All env vars set in Vercel (see `.env.example`)
- [ ] Supabase migrations applied: `supabase migration up`
- [ ] Supabase Edge Function deployed: `pnpm deploy:edge-functions`
- [ ] Storage bucket `invoices` created (private)
- [ ] `CRON_SECRET` set in Vercel
- [ ] PayFast production credentials swapped in
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` set (optional)
- [ ] Playwright smoke tests pass: `pnpm e2e`
- [ ] Build passes: `pnpm build`

---

## 9. Environment Variables

See `.env.example` for full list. Key vars:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PAYFAST_MERCHANT_ID=
PAYFAST_MERCHANT_KEY=
PAYFAST_PASSPHRASE=
MAIL_HOST= / MAIL_USER= / MAIL_PASS=
CRON_SECRET=<random-32-byte-hex>
NEXT_PUBLIC_POSTHOG_KEY=<optional>
```

---

## 10. Design System Summary

| Token | Value |
|-------|-------|
| Body font | Poppins (300–700) |
| Heading font | Figtree (400–900) |
| Radius | 0.625rem |
| Sidebar | 260px fixed |
| Icons | `lucide-react` only |
| Colors | Tailwind v4 `oklch()` tokens + dark mode |
| Components | shadcn/ui primitives in `components/ui/` |

Full details: `DESIGN_SYSTEM.md`

---

## 11. Architecture Decisions

| # | Decision | Status |
|---|----------|--------|
| 1 | PayFast only | ✅ |
| 2 | Tiered plans (Starter/Pro/Enterprise) | ✅ |
| 3 | Multiple menus per restaurant | ✅ |
| 4 | v1 read-only (no customer ordering) | ✅ |
| 5 | English-only, i18n-ready schema | ✅ |
| 6 | Hard cutover (no migration code) | ✅ |
| 7 | Side-by-side branding compare | ✅ |
| 8 | Single domain (`/m/{slug}`) | ✅ |
| 9 | Fancy super admin | ✅ |
| 10 | Brevo with adapter | ✅ |
| 11 | Starter discount = flat 10% | ✅ |
| 12 | No free trial | ✅ |
| 13 | ZAR only | ✅ |

---

## 12. Remaining Gaps (Real)

These are genuinely not built or need work:

| # | Gap | Priority | Notes |
|---|-----|----------|-------|
| 1 | **Notifications UI** | Low | `notifications` table exists, no frontend |
| 2 | **Full item detail polish** | Low | Missing: combo block, image zoom, recommended items, menu switcher |
| 3 | **Specials slider styling** | Low | Skeleton exists, needs visual polish |
| 4 | **Realtime specials** | Low | Branding channel exists, specials not realtime |
| 5 | **PostgreSQL full-text search** | Low | `tsvector` not added; client-side search works fine |
| 6 | **POS integration** | Future | Extension point only |

---

## 13. File Index (Key)

```
app/
  layout.tsx                    # Root layout with PostHogProvider
  (dashboard)/layout.tsx        # Dashboard shell + sidebar
  (dashboard)/
    dashboard/page.tsx
    insights/page.tsx           # Recharts dashboard
    admin/
      health/page.tsx           # System health
      users/page.tsx
      orgs/page.tsx
      plans/page.tsx
      subscriptions/page.tsx
      subscriptions/[id]/page.tsx   # Subscription detail/edit
      transactions/page.tsx
      impersonate/page.tsx
    settings/
      billing/page.tsx          # Org billing + upgrade to Pro
      profile/page.tsx
      organization/page.tsx
      security/page.tsx
      notifications/page.tsx
      team/page.tsx
    restaurants/
      [id]/
        page.tsx
        menus/[menuId]/page.tsx
        branding/page.tsx
        about/page.tsx
        qr/page.tsx
        reviews/page.tsx
        media/page.tsx
        specials/page.tsx
        team/page.tsx
        billing/page.tsx
  api/
    webhooks/payfast/route.ts   # ITN handler
    cron/grace-period/route.ts  # Grace period cron
    health/route.ts
    qr/[menuId]/route.ts
  (public)/
    m/[slug]/[menuSlug]/page.tsx   # Public menu viewer

components/
  ui/                           # shadcn primitives
  dashboard/
    InsightsDashboard.tsx
    ImpersonationBanner.tsx
  analytics/PostHogProvider.tsx

lib/
  data/
    admin-actions.ts            # Super admin CRUD
    analytics-actions.ts        # Analytics queries
    billing-actions.ts          # Billing queries
    plan-change-actions.ts      # Starter → Pro
    team-actions.ts             # Invites, roles
    restaurants-actions.ts      # Restaurant CRUD
    menu-actions.ts             # Menu/item CRUD
  billing/
    payfast.ts                  # Checkout builder, API calls
    invoice.tsx                 # React PDF renderer
    invoice-store.ts            # Invoice creation + atomic counter RPC
  auth/
    impersonation.ts            # Impersonation cookies
    active-org.ts               # Active org resolution
    role.ts                     # Role helpers
  utils/
    audit.ts                    # writeAudit() helper
    money.ts                    # formatZar, parseZar

supabase/
  migrations/                   # All schema migrations
  functions/rollup_analytics/index.ts   # Edge function (not deployed)
```

---

## 14. Scripts

```bash
pnpm dev                    # Start dev server
pnpm build                  # Production build
pnpm start                  # Start production server
pnpm test                   # Vitest
pnpm e2e                    # Playwright
pnpm db:migrate             # Apply Supabase migrations
pnpm db:seed                # Seed plans
pnpm db:gen-types           # Regenerate database.types.ts
pnpm deploy:edge-functions  # Deploy edge functions
```

---

*This document is the single source of truth. Update it when adding major features or fixing issues.*
