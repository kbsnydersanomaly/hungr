# Done: Prompts 9 & 10 — Organisation switcher + team member management

**Date:** 2026-06-24
**Prompts:** Prompt 9 (Allow team members to switch organisations) and Prompt 10 (Team member list with edit permissions, delete, promote)

## Summary

Both features were **already implemented** in the repository (most likely from
the recent invite/org work — the `20260624120000_invite_org_context.sql`
migration is dated the same day). This session closed the genuine remaining gaps
against the acceptance criteria rather than rebuilding existing functionality:

1. Added a confirmation dialog for owner-impacting role changes
   (promote-to-owner and demote-from-owner).
2. Added the unit test coverage both prompts explicitly call for (role
   transitions, last-owner guard, org-switch membership guard).
3. Added an e2e happy-path test for organisation switching.

## What already existed (verified, unchanged)

**Org switcher (Prompt 9):**
- `components/dashboard/OrgSwitcher.tsx` — sidebar dropdown listing every org the
  user belongs to (owner + member), role badge, check on the active org.
- `lib/auth/active-org-actions.ts` — `setActiveOrg` verifies membership
  server-side, sets a 1-year `active_org` cookie, clears `active_restaurant`,
  redirects.
- `lib/auth/active-org.ts` — resolves context: cookie → `profiles.default_org_id`
  → oldest membership.
- Accept-invite sets `default_org_id` + activates the org cookie so invitees land
  in the inviting org.
- Rendered in `app/(dashboard)/layout.tsx` (memberships from `organization_members`).

**Team management (Prompt 10):**
- `app/(dashboard)/settings/team/page.tsx` — members list (name/email/role badge)
  + pending invitations.
- `lib/data/team-actions.ts` — `changeMemberRole` (incl. promote-to-owner),
  `removeMember`, invite/revoke/resend, all guarded by `requireOrgAccess`, with a
  last-owner guard on demote/remove.
- `components/dashboard/team/MemberActionsMenu.tsx` — per-member role change +
  remove (with confirm dialog), owner-only owner assignment.

## Files changed this session

- `components/dashboard/team/MemberActionsMenu.tsx`
  - Owner-impacting role changes (promote-to-owner, demote-from-owner) now route
    through a confirmation `Dialog` via a new `pendingRole` state; routine
    admin/manager/staff swaps remain instant. Reuses the existing
    `changeMemberRole` action — no server change needed (the last-owner guard
    already lives there).

- `tests/unit/team-actions.test.ts`
  - Added `describe("changeMemberRole")`: promote staff→admin, reject demoting
    the last owner, allow demoting an owner when others remain, require owner
    access to promote to owner, member-not-found validation.
  - Added `describe("removeMember")`: remove non-owner, reject removing the last
    owner, allow removing an owner when others remain.
  - Extended the `makeSupabase` stub with a `delete` method and a `count`
    property (the `head: true` count queries are awaited directly).

- `tests/unit/active-org-actions.test.ts` (new)
  - `setActiveOrg`: member success path (cookie set, `active_restaurant` cleared,
    redirect) and "not a member of that organization" rejection (no cookie, no
    redirect) — covers Prompt 9's "member cannot access an org they don't belong
    to."

- `tests/e2e/org-switch.spec.ts` (new)
  - Signs up a user (auto-creates org A), seeds a second org B via the
    service-role client, switches via the sidebar dropdown, and asserts the
    selection updates and persists across a reload.

## Verification

```bash
npx vitest run tests/unit
# 114 passed (10 files)

npx eslint components/dashboard/team/MemberActionsMenu.tsx \
  tests/unit/team-actions.test.ts tests/unit/active-org-actions.test.ts \
  tests/e2e/org-switch.spec.ts
# clean
```

- Unit suite passes (114 tests).
- ESLint clean on all changed files.
- `npx tsc --noEmit` is clean across the codebase.
- **E2E not run this session:** the local Supabase DB container was absent and no
  dev server was running. Run with the stack up:
  `npx playwright test tests/e2e/org-switch.spec.ts`.

## Acceptance criteria status

### Prompt 9 — Organisation switcher
- [x] Dropdown in the dashboard shell lists all orgs the user belongs to (owner + member).
- [x] Selecting an organisation switches the active organisation context.
- [x] All dashboard data (restaurants, menus, billing, team) updates to the selected org.
- [x] Active organisation persisted across navigation (1-year `active_org` cookie).
- [x] Owners with multiple orgs can also use the switcher.
- [x] On accepting an invite, the user defaults to the inviting org (`default_org_id` + cookie).
- [x] Test that a member cannot access an org they don't belong to (`setActiveOrg` unit test).

### Prompt 10 — Team member management
- [x] Team page shows all members with email, role, and status.
- [x] Each member has an edit-role action.
- [x] Each member has a delete action with confirmation (cannot delete the sole owner).
- [x] Each member has a promote-to-owner action **with confirmation** (added this session).
- [x] Changes reflect immediately in the UI (`router.refresh()`).
- [x] Only owners/admins can perform these actions (server-side `requireOrgAccess`).
- [x] Unit tests cover permission checks and role transitions (added this session).
- [x] Last owner cannot be deleted/demoted (guard + unit tests).

## Notes / caveats

- Confirmation dialogs were intentionally scoped to **owner-impacting** changes
  only (promote-to-owner, demote-from-owner); routine role swaps stay instant per
  the agreed approach.
- The app uses cookie-based active-org context, not URL-based
  (`/dashboard/[orgSlug]/...`) routing — deliberately left as-is.
- The role model doubles as the permission model; no separate granular
  per-feature permissions were added.
- Restaurant-level team management already existed and was left unchanged; only
  org-level gaps were addressed.
</content>
