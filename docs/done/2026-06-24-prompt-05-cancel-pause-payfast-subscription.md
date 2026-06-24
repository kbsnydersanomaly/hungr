# Prompt 5: Cancel/pause subscription via PayFast — Implementation Notes

**Date:** 2026-06-24  
**Approach selected:** Option B — Enhanced observability (minimal completion + audit logs + in-app notifications)

## Summary

Implemented dashboard controls for owners and admins to pause or cancel an active PayFast subscription, following PayFast's recurring-billing API. The work also surfaces cancelled subscriptions in the UI and sends confirmation emails using existing templates.

## Files changed

- `components/dashboard/SubscriptionActions.tsx`
  - Added a confirmation dialog for the **Pause** action.
  - Refactored Pause/Cancel to use a shared `ConfirmDialog` component.
  - Server-action results are now checked via `result.ok` and surfaced with toast notifications.

- `app/(dashboard)/settings/billing/page.tsx`
  - Actions are now shown to owners **and** admins (`canManage`).
  - Cancelled subscriptions render a destructive badge.

- `app/(dashboard)/restaurants/[restaurantId]/billing/page.tsx`
  - Computed `canManage` guard for owners/admins.

- `lib/billing/payfast.ts`
  - Subscription REST calls now use `https://api.payfast.co.za` in production (checkout/ITN URLs remain on `www.payfast.co.za`).
  - `pauseSubscription(token, cycles = 1)` sends `{ token, cycles }`.
  - `unpauseSubscription(token)` sends `{ token }`.
  - `cancelSubscription(token)` sends a plain PUT to `/subscriptions/{token}/cancel`.

- `lib/data/billing-actions.ts`
  - Org subscription actions now require `admin` access (restaurant actions still require `manager`, which already covers org admins).
  - Loaders include `cancelled` subscriptions so they remain visible.
  - Pause/cancel send `subscription-paused` / `subscription-cancelled` emails to the acting user.
  - Each pause/cancel/resume writes an `audit_logs` row and creates `notifications` rows for all org owners/admins.

- `tests/unit/billing-actions.test.ts` (new)
  - Unit tests for pause, cancel, and resume actions with mocked PayFast, Supabase, auth, mail, headers, and cache dependencies.
  - Covers success paths, email sending, missing subscriptions, unauthorized access, and PayFast API failures.

## Verification

```bash
pnpm test --run   # 81 passed
pnpm lint         # clean
pnpm build        # TypeScript + static generation successful
```

## Acceptance criteria status

- [x] Pause subscription button/action available on the billing/settings page.
- [x] Cancel subscription button/action available on the billing/settings page.
- [x] Both actions show a confirmation dialog explaining the consequences.
- [x] Actions call the PayFast API correctly for pause/cancel.
- [x] Local subscription record is updated to reflect the new status.
- [x] UI updates to show the subscription as paused or cancelled.
- [x] Appropriate emails sent (reused existing `subscription-paused` / `subscription-cancelled` templates).
- [x] Extra: audit-log and in-app notification records created for each event.
- [x] Unit tests added for the server actions, including unauthorized-access cases.

## Notes / caveats

- No manual PayFast sandbox test was run; the unit tests mock PayFast and Supabase responses.
- Emails are sent to the acting user's email address; failures are logged but do not fail the action.
