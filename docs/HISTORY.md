# Project History

> Non-authoritative archive. This file preserves durable decisions and root-cause notes from superseded plans and completion documents. Current truth lives in application code, migrations, tests, `README.md`, `HUNGR_PRODUCT_ROADMAP.md`, and `docs/ROADMAP_STATE.md`.

## Product Baseline

- Hungr is a South African digital-menu SaaS built with Next.js, Supabase, Tailwind, and PayFast subscription billing in ZAR.
- Restaurants support multiple menus, public URLs under `/m/{restaurantSlug}`, branding drafts and publishing, QR sharing, reviews, specials, analytics, teams, and role-scoped administration.
- Supabase RLS is the primary tenant boundary. Service-role operations still require explicit application authorization.
- Signup historically created a profile, personal organisation, and owner membership. Future patron work must replace that assumption with the dual-role model in the product roadmap.
- Invoice numbers use an atomic database operation to prevent concurrent allocation races.
- Next.js request interception uses `proxy.ts`, not deprecated `middleware.ts`.

## 2026-06 Platform Work

### Server Actions and Loading

Mutation controls were standardized around pending feedback. `SubmitButton` uses form pending state, and `ServerActionForm` runs mutations in a transition.

Important root cause: `safeAction()` returns `{ ok: false, message }`; it does not necessarily reject. Callers that ignored returned `ActionResult` showed false success, swallowed validation errors, and allowed duplicate submissions.

### Menu and Spreadsheet Work

- Menu deletion uses confirmation and cleans dependent records, default-menu references, and generated QR data.
- Bulk import supports CSV, XLSX, and XLS with add, modify, and replace modes.
- Import prices become integer cents, category matching is case-insensitive, and modify matches item name within category.
- Historical import work capped files at 2,000 rows, but did not make every mode transactional. Current remediation lives in roadmap group P1-4.
- Media search stayed client-side because the current restaurant media list is loaded without pagination.

### Subscription Controls

Owners and organisation admins can pause, resume, or cancel PayFast subscriptions.

- Production recurring-subscription API calls use `https://api.payfast.co.za`; checkout and ITN use `www.payfast.co.za`.
- Successful local state changes create audit records, notifications, and confirmation email attempts.
- Email failure does not roll back a successful billing operation.
- Archived verification used mocked PayFast responses; manual sandbox verification was not recorded.
- Existing webhook concurrency and validation hardening is now tracked as P0-E3.

### Invitations and Organisation Context

Restaurant-scoped invitation acceptance also creates baseline organisation membership while restaurant role remains separately enforced.

Active organisation resolution order became:

1. Valid `active_org` cookie.
2. Membership-backed `profiles.default_org_id`.
3. Oldest organisation membership by `joined_at`.

Invite acceptance sets the invited organisation as default. Historical migrations required for this behaviour were `20260612100000_team_profiles_rls.sql` and `20260624120000_invite_org_context.sql`.

### Branding Reliability

- Branding edits remain server-persisted drafts until explicit publication.
- Dirty state derives from current serialized draft versus last persisted snapshot, preventing older in-flight saves from clearing newer changes.
- Failed saves remain dirty and visible to the user.
- Reset means reset to published and requires confirmation.
- Undo/redo history is client-side and field-coalesced. It does not survive reloads or devices.

### Admin, Auth, and Help Work

Historical plans covered unified sign-in, phone normalization, admin pagination and detail views, safer destructive admin actions, and help-category management. Their unchecked task lists were planning artifacts, not current work queues. Current routes and tests confirm substantial implementation; inspect code before assuming any archived requirement remains missing.

## 2026-07 Navigation Work

Async controls now remain disabled through action and navigation completion rather than only until a server action resolves.

- Sign-in navigation remains busy until route commit.
- Dashboard links use delayed pending hints to avoid flashes on fast transitions.
- Global progress ignores external, download, modifier-key, same-URL, and hash-only navigation.
- Navigation progress has a failsafe timeout.
- Root progress tracking avoids `useSearchParams` to prevent global Suspense requirements.

## Historical Document Policy

Detailed completion notes, customer prompt decompositions, login mockups, and superseded implementation plans were consolidated here in July 2026. Git history retains originals. Historical plans are never proof of current behaviour and must not be copied without checking current schema, authorization, migrations, tests, and framework documentation.
