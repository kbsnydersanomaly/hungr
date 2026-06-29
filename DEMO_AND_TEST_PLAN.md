# Hungr — Demo & End-to-End Test Plan

Use this document to **demo the product** to stakeholders and to **manually test every major flow** from a fresh environment. It is written for local development (`http://localhost:3000`) but applies equally to a staging deployment — swap URLs and credentials as needed.

---

## Table of contents

1. [What you are testing](#1-what-you-are-testing)
2. [Environment setup](#2-environment-setup)
3. [Demo personas & accounts](#3-demo-personas--accounts)
4. [Recommended demo script (~25 min)](#4-recommended-demo-script-25-min)
5. [Full test plan by area](#5-full-test-plan-by-area)
6. [Automated tests](#6-automated-tests)
7. [API & background jobs](#7-api--background-jobs)
8. [Known gaps & out-of-scope items](#8-known-gaps--out-of-scope-items)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What you are testing

Hungr is a **digital menu SaaS** for restaurants (South Africa, ZAR billing via PayFast). The app has four surfaces:

| Surface | URL prefix | Who uses it |
|---------|------------|-------------|
| **Auth** | `/sign-in` (sign-in + embedded sign-up), `/forgot`, `/reset`, `/verify`, `/accept-invite/[token]` | New & returning users |
| **Dashboard** | `/dashboard`, `/restaurants/...`, `/settings/...`, `/insights` | Restaurant owners & staff |
| **Public menu** | `/m/[restaurantSlug]/...` | Diners (no login) |
| **Super admin** | `/admin/...` | Platform operators |

**Core capabilities to validate:**

- Account creation, email verification, password reset
- Organization tenancy (one org per signup, team roles)
- Restaurant creation → PayFast subscription checkout (sandbox)
- Menu builder (categories, items, drag-and-drop, publish)
- Branding editor with live preview
- About page, media library, QR codes
- Specials / promotions
- Public menu viewing, item detail, reviews
- Review moderation
- Org & restaurant billing, plan upgrade (Starter → Pro)
- Team invitations (org-level and restaurant-level)
- Insights / analytics dashboard
- Super admin: users, orgs, plans, subscriptions, transactions, health, impersonation

---

## 2. Environment setup

### 2.1 One-time setup

```bash
pnpm install
cp .env.example .env.local
```

Start local Supabase and paste credentials from `supabase status` into `.env.local`:

```bash
supabase start
pnpm db:migrate
pnpm db:seed          # seeds Starter / Pro / Enterprise plans
pnpm dev              # http://localhost:3000
```

### 2.2 Recommended `.env.local` for demos

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAIL_PROVIDER=console    # emails print in the terminal — great for invite/reset demos
PAYFAST_SANDBOX=true     # sandbox checkout; payments auto-complete on return in sandbox
```

Optional but useful:

```bash
CRON_SECRET=local-dev-secret        # for testing grace-period cron
NEXT_PUBLIC_POSTHOG_KEY=              # leave empty to skip analytics in dev
```

### 2.3 Email confirmation (local)

Local Supabase has `enable_confirmations = true`. After sign-up, users cannot sign in until confirmed.

**Option A — CLI (fastest for manual testing):**

```bash
pnpm db:confirm-user owner@demo.test
```

**Option B — Supabase Studio:** Auth → Users → confirm email manually.

**Option C — E2E pattern:** Playwright uses the service role to confirm users automatically (see `tests/e2e/helpers.ts`).

### 2.4 Super admin setup

Super admin is required for `/admin/*`. After creating your primary demo account:

```sql
-- Run in Supabase SQL editor or: supabase db query
UPDATE profiles
SET is_super_admin = true
WHERE email = 'owner@demo.test';
```

Then sign out and back in (or open `/admin/orgs`).

### 2.5 PayFast sandbox notes

- First restaurant on the **Starter** plan redirects to PayFast checkout.
- With `PAYFAST_SANDBOX=true`, returning from checkout auto-activates the subscription even if the webhook is delayed.
- Return URLs include `?m_payment_id=...` so the correct subscription is completed.
- For demos without leaving the app, you can stub PayFast (see [Automated tests](#6-automated-tests)) or complete sandbox checkout with test card details from PayFast docs.

### 2.6 Demo data checklist

Before a live demo, ensure:

- [ ] Plans exist (`pnpm db:seed`)
- [ ] Primary owner account confirmed
- [ ] Super admin flag set (if demoing admin)
- [ ] Dev server running (`pnpm dev`)
- [ ] Terminal visible if using `MAIL_PROVIDER=console` (for invite links)

---

## 3. Demo personas & accounts

Create these accounts for a complete walkthrough. Use `@demo.test` or similar so they are easy to find.

| Persona | Email | Role | Purpose |
|---------|-------|------|---------|
| **Owner** | `owner@demo.test` | Org owner | Main demo account; billing, team, all restaurant features |
| **Admin** | `admin@demo.test` | Org admin | Team management without owner-only actions |
| **Staff invitee** | `staff@demo.test` | Org staff | Accept invitation flow |
| **Super admin** | `owner@demo.test` + DB flag | Platform admin | `/admin/*`, impersonation |

**Suggested demo restaurant:** “The Corner Bistro”  
**Suggested menu:** “Dinner” with categories *Starters*, *Mains*, *Desserts*

---

## 4. Recommended demo script (~25 min)

Use **two browser contexts** for best effect: one logged-in dashboard (desktop), one incognito for the public menu (mobile viewport).

### Act 1 — Auth & signup (3 min)

1. Open `/` while logged out — redirect to `/sign-in`.
2. Open `/sign-in` — switch to **Sign up** and create `owner@demo.test` (cellphone required).
3. Show “Check your email” → run `pnpm db:confirm-user owner@demo.test` → log in.

**Talking point:** Sign-up auto-creates a profile and default organization.

### Act 2 — First restaurant & billing (4 min)

1. Dashboard shows empty state → **Add restaurant**.
2. Fill name, address (South African province/city) → submit.
3. Redirect to **PayFast sandbox** → complete payment → land on billing or restaurant page with success banner.
4. Show `/settings/billing` — subscription status, transaction history.
5. Show `/restaurants` — public slug `Slug: /m/the-corner-bistro`.

**Talking point:** Starter = per-restaurant billing; Pro = flat org plan (upgrade later in Act 6).

### Act 3 — Menu builder (5 min)

1. Open restaurant → **Menus** → create “Dinner”.
2. In the menu workspace:
   - Add category “Mains”
   - **Add item** — name, price (e.g. R 149.00), description, allergens, labels
   - Upload an image via **Media library** picker
   - Drag to reorder categories/items
3. Click **Publish** — status changes to published.
4. Open **QR Codes** — download PNG; note QR ties to published menu.

**Talking point:** Draft vs published; QR only works for published menus.

### Act 4 — Branding & about (4 min)

1. **Branding** — change nav bar color; show live iframe preview (dark nav → white icons).
2. Upload logo, change fonts → **Publish changes**.
3. **About** — hours, contact info, gallery images.
4. **Media** — upload assets; show usage tracking when used on items/about.

### Act 5 — Public menu (5 min)

Switch to **incognito / mobile viewport** (`375×812`):

1. Open `/m/the-corner-bistro` — branded header, menu items, prices in ZAR.
2. Tap item → item detail page, “You might also like”.
3. Submit a **review** (name, stars, text) → “Thanks, pending moderation”.
4. Open **About** via header icon or mobile nav sheet.
5. Scroll categories via mobile nav (if multiple categories).

Back in dashboard:

6. **Reviews** — approve the pending review.
7. Refresh public item page — approved review visible (if shown on detail).

**Talking point:** Public side is read-only (no ordering in v1); Order/History tabs show “Soon”.

### Act 6 — Specials, insights, team (4 min)

1. **Specials** — create a percentage discount or combo special, attach to menu/items.
2. Refresh public menu — special appears (if active and in date range).
3. **Insights** — charts populate after public menu views (may need a few page loads).
4. **Settings → Team** — invite `staff@demo.test` as Staff; copy invite URL from terminal (`MAIL_PROVIDER=console`).
5. Second browser: open invite link → sign up or accept → verify access.

**Talking point:** Org team vs restaurant-specific team (`/restaurants/[id]/team`).

### Act 7 — Super admin (optional, 3 min)

1. Open `/admin/orgs` — list organizations with metrics.
2. `/admin/users` — search users.
3. `/admin/subscriptions` — open a subscription → edit status.
4. `/admin/health` — DB latency, env info.
5. `/admin/impersonate` — impersonate a user → amber banner → **Stop impersonating**.

---

## 5. Full test plan by area

Use the checklists below for QA. Mark each row: ✅ pass / ❌ fail / ⏭ skip.

### 5.1 Public redirects

| # | Steps | Expected |
|---|-------|----------|
| M1 | Visit `/` while logged out | Redirects to `/sign-in` |
| M2 | Visit `/pricing` while logged out | Redirects to `/sign-in` |
| M3 | Visit `/contact-sales` while logged out | Redirects to `/sign-in` |
| M4 | Visit `/sign-up` (legacy) | Redirects to `/sign-in` |

### 5.2 Authentication

| # | Steps | Expected |
|---|-------|----------|
| A1 | Sign up new user | Account created; verify prompt shown |
| A2 | Sign in before verify | Blocked or error (local: must confirm first) |
| A3 | Confirm email + sign in | Redirect to `/dashboard` |
| A4 | Sign out (avatar menu) | Redirect to `/sign-in` |
| A5 | `/forgot` → submit email | Reset email in console; link works |
| A6 | Reset password via link | New password works on sign-in |
| A7 | Visit `/dashboard` logged out | Redirect to `/sign-in?next=/dashboard` |
| A8 | Sign in with `?next=/settings/profile` | Lands on profile after login (no open redirect to external URL) |

### 5.3 Dashboard shell & navigation

| # | Steps | Expected |
|---|-------|----------|
| D1 | Sidebar: Overview, Insights | Pages load |
| D2 | Restaurant breadcrumb switcher | Switches active restaurant; sidebar links update |
| D3 | Notification bell | Opens dropdown; links to notification settings |
| D4 | Avatar → Settings / Sign out | Works |
| D5 | Settings sub-nav | Active tab highlighted (Profile, Org, Team, Billing, Security, Notifications) |
| D6 | Empty dashboard (no restaurants) | CTA to add first restaurant |

### 5.4 Restaurants

| # | Steps | Expected |
|---|-------|----------|
| R1 | `/restaurants/new` — create restaurant | PayFast redirect (Starter) or direct create (existing org sub) |
| R2 | `/restaurants` list | Name, slug `/m/...`, link to manage |
| R3 | Restaurant home checklist | Progress updates as menus/branding/QR completed |
| R4 | Restaurant settings | Name/address editable |
| R5 | Create second restaurant | Second PayFast checkout or covered under Pro plan |

### 5.5 Menus

| # | Steps | Expected |
|---|-------|----------|
| MN1 | Create menu | Lands on menu workspace |
| MN2 | Add / rename / delete category | Persists after refresh |
| MN3 | Drag-and-drop reorder categories | Order saved |
| MN4 | Add item — all fields | Name, price, description, allergens, labels, options (preparations, sides, etc.) |
| MN5 | Edit item | Changes persist |
| MN6 | Drag-and-drop reorder items | Order saved |
| MN7 | Publish menu | Status = published; public URL works |
| MN8 | Unpublish menu | Public menu no longer shows menu (or shows appropriate state) |
| MN9 | Delete menu / category / item | Confirm dialogs; data removed |

### 5.6 Media library

| # | Steps | Expected |
|---|-------|----------|
| MD1 | Upload image at `/restaurants/[id]/media` | Appears in grid |
| MD2 | Pick image in item editor | Image on item |
| MD3 | Delete unused image | Removed from library |
| MD4 | Delete used image | Blocked or warning (usage tracking) |

### 5.7 Branding

| # | Steps | Expected |
|---|-------|----------|
| B1 | Change colors in editor | Live preview iframe updates |
| B2 | Dark vs light nav bar | Icon/text contrast flips in preview |
| B3 | Upload logo | Shows in preview header |
| B4 | Change fonts | Preview typography updates |
| B5 | Save draft | Autosave toast |
| B6 | Publish branding | Public menu reflects changes |
| B7 | Discard draft (if available) | Reverts to published |

### 5.8 About page

| # | Steps | Expected |
|---|-------|----------|
| AB1 | Edit about content in dashboard | Saves |
| AB2 | Add hours, phone, social links | Renders on public `/m/[slug]/about` |
| AB3 | Gallery images | Display on public about page |

### 5.9 QR codes

| # | Steps | Expected |
|---|-------|----------|
| Q1 | Open QR page with published menu | QR displayed |
| Q2 | Download PNG / SVG | Valid image files |
| Q3 | Regenerate QR | New code; old scans may invalidate depending on config |
| Q4 | Scan QR (or open `/api/qr/[menuId]`) | Redirects to public menu |

### 5.10 Specials

| # | Steps | Expected |
|---|-------|----------|
| S1 | Create item discount special | Appears in specials list |
| S2 | Set date/time/day restrictions | Only active in window on public menu |
| S3 | Create combo special | Combo price shown |
| S4 | Edit / deactivate special | Updates public menu |
| S5 | Delete special | Removed |

### 5.11 Public menu

| # | Steps | Expected |
|---|-------|----------|
| P1 | `/m/[slug]` | Default menu loads with branding |
| P2 | `/m/[slug]/[menuSlug]` | Specific menu |
| P3 | Search (if multiple items) | Filters items |
| P4 | Item detail `/m/.../item/[id]` | Full detail, images, price |
| P5 | “You might also like” | Other items from menu |
| P6 | Submit review on item | Success message; pending moderation |
| P7 | About link in header | Goes to `/m/[slug]/about` (not nested under menu slug) |
| P8 | Mobile nav sheet | Menus, categories, about |
| P9 | Bottom nav | Menu active; Order/History disabled with “Soon” |
| P10 | Multiple menus | Switcher or links between menus |

### 5.12 Reviews moderation

| # | Steps | Expected |
|---|-------|----------|
| RV1 | Pending review in dashboard | Visible in queue |
| RV2 | Approve review | Status changes; visible publicly if configured |
| RV3 | Reject review | Not shown publicly |
| RV4 | Bulk actions (if available) | Multiple reviews updated |
| RV5 | Filter by status | List filters correctly |

### 5.13 Team & invitations

| # | Steps | Expected |
|---|-------|----------|
| T1 | Org: invite by email (`/settings/team`) | Toast success; pending invitation listed |
| T2 | Open invite link logged out | Sign-up form with email pre-filled |
| T3 | Accept invite (new user) | Joins org with correct role |
| T4 | Accept invite (existing user, same email) | One-click accept |
| T5 | Wrong account signed in | “Wrong account” message + sign out option |
| T6 | Change member role | Toast; role badge updates |
| T7 | Remove member | Toast; member removed |
| T8 | Revoke pending invitation | Invitation removed |
| T9 | Restaurant team invite (`/restaurants/[id]/team`) | Restaurant-scoped staff invite |
| T10 | Owner-only role assignment | Only owner can assign Owner role |

### 5.14 Org settings

| # | Steps | Expected |
|---|-------|----------|
| O1 | Profile — name, display name | Saves |
| O2 | Organization — name | Saves |
| O3 | Security — change password | Works; re-login required |
| O4 | Notifications — toggle prefs | Saves |

### 5.15 Billing

| # | Steps | Expected |
|---|-------|----------|
| BL1 | Restaurant billing page | Subscription status, next billing date |
| BL2 | Org billing page | All org + restaurant subscriptions listed |
| BL3 | PayFast checkout → return | Green “Payment received” banner |
| BL4 | Cancel checkout | Amber cancel banner |
| BL5 | Pause subscription | Status paused; toast |
| BL6 | Resume subscription | Status active |
| BL7 | Cancel subscription | Status cancelled |
| BL8 | Transaction history filters | Search/filter works |
| BL9 | Download invoice (if available) | PDF download |
| BL10 | Upgrade to Pro (org owner) | New org-level checkout; per-restaurant subs cancelled |

### 5.16 Insights & analytics

| # | Steps | Expected |
|---|-------|----------|
| I1 | Visit public menu several times | Events recorded |
| I2 | `/insights` | Charts render (views over time, top items) |
| I3 | Dashboard overview stats | Menu views, team count, review stats update |

### 5.17 Super admin

Requires `is_super_admin = true`.

| # | Steps | Expected |
|---|-------|----------|
| AD1 | Non-admin visits `/admin` | Redirect to `/dashboard` |
| AD2 | `/admin/orgs` | Org list with metrics |
| AD3 | `/admin/users` | Searchable user list |
| AD4 | `/admin/plans` | CRUD pricing plans |
| AD5 | `/admin/subscriptions` | List + search |
| AD6 | `/admin/subscriptions/[id]` | Edit subscription, view transactions |
| AD7 | `/admin/transactions` | Payment history |
| AD8 | `/admin/health` | System health metrics |
| AD9 | `/admin/impersonate` | Impersonate user; banner; stop impersonating |
| AD10 | Admin sub-nav | Active tab highlighted |

> **Note:** `/admin/audit` is linked in the admin nav but the page is not implemented yet — expect 404 until built.

### 5.18 Impersonation

| # | Steps | Expected |
|---|-------|----------|
| IM1 | Start impersonation | Amber banner; dashboard shows target user’s data |
| IM2 | Navigate as impersonated user | RLS respects impersonated context |
| IM3 | Stop impersonation | Returns to admin impersonate page |

---

## 6. Automated tests

Run before a release or after large changes.

```bash
# Unit & component tests (no Supabase required for most)
pnpm test -- --run

# E2E — requires local Supabase + .env.local with service role key
npx playwright install chromium   # one-time
pnpm e2e
```

| Suite | File | What it covers |
|-------|------|----------------|
| Onboarding smoke | `tests/e2e/onboarding.spec.ts` | Landing, pricing, sign-up form, full onboarding |
| Menu management | `tests/e2e/menu-management.spec.ts` | Category, item, edit, publish, public menu |
| Public menu | `tests/e2e/public-menu.spec.ts` | Rendering, images, item detail, recommendations |
| Branding | `tests/e2e/branding.spec.ts` | Preview contrast, publish, live public menu |
| Components | `tests/components/*.test.tsx` | Header, ItemCard, BrandingEditor |
| RLS | `tests/rls/*.spec.ts` | Postgres policies (needs running Supabase) |

E2E helpers stub PayFast network requests so restaurant creation does not depend on the external sandbox.

---

## 7. API & background jobs

Manual checks for operators:

| Endpoint | Method | How to test |
|----------|--------|-------------|
| `/api/health` | GET | Returns 200 |
| `/api/qr/[menuId]` | GET | Redirect or QR image for published menu |
| `/api/webhooks/payfast` | POST | PayFast ITN (use sandbox payment or webhook replay tool) |
| `/api/cron/grace-period` | POST | `Authorization: Bearer $CRON_SECRET` — unpublishes restaurants after failed payment grace period |

Example cron test:

```bash
curl -X POST http://localhost:3000/api/cron/grace-period \
  -H "Authorization: Bearer local-dev-secret"
```

---

## 8. Known gaps & out-of-scope items

Do **not** expect these to work in v1 — note if stakeholders ask:

| Item | Status |
|------|--------|
| Customer ordering / cart | Not built — bottom nav shows “Soon” |
| `/admin/audit` page | Nav link exists; page not implemented |
| `/admin/orgs/[id]` detail page | “Details” link may 404 |
| In-app notifications UI | Schema exists; bell shows basic list only |
| Realtime specials on public menu | Branding realtime exists; specials may not live-update |
| Edge function `rollup_analytics` | Code exists; deploy with `pnpm deploy:edge-functions` |
| POS integration | Future |

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| “Invalid login credentials” after sign-up | Run `pnpm db:confirm-user <email>` |
| PayFast redirect loops or pending forever | Check `PAYFAST_SANDBOX=true`; ensure return URL is `localhost:3000` in `.env.local` |
| Public menu 404 | Menu must be **published**; check slug at `/restaurants` |
| Images not loading | Supabase storage configured; check `next.config.ts` remote patterns |
| Admin pages redirect to dashboard | Set `is_super_admin = true` on your profile |
| Invite link expired | Invites expire after 7 days; resend from Team page |
| Emails not arriving | Use `MAIL_PROVIDER=console` locally; check terminal output |
| RLS tests fail | Run `supabase start`; ensure migrations applied |
| E2E tests fail on PayFast | Helpers stub PayFast — ensure `.env.local` has service role key |

---

## Quick reference — important URLs

```
/                                    Redirects to /sign-in when logged out
/sign-in                             Unified auth (sign-in + embedded sign-up)
/forgot                              Password reset request
/dashboard                           Overview
/insights                            Analytics
/restaurants                         Restaurant list
/restaurants/new                     Add restaurant
/restaurants/[id]/menus/[menuId]     Menu workspace
/settings/team                       Org team
/settings/billing                    Org billing
/admin/orgs                          Super admin
/m/[restaurantSlug]                  Public menu
/m/[restaurantSlug]/about            Public about
/m/[restaurantSlug]/[menuSlug]/item/[itemId]   Item detail
```

---

*Last updated: 2026-06-11 — aligned with Next.js 16 app router routes and local Supabase dev workflow.*
