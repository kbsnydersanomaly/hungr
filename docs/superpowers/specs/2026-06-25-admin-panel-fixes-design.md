# Admin Panel Fixes & UX Improvements

## Context

The super-admin area (`/admin/*`) exposes management sections for Organizations, Users, Plans, Subscriptions, Transactions, Help Articles, Settings, Audit and Health. Several pages are broken or incomplete, and the list views load every record without pagination, which will become unusable as the platform grows. In addition, some entities cannot be edited or deleted from the admin UI at all.

This spec covers the work required to make the admin panel robust and consistent.

## Goals

1. Remove the broken Audit page and its navigation entry.
2. Fix the Organization detail page (currently returns 404).
3. Add pagination, filtering and search to every long list view in the admin panel.
4. Add edit and delete actions for every manageable entity, gated to platform owners (super admins).
5. For Users specifically, support both disabling an account and permanently deleting it.
6. Keep the UX consistent across all admin sections (list → detail → edit → delete flow, empty states, error states, confirmation modals).

## Non-Goals

- Rebuilding the public marketing site or non-admin dashboards.
- Adding new admin sections (e.g., advanced analytics, impersonation changes).
- Changing the role model for organization-level access; admin actions remain super-admin only.
- Introducing complex audit logging to replace the removed Audit page.

## Current State

| Page | File(s) | Current State |
|------|---------|---------------|
| Admin layout / nav | `app/(dashboard)/admin/layout.tsx` | Tabs include Audit. All access gated by `is_super_admin`. |
| Orgs list | `app/(dashboard)/admin/orgs/page.tsx` | Loads all orgs (limit 100), supports name search. Links to detail. |
| Org detail | `app/(dashboard)/admin/orgs/[orgId]/page.tsx` | **Missing — causes 404.** |
| Users | `app/(dashboard)/admin/users/page.tsx` | Loads all users (limit 100), supports email/name search. No edit/delete/disable. |
| Subscriptions | `app/(dashboard)/admin/subscriptions/page.tsx` | Loads all subs, supports org search. Edit link works; no delete. |
| Transactions | `app/(dashboard)/admin/transactions/page.tsx` | Loads all transactions, supports ID search. No actions. |
| Help Articles | `app/(dashboard)/admin/help/page.tsx` | Loads all articles. Has edit/delete already via `AdminArticleActions`. |
| Plans | `app/(dashboard)/admin/plans/page.tsx` | Loads all plans. Has create/edit via `PlanDialog`. No delete. |
| Settings | `app/(dashboard)/admin/settings/page.tsx` | Single toggle, no list. No changes required. |
| Audit | `app/(dashboard)/admin/audit/page.tsx` | **Missing — navigation entry is dead.** |
| Health | `app/(dashboard)/admin/health/page.tsx` | Diagnostic page, out of scope. |

Data layer: most read/write logic lives in `lib/data/admin-actions.ts`. Access control is enforced by `requireSuperAdmin()` in `lib/auth/role.ts`, which checks `profiles.is_super_admin`.

## Detailed Requirements

### 1. Remove the Audit Page

- Delete the empty `app/(dashboard)/admin/audit/` directory.
- Remove the "Audit" tab from `adminNav` in `app/(dashboard)/admin/layout.tsx`.
- Verify no links elsewhere point to `/admin/audit`.

### 2. Fix the Organization Detail Page

Create `app/(dashboard)/admin/orgs/[orgId]/page.tsx` that displays:

- Organization identity: name, slug, created/updated timestamps.
- Owner profile: display name and email (from `profiles`).
- Current plan (if any).
- Metrics: number of restaurants, organization members, active subscriptions, lifetime spend (reuse `getOrganizationMetrics`).
- Related lists (paginated):
  - Restaurants in the org.
  - Subscriptions for the org.
  - Transactions for the org.
  - Organization members.
- Edit action: inline or dialog to update name/slug/owner/plan.
- Delete action: confirmation modal; on confirm, delete the org and revalidate/redirect to `/admin/orgs`.

Decision: cascade-delete all related rows when an organization is deleted. The delete operation must run in a deterministic order to respect foreign-key constraints (e.g., transactions, subscriptions, restaurant memberships, restaurants, organization memberships, then the organization itself). Because this is destructive, the confirmation modal must list the counts of dependent records that will be removed.

