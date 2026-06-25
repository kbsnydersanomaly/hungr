# Prompt 08 — Rework team members section / fix invites flow

> Note: Prompt 7 later moved restaurant management routes under `(manage)/` (e.g. `app/(dashboard)/restaurants/[restaurantId]/(manage)/team/...`); public URLs are unchanged.

**Date:** 2026-06-24
**Status:** Implemented & verified (DB-level + automated tests). Manual browser walkthrough optional (see below).

---

## Problem

Team invites were sent and emails arrived, but **after an invitee accepted, things broke**:
the new member didn't appear in the team list, and the invitee "couldn't see the proper
organisation." The invite-management UI was also incomplete (no status, no resend, expired
invites silently vanished).

### Root causes found in code

1. **Restaurant-scoped invitees never got org context.** `accept_invitation` inserted into
   `organization_members` **only for org-level invites** (`restaurant_id is null`); a
   restaurant-scoped invite landed only in `restaurant_members`. But the entire dashboard is
   org-centric — `getActiveOrg` / `getActiveRestaurant` resolve everything from an
   `organization_members` row — so a restaurant-only member had no org to resolve, couldn't
   reach the restaurant they joined, and didn't appear in the org list.
2. **Non-deterministic active-org fallback.** With no `active_org` cookie, `getActiveOrg` fell
   back to `.limit(1)` with no ordering. `handle_new_user` auto-creates a personal org for
   every new auth user, so an invited sign-up could land in their own empty org.
   `profiles.default_org_id` existed but was never set or used.
3. **Invite-management UX gaps.** The team page filtered out expired/accepted invites (they
   disappeared); no status badge; no resend (only revoke); duplicate invites always toasted
   "Invitation sent"; the restaurant team page showed no invitations at all; email-send
   failures weren't isolated.

---

## Changes

### Database — `supabase/migrations/20260624120000_invite_org_context.sql`
- **`accept_invitation`** rewritten: for restaurant-scoped invites it now also inserts a
  baseline `organization_members` `'staff'` row (`on conflict do nothing`) so the invitee has
  a resolvable org context. `'staff'` is the floor — `has_restaurant_access` still requires a
  `restaurant_members` row for manager rights on other restaurants, so this is **not** a
  privilege escalation. It also sets `profiles.default_org_id = inv.org_id` when unset.
- **`handle_new_user`** now sets `default_org_id` to the personal org it creates, making the
  active-org fallback deterministic for self-signups.

### Resolution layer
- `lib/auth/active-org.ts` — fallback order is now: valid `active_org` cookie →
  `profiles.default_org_id` (membership verified) → oldest membership (`joined_at asc`,
  deterministic).
- `app/(dashboard)/layout.tsx` — restaurant nav is gated by an **effective restaurant role**
  (the higher of the user's org role and their `restaurant_members` role for the active
  restaurant), so a restaurant-only member who is a restaurant `manager` sees manager nav.
- `lib/auth/invitations.ts` — `acceptInviteAndSignUp` passes `invited: true` in user metadata so
  `handle_new_user` skips the auto-created personal org. It also repoints `default_org_id` at
  the invited org as a safety net, so brand-new invitees land in the invited org even on a
  later cookie-less login.

### Invite-management UX
- `lib/team/invite-status.ts` — new pure helper `computeInviteStatus()` →
  `pending | accepted | expired | revoked` (+ labels).
- `components/dashboard/team/InvitationList.tsx` — shared list rendering status badges, used by
  both the org and restaurant team pages.
- `app/(dashboard)/settings/team/page.tsx` — fetches **all** invitations (not just non-expired)
  and renders them with status badges.
- `app/(dashboard)/restaurants/[restaurantId]/team/page.tsx` — now shows a restaurant-scoped
  "Invitations" section.
- `lib/data/team-actions.ts`:
  - New `resendInvitation(invitationId)` — regenerates token + expiry, clears `revoked_at`,
    re-sends the email, writes an audit row.
  - `inviteMember` — case-insensitive duplicate detection (`.ilike`, matching the
    `lower(email)` unique index), returns a `resent` flag, and isolates `sendMail` failures
    with an actionable message ("Invite saved, but the email failed to send. Use Resend…")
    without losing the saved invite row.
