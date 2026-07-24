# Hungr — Deploy to Supabase + Vercel

Step-by-step guide to go from local dev to a live production site.

**Prerequisites:** GitHub repo, [Supabase](https://supabase.com) account, [Vercel](https://vercel.com) account, domain (optional), PayFast merchant account (for billing), Resend or Brevo account (for email).

---

## Part 1 — Supabase (database, auth, storage)

### 1. Select or create the project

1. Open an existing Hungr project, or create a new one, in [Supabase Dashboard](https://supabase.com/dashboard).
2. Record the project reference and keep database credentials in the approved password manager.

`supabase/migrations/20260717120001_baseline.sql` initializes an empty project completely, so a brand-new project is supported: step 3 applies it.

### 2. Note your credentials

In **Project Settings → API**, copy:

| Variable | Where |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (**server only — never expose to browser**) |

### 3. Link the project and push migrations

From the repo root:

```bash
pnpm install
supabase login
export NEXT_PUBLIC_APP_URL=https://your-domain.com
supabase link --project-ref YOUR_PROJECT_REF   # ref is in Project Settings → General
supabase db push                               # applies pending files in supabase/migrations/
```

This works on both an empty project and one that already carries the baseline: the migration's non-public statements are guarded, so re-applying them is a no-op.

`supabase/schemas/baseline.sql` is a documentation snapshot for reviewers, not an install script. Never apply it by hand.

**Verify:**

```bash
supabase db diff --from migrations --to linked   # expect no differences
```

Use that explicit form, not bare `supabase db diff --linked`, which reported a spurious drop list against an identical schema on CLI v2.106.0. Then check Supabase Dashboard → **Table Editor** for `profiles`, `organizations`, `restaurants`, `menus`, and **Storage** for the `menu-media`, `branding`, `invoices`, `private`, and `help-media` buckets.

### 4. Seed pricing plans

The seed is idempotent — it upserts plans on `slug` and skips help content that already exists — so it is safe to re-run. It refuses a non-local target by default. Put remote credentials in a gitignored environment preset or load them from the approved secret manager, switch `.env.local` to that preset, then run:

```bash
SEED_ALLOW_REMOTE=1 pnpm db:seed
```

Never place `SUPABASE_SERVICE_ROLE_KEY` directly in a shell command or commit it to an environment template; it bypasses RLS and may remain in shell history.

**Verify:** **Table Editor → `plans`** — Starter, Pro, Enterprise rows exist.

### 5. Configure Auth

**Authentication → URL Configuration**

These values must match `NEXT_PUBLIC_APP_URL` exactly — otherwise verification, password-reset and OAuth links redirect to the wrong domain (often `localhost:3000`).

| Setting | Value |
|---------|--------|
| Site URL | `https://your-domain.com` (or `https://your-app.vercel.app` until custom domain is ready) |
| Redirect URLs | Add all of these (one per line): |
| | `https://your-domain.com/**` |
| | `https://your-app.vercel.app/**` |
| | `http://localhost:3000/**` (keep for local dev) |

> **Local dev:** `supabase/config.toml` uses shell variable `NEXT_PUBLIC_APP_URL` for `site_url` and `additional_redirect_urls`. Run `export NEXT_PUBLIC_APP_URL=http://localhost:3000` before Supabase CLI commands, then restart `supabase start` after changing it.

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
| `help-media` | Yes | Help-centre images |
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
{ "path": "/api/cron/grace-period", "schedule": "0 2 * * *" }
```

Runs once daily at 02:00 UTC — compatible with Vercel **Hobby** (daily cron limit). A 7-day grace period does not need sub-daily checks; use `0 */6 * * *` only on **Pro** if you want faster enforcement.

Vercel sends `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in project env. Ensure it matches what the route expects.

**Manual test after deploy:**

```bash
curl -X POST https://your-domain.com/api/cron/grace-period \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Part 6 — Post-deploy verification

Run the release smoke checklist in `DEMO_AND_TEST_PLAN.md` against production. Minimum:

1. Sign up + email confirm + sign in
2. Create restaurant + PayFast payment
3. Create menu → publish → open `/m/[slug]`
4. Upload image (confirms storage + RLS)
5. PayFast webhook fired (check `transactions`)
6. Set yourself super admin → open `/admin/health`

---

## Quick reference — deploy commands

```bash
# Works on an empty project as well as an existing one
supabase login
export NEXT_PUBLIC_APP_URL=https://your-domain.com
supabase link --project-ref YOUR_REF
supabase db push
supabase db diff --from migrations --to linked   # expect no differences
SEED_ALLOW_REMOTE=1 pnpm db:seed                 # with remote creds in env

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
| Images 404 on public menu | Confirm migrations ran; check `menu-media` is public |
| PayFast webhook 400 | Passphrase mismatch; ITN URL must be HTTPS production URL |
| Emails not sent | `MAIL_PROVIDER` still `console`; verify domain with Resend/Brevo |
| Cron 401 | `CRON_SECRET` not set in Vercel env vars |
| Cron deploy error (Hobby) | Schedule must run at most once per day (e.g. `0 2 * * *`, not `0 */6 * * *`) |
| Checkout return doesn’t activate sub | Check `NEXT_PUBLIC_APP_URL` matches browser URL; inspect `subscriptions` for pending row |

---

*See also: `.env.example`, `README.md`, and `DEMO_AND_TEST_PLAN.md`.*