### 3. Pagination, Filtering & Search

Apply the following pattern to **Organizations**, **Users**, **Subscriptions**, **Transactions**, **Help Articles** and **Plans**.

#### 3.1 URL-driven state

Use query parameters:
- `?page=1&pageSize=25`
- `?search=keyword`
- `?status=active` or `?role=owner` (per-entity filters)
- `?sort=created_at&order=desc`

#### 3.2 Server-side pagination

Update data functions in `lib/data/admin-actions.ts` to accept `{ page, pageSize, search, filters, sort }` and return `{ data, total, page, pageSize, totalPages }`.

Use Supabase `range()` and `count: "exact"` for pagination.

Example signature:

```ts
export async function listOrganizations(opts: {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "name" | "created_at";
  sortOrder?: "asc" | "desc";
}) { ... }
```

#### 3.3 Searchable/filterable fields per list

| Entity | Search fields | Filter fields | Default sort |
|--------|--------------|---------------|--------------|
| Organizations | name, slug | plan, date range | created_at desc |
| Users | email, display_name | super-admin flag, status (active/disabled) | created_at desc |
| Subscriptions | org name/slug, plan name | status, scope, billing period | created_at desc |
| Transactions | payment ID, m_payment_id, org name | status, **date range** | occurred_at desc |
| Help Articles | title, slug, topics | published status, category | updated_at desc |
| Plans | name, slug | active, public, contact_only | sort_order asc |

#### 3.4 Shared UI components

Create or reuse components in `components/admin/`:
- `AdminListLayout`: header with title, count, search input, filter dropdowns, sort dropdown.
- `AdminPagination`: page size selector, previous/next, page numbers.
- `AdminEntityCard`: consistent card with title, badges, metadata, action buttons.
- `ConfirmDialog`: reusable destructive-action confirmation.

### 4. Edit & Delete Actions

Every manageable entity in the admin panel must expose Edit and Delete actions, visible only to super admins (the current `is_super_admin` gate already applies).

| Entity | Edit capability | Delete capability | Notes |
|--------|----------------|-------------------|-------|
| Organizations | name, slug, owner_id, plan_id | confirm + cascade delete dependents | See org detail notes. |
| Users | display_name, email, is_super_admin | disable **or** permanent delete | Disable preferred over delete for safety. |
| Subscriptions | status, amount, billing period, next billing, Payfast IDs | cancel/delete | Already has status toggle; add full edit and explicit delete. |
| Transactions | read-only | no delete | Financial records are immutable. Add detail view and date-range filter. |
| Help Articles | existing editor | existing delete | Keep as-is; ensure pagination/search added. |
| Plans | existing dialog | **Deactivate** by default (`active=false`); **hard delete** possible if no active subscriptions | Deactivate is the safe default; hard delete is an extra option for unused plans. |

#### 4.1 User Disable vs Delete

Add two distinct actions on the Users list and detail page:

- **Disable account**
  - Use Supabase Auth `updateUserById(userId, { ban_duration: "876000h" })` (or equivalent long-duration ban). This requires no schema migration and Supabase will reject sign-in attempts automatically.
  - Allow re-enabling from the same UI by clearing the ban (`ban_duration: "0"`).

- **Delete permanently**
  - Call Supabase Auth `deleteUser(id)` using the admin client.
  - Cascade-delete organizations and restaurants owned by the user, along with their dependent records, before deleting the auth user. Because Supabase Auth deletion triggers the `profiles` row deletion via existing cleanup, `organization_members` and `restaurant_members` rows for that user must be removed first or handled by FK rules.
  - Confirmation modal must show the number of organizations and restaurants that will be cascade-deleted.

### 5. Permissions

- The admin panel remains restricted to `profiles.is_super_admin === true`.
- Edit and delete actions are shown only when the current user is a super admin (already enforced at layout level; additionally guard each server action).
- No org-level role checks are required because the admin panel operates above organization scope.

> **Clarification note:** Confirmed — "owners" means platform super admins (`profiles.is_super_admin`). All admin edit/delete actions remain gated by `requireSuperAdmin()`.

### 6. Data Layer Changes

Modify `lib/data/admin-actions.ts` (and `lib/data/help-actions.ts` for help articles):

