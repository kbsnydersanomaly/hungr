---
name: hungr-supabase-actions
description: Use when changing Hungr server actions, Supabase queries, auth or role checks, service-role operations, storage, migrations, database types, RLS policies, billing data, or tenant-scoped mutations.
---

# Hungr Supabase Actions

## Required Companion Skills

Also load:

- `supabase` for current Supabase documentation and security guidance.
- `supabase-postgres-best-practices` for SQL, schema, indexes, RLS, locking, or performance work.

Check current Supabase changelog and relevant current docs before implementation.

## Client Selection

- Use `createServerClient()` for session-bound operations governed by RLS.
- Use `createBrowserClient()` only for browser/realtime needs.
- Use `createAdminClient()` only in server-only code after explicit authorization or for tightly scoped internal/provider work.
- Never expose service-role or secret keys to browser code or `NEXT_PUBLIC_` variables.

## Authorization

- Use `requireSession`, `requireOrgAccess`, `requireRestaurantAccess`, resource ownership helpers, or `requireSuperAdmin` before privileged work.
- Never trust client-supplied organisation, restaurant, item, role, price, payment, or ownership values.
- Preserve `restaurant_scoped` staff semantics.
- RLS is primary defence; server checks provide explicit application authorization and clearer errors.
- `safeAction` is error translation, not authorization.
- Never use user-editable auth metadata for authorization.

## Server-Action Pattern

1. Add `"use server"` where module is action-only.
2. Parse and normalise input, preferably through existing Zod schemas.
3. Authorize actor and verify resource ownership before admin-client work.
4. Use correctly scoped Supabase client.
5. Keep multi-row invariants transactional through database functions/RPCs.
6. Translate expected failures with existing `ValidationError`, `BillingError`, or `actionError` conventions.
7. Wrap public result with `safeAction` where established.
8. Revalidate every affected dashboard and public path.
9. Write audit records for sensitive, financial, access, export, or destructive changes.
10. Return and inspect `ActionResult`; never swallow failure and report success.

For external side effects, write domain/outbox records in same transaction as business change, then process idempotently outside request where practical.

## Schema Workflow

- Every schema change gets a migration under `supabase/migrations/`.
- Never edit `supabase/schemas/baseline.sql` as substitute for migration; it is documentation-only.
- Create migration with `supabase migration new <name>`; inspect CLI help rather than guessing changed commands.
- Account for auth-schema triggers, storage buckets, grants, and policies outside baseline.
- Apply locally with `pnpm db:migrate` after verifying `pnpm env:which` points to intended environment.
- Regenerate `lib/database.types.ts` with `pnpm db:gen-types`.
- Run schema drift and advisor checks when available.

Newer Supabase projects may not expose SQL-created tables to Data API roles automatically. For every new public-schema table, decide explicit grants separately from RLS. When granting `anon` or `authenticated`, enable RLS and add tenant/ownership predicates.

## RLS and Privileged SQL

- `TO authenticated` alone is authentication, not tenant authorization.
- UPDATE policies need matching SELECT visibility plus `USING` and `WITH CHECK`.
- Views should use `security_invoker = true` where supported or remain inaccessible to public API roles.
- Prefer security-invoker functions.
- When security-definer is necessary, keep it outside exposed schema where possible, set safe `search_path`, check `auth.uid()`, revoke default public execute, and grant narrowly.
- Index columns used in RLS ownership predicates and common tenant filters.
- Use row locking for payment allocation, redemption limits, and other concurrent invariants.

## Domain Boundaries

- Keep Hungr subscription billing separate from patron order payments.
- Store money in integer cents and currency explicitly.
- Store immutable order/payment snapshots for historical facts.
- Store provider credentials in approved encrypted secret storage/private schema, never public settings JSON.
- Treat Realtime as notification layer; reload authoritative rows after reconnect.

## Testing

- Unit-test validation, authorization, DB failures, revalidation, and idempotency.
- Add local RLS allow and deny cases for every policy change.
- Test explicit grants where Data API access is required.
- Add storage policy tests when upload/delete access changes.
- Add transaction/concurrency tests for monetary, ordering, redemption, or reorder invariants.
- RLS tests mutate users and must target local Supabase unless user deliberately sets `RLS_ALLOW_REMOTE=1`.

## References

- `.agents/skills/supabase/SKILL.md`
- `.agents/skills/supabase-postgres-best-practices/SKILL.md`
- `README.md`
- `lib/errors.ts`
- `lib/auth/session.ts`
- `lib/auth/role.ts`
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/admin.ts`
- `lib/data/menu-actions.ts`
- `tests/unit/menu-actions.test.ts`
- `tests/rls/helpers.ts`
- `supabase/migrations/20260714170000_staff_scope_choice.sql`
- `supabase/migrations/20260714150000_restore_non_public_schema_objects.sql`
