# Hungr — Deploy to Supabase + Vercel

Step-by-step guide to go from local dev to a live production site.

**Prerequisites:** GitHub repo, [Supabase](https://supabase.com) account, [Vercel](https://vercel.com) account, domain (optional), PayFast merchant account (for billing), Resend or Brevo account (for email).

---

## Part 1 — Supabase (database, auth, storage)

### 1. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Choose region (pick one close to South Africa if most users are ZA).
3. Set a strong database password and save it in a password manager.
4. Wait for the project to finish provisioning.

### 2. Note your credentials

In **Project Settings → API**, copy:

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (**server only — never expose to browser**) |

### 3. Link the CLI and push migrations

From the repo root:

```bash
pnpm install
supabase login
supabase link --project-ref YOUR_PROJECT_REF   # ref is in Project Settings → General
supabase db push                                 # applies all files in supabase/migrations/
```

This creates tables, RLS policies, functions, and storage buckets (`menu-media`, `branding`, `invoices`, `private`).

**Verify:** Supabase Dashboard → **Table Editor** — you should see `profiles`, `organizations`, `restaurants`, `menus`, etc.

### 4. Seed pricing plans

Point your local env at the **remote** project temporarily, or run seed with inline env:

```bash
# Option A: put remote credentials in .env.local, then:
pnpm db:seed

# Option B: one-off
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
pnpm db:seed
```

**Verify:** **Table Editor → `plans`** — Starter, Pro, Enterprise rows exist.

### 5. Configure Auth

**Authentication → URL Configuration**

| Setting | Value |
|---------|--------|
| Site URL | `https://your-domain.com` (or `https://your-app.vercel.app` until custom domain is ready) |
| Redirect URLs | Add all of these (one per line): |
| | `https://your-domain.com/**` |
| | `https://your-app.vercel.app/**` |
| | `http://localhost:3000/**` (keep for local dev) |

**Authentication → Providers → Email**

- Enable Email provider.
- For production, configure **SMTP** (Supabase custom SMTP) *or* rely on Supabase’s built-in mail (limited; fine for early testing).
- Leave **Confirm email** enabled unless you intentionally want instant access.

**Email templates (optional):** Customize confirm / reset templates under **Authentication → Email Templates**.

### 6. Storage

Migrations create buckets automatically. Confirm under **Storage**:

| Bucket | Public? | Purpose |
|--------|---------|---------|
| `menu-media` | Yes | Menu item images |
| `branding` | Yes | Logos |
| `invoices` | No | PDF invoices |
| `private` | No | User-private files |

No extra setup required if migrations applied cleanly.

### 7. (Optional) Deploy analytics edge function

```bash
supabase functions deploy rollup_analytics
```

Schedule it later (Supabase cron or external) if you want daily analytics rollups. The app works without it; insights use raw events.

### 8. Create your first super admin

After you sign up on the live site once:

```sql
-- Supabase Dashboard → SQL Editor
UPDATE profiles
SET is_super_admin = true
WHERE email = 'you@yourdomain.com';
```

---

## Part 2 — Vercel (Next.js app)

### 1. Import the repository

1. [vercel.com/new](https://vercel.com/new) → Import your GitHub repo.
2. Framework preset: **Next.js** (auto-detected).
3. Build command: `pnpm build` (Vercel detects this if `packageManager` is set in `package.json`).
4. Install command: `pnpm install`.

### 2. Set environment variables

**Project → Settings → Environment Variables.** Add for **Production** (and Preview if you want staging):

#### Required

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com          # must match live URL (no trailing slash)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

PAYFAST_MERCHANT_ID=your-live-id
PAYFAST_MERCHANT_KEY=your-live-key
PAYFAST_PASSPHRASE=your-live-passphrase
PAYFAST_SANDBOX=false                                # true only for sandbox testing on preview

MAIL_PROVIDER=resend                                 # or brevo — not console in prod
MAIL_FROM=hello@yourdomain.com                       # must be verified with provider
MAIL_FROM_NAME=Hungr
RESEND_API_KEY=re_...                                # if MAIL_PROVIDER=resend
# BREVO_API_KEY=...                                  # if MAIL_PROVIDER=brevo

CRON_SECRET=<random-32+-char-secret>               # openssl rand -hex 32
INVOICE_NUMBER_PREFIX=HUNGR
LOG_LEVEL=info
```

#### Optional

```bash
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
```

**Important:** Redeploy after changing env vars.

### 3. Deploy

Click **Deploy**. Vercel runs `pnpm build` and hosts the app.

**Verify:** Visit `https://your-app.vercel.app/api/health` — should return OK.

### 4. Custom domain (recommended)

1. **Project → Settings → Domains** → Add `yourdomain.com` and `www`.
2. Add the DNS records Vercel shows (usually `A` / `CNAME`).
3. Update `NEXT_PUBLIC_APP_URL` to `https://yourdomain.com`.
4. Update Supabase **Site URL** and **Redirect URLs** to the custom domain.
5. Redeploy.

---

## Part 3 — PayFast (live billing)

### 1. Switch to production credentials

In Vercel env (production only):

- Set real `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`.
- Set `PAYFAST_SANDBOX=false`.

### 2. Register the ITN (webhook) URL

In your PayFast merchant dashboard, set the **Instant Transaction Notification** URL to:

```
https://your-domain.com/api/webhooks/payfast
```

PayFast must be able to POST to this URL over HTTPS. The app verifies signatures and validates with PayFast server-side.

### 3. Test a real (small) payment

1. Sign up on live site → create restaurant → complete checkout.
2. Confirm return URL lands on billing with success banner.
3. Confirm **Table Editor → `transactions`** has a row.
4. Confirm subscription status is `active` in **`subscriptions`**.

Return/cancel URLs are built from `NEXT_PUBLIC_APP_URL` in code — no PayFast dashboard config needed for those.

---

## Part 4 — Email (production)

`MAIL_PROVIDER=console` only logs to server stdout — unusable for real users.

**Resend (simplest):**

1. Create account at [resend.com](https://resend.com).
2. Verify your sending domain (DNS records).
3. Set `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM=noreply@yourdomain.com`.

**Brevo:** Set `MAIL_PROVIDER=brevo` and `BREVO_API_KEY`.

Test: sign up (confirmation), forgot password, team invite — each should arrive in inbox.

---

## Part 5 — Cron job (grace period)

`vercel.json` schedules:

```json
{ "path": "/api/cron/grace-period", "schedule": "0 */6 * * *" }
```

Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically on Pro plans. Ensure `CRON_SECRET` in Vercel matches what the route expects.

**Manual test after deploy:**

```bash
curl -X POST https://your-domain.com/api/cron/grace-period \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Part 6 — Post-deploy verification

Run through `CHECKLIST.md` against production. Minimum:

1. Sign up + email confirm + sign in
2. Create restaurant + PayFast payment
3. Create menu → publish → open `/m/[slug]`
4. Upload image (confirms storage + RLS)
5. PayFast webhook fired (check `transactions`)
6. Set yourself super admin → open `/admin/health`

---

## Quick reference — deploy commands

```bash
# One-time Supabase setup
supabase login
supabase link --project-ref YOUR_REF
supabase db push
pnpm db:seed                    # with remote creds in env

# Optional
supabase functions deploy rollup_analytics

# Local verify before pushing
pnpm build
pnpm lint
pnpm test -- --run

# Vercel CLI (alternative to dashboard)
npm i -g vercel
vercel --prod
```

---

## Common production issues

| Symptom | Fix |
|---------|-----|
| Auth redirect loop | Supabase Site URL + Redirect URLs must include exact production domain |
| “Invalid API key” | Wrong anon/service key; redeploy after env fix |
| Images 404 on public menu | Buckets missing → re-run `supabase db push`; check `menu-media` is public |
| PayFast webhook 400 | Passphrase mismatch; ITN URL must be HTTPS production URL |
| Emails not sent | `MAIL_PROVIDER` still `console`; verify domain with Resend/Brevo |
| Cron 401 | `CRON_SECRET` not set in Vercel or cron only on Pro plan |
| Checkout return doesn’t activate sub | Check `NEXT_PUBLIC_APP_URL` matches browser URL; inspect `subscriptions` for pending row |

---

*See also: `.env.example`, `DEMO_AND_TEST_PLAN.md`, `CHECKLIST.md`*