- `components/dashboard/team/InvitationActions.tsx` — adds **Resend** alongside **Revoke**
  (only for `pending`/`expired`; `accepted`/`revoked` are terminal and show no actions).
- `components/dashboard/team/InviteMemberDialog.tsx` — toasts "Invitation updated." vs
  "Invitation sent." based on the `resent` flag.

### Tests
- `tests/unit/invite-status.test.ts` — status precedence for all four states.
- `tests/unit/team-actions.test.ts` — `inviteMember` update-vs-insert + `resent` flag,
  already-a-member rejection; `resendInvitation` regenerates token/expiry & clears revocation,
  rejects already-accepted invites.

---

## Verification performed

- **DB end-to-end (local Supabase, transactional, rolled back):** simulated a brand-new
  restaurant-scoped invitee accepting. Confirmed:
  - `restaurant_members` gets the `manager` row.
  - `organization_members` gets the baseline `staff` row in the inviter's org **(the fix)**.
  - invitation is marked `accepted`.
  - after the `acceptInviteAndSignUp` step, the invitee's `default_org_id` points at the
    **invited** org (not the personal auto-org) → cookie-less login resolves correctly.
- **Automated:** full `pnpm vitest run` → **91/91 pass** (incl. 10 new). `pnpm lint` clean.
  `pnpm build` succeeds.
- **Migration:** `pnpm db:migrate` applied `20260624120000_invite_org_context.sql` cleanly to
  the local DB. No table/column changes, so `lib/database.types.ts` regeneration is a no-op.

### Type-check status
- `npx tsc --noEmit` is clean across the codebase.

---

## How to run the manual walkthrough (optional)

Local Supabase + Mailpit are already running (Studio http://127.0.0.1:54323, Mailpit
http://127.0.0.1:54324). Use the console/Mailpit mail sink so invite links are captured.

```bash
# Ensure emails are catchable locally (Mailpit), then:
pnpm dev
```

1. **Org-level invite:** Settings → Team → Invite member. Accept as a **brand-new** user via
   the link in Mailpit. Expect: invitee lands in the **invited** org (not a personal one);
   admin sees them in Settings → Team with a name + accepted/active status.
2. **Restaurant-level invite:** a restaurant → Team → Invite staff (manager). Accept. Expect:
   invitee can navigate to the restaurant and sees manager-level nav; appears on the restaurant
   team page; org Settings → Team lists them as `staff`.
3. **Existing user accepting:** lands in the invited org; appears in the list.
4. **Expired invite:** still listed with an "Expired" badge; **Resend** and **Revoke** both
   available; resending delivers a fresh working link.
5. **Duplicate invite:** re-inviting the same email toasts "Invitation updated" and does not
   create a duplicate row.
6. **Email render:** `pnpm mail:test` renders the invitation template.

---

## Deployment notes

- This fix depends on **three** migrations being applied to staging/production:
  `20260612100000_team_profiles_rls.sql` (peer-profile read RLS — without it, accepted members
  render blank), `20260624120000_invite_org_context.sql`, and
  `20260624125000_skip_personal_org_for_invites.sql`. Verify all three are applied remotely.
- The `20260624125000_skip_personal_org_for_invites.sql` migration was added after the main
  invite work to eliminate the auto-created personal org for invite-only signups. It detects
  `raw_user_meta_data->>'invited' = 'true'` in `handle_new_user` and skips the personal-org
  block; `accept_invitation` still grants the invited org membership and sets `default_org_id`.
  Self-signups continue to receive a personal org + `default_org_id` as before.

## Files touched
- `supabase/migrations/20260624120000_invite_org_context.sql` (new)
- `supabase/migrations/20260624125000_skip_personal_org_for_invites.sql` (new)
- `lib/team/invite-status.ts` (new)
- `components/dashboard/team/InvitationList.tsx` (new)
- `lib/auth/active-org.ts`
- `lib/auth/invitations.ts`
- `app/(dashboard)/layout.tsx`
- `lib/data/team-actions.ts`
- `app/(dashboard)/settings/team/page.tsx`
- `app/(dashboard)/restaurants/[restaurantId]/team/page.tsx`
- `components/dashboard/team/InvitationActions.tsx`
- `components/dashboard/team/InviteMemberDialog.tsx`
- `tests/unit/invite-status.test.ts` (new)
- `tests/unit/team-actions.test.ts` (new)