- Refactor `listOrganizations`, `listUsers`, `listSubscriptions`, `listTransactions`, `listPlans` to accept pagination/filter options and return paginated results.
- Refactor `listHelpArticles` to support pagination, search and filter by published status/category.
- Add/update `updateOrganization`, `deleteOrganization`.
- Add `updateUser`, `disableUser`, `enableUser`, `deleteUser`.
- Add `deleteSubscription`, `deletePlan` (with safety checks).

No schema migration is required for user disable (uses Supabase Auth ban). Migrations may be needed for cascade-delete helper functions if implemented as database RPCs.

Introduce a helper for paginated Supabase queries, e.g.:

```ts
// lib/data/admin-actions.ts or new lib/data/admin-pagination.ts
async function paginatedQuery<T>(
  query: PostgrestFilterBuilder<any, any, T[], any, any>,
  page: number,
  pageSize: number
) { ... }
```

### 7. UI/UX Standards

- **List pages:** shared header with search, filters, sort, page size selector, count, and paginated card/table list.
- **Detail pages:** clear sections, edit button opens dialog or navigates to edit page, delete button opens confirmation.
- **Empty states:** consistent message and CTA where appropriate.
- **Loading states:** use Next.js streaming / Suspense boundaries.
- **Error states:** use existing `ValidationError` / `NotFoundError` patterns.
- **Destructive actions:** always require confirmation; show consequence summary (e.g., "This will delete 3 restaurants and 12 members").
- **Revalidation:** use `revalidatePath("/admin/<section>")` after mutations.

### 8. Routing & File Structure

```
app/(dashboard)/admin/
├── layout.tsx                 # remove Audit tab
├── page.tsx                   # redirect to /admin/orgs (unchanged)
├── orgs/
│   ├── page.tsx               # paginated list + search/filter
│   └── [orgId]/
│       └── page.tsx           # NEW: org detail
├── users/
│   ├── page.tsx               # paginated list + disable/delete
│   └── [userId]/
│       └── page.tsx           # NEW: user detail (optional)
├── subscriptions/
│   ├── page.tsx               # paginated list + filters
│   └── [id]/page.tsx          # existing edit; add delete
├── transactions/
│   └── page.tsx               # paginated list + filters (read-only)
├── plans/
│   └── page.tsx               # paginated list; add delete
├── help/
│   ├── page.tsx               # paginated list + filters
│   ├── [id]/page.tsx          # existing edit
│   └── new/page.tsx           # existing
└── settings/
    └── page.tsx               # unchanged
```

The empty `audit/` directory is removed.

### 9. Acceptance Criteria

- [ ] `/admin/audit` route and navigation entry are removed.
- [ ] `/admin/orgs/[orgId]` loads and displays organization details, metrics and related paginated lists.
- [ ] All list pages (orgs, users, subscriptions, transactions, help, plans) support server-side pagination, keyword search, and relevant filters.
- [ ] Super admins can edit every manageable entity from the admin UI.
- [ ] Super admins can delete (or safely disable) every manageable entity from the admin UI.
- [ ] Users can be disabled and re-enabled; disabled users cannot sign in.
- [ ] Users can be permanently deleted, cascade-deleting their owned organizations and restaurants.
- [ ] Transactions remain immutable, with detail view and date-range filter for investigations.
- [ ] Plans can be deactivated; hard delete is available only when no active subscriptions reference the plan.
- [ ] All destructive actions require confirmation and show the records that will be affected.
- [ ] Existing tests pass and new admin E2E tests cover pagination and delete/disable flows.

### 10. Open Questions / Assumptions

1. **"Owners" clarification:** Confirmed — platform super admins only.
2. **Organization deletion policy:** Cascade-delete all dependents.
3. **User disable implementation:** Use Supabase Auth ban (no schema migration).
4. **User delete policy:** Cascade-delete owned organizations and restaurants.
5. **Transactions:** Read-only, with detail view and date-range filter.
6. **Plan deletion:** Deactivate by default; hard delete when unused.

## Recommended Implementation Order

1. Remove Audit page and nav entry.
2. Create reusable admin list/pagination components.
3. Refactor one list at a time (Organizations → Users → Subscriptions → Transactions → Plans → Help), adding pagination/search/filters and edit/delete actions for each.
4. Build Organization detail page.
5. Implement User disable/enable and permanent delete.
6. Add E2E tests for critical paths.
