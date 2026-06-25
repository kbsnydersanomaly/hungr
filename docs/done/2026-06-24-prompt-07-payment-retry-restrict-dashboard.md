# Done: Prompt 7 — Payment retry link + restrict dashboard when unpaid

**Date:** 2026-06-24  
**Prompt:** Prompt 7: Payment retry link + restrict dashboard when unpaid

## Summary

Added PayFast checkout retry for pending/failed subscriptions and blocked unpaid users from restaurant management routes while keeping billing and settings accessible.

## Files involved

- `lib/data/billing-actions.ts`
  - `retrySubscriptionCheckoutAction()` — rebuilds PayFast checkout for pending/failed subscriptions.
  - `buildCheckoutForSubscription()` — shared checkout URL builder for retry.

- `lib/billing/subscription.ts`
  - `findPendingSubscription()`, `assertRestaurantManagementAllowed()`, `requireRestaurantManagementOrRedirect()`.

- `lib/auth/role.ts`
  - Manager-level `requireRestaurantAccess()` now enforces subscription management access.

- `components/dashboard/PaymentPendingBanner.tsx`, `RetryPaymentButton.tsx`
  - Amber dashboard banner with retry CTA for pending payments.

- `components/dashboard/SubscriptionInvalidBanner.tsx`, `SubscriptionActions.tsx`
  - Pending state split out; billing page retry buttons for pending/failed.

- `app/(dashboard)/restaurants/[restaurantId]/(manage)/layout.tsx`
  - Redirects blocked users to restaurant billing.

- Route moves: menus, branding, about, qr, media, team, settings, specials → `(manage)/`.

- `app/(dashboard)/restaurants/new/page.tsx`
  - Redirects to org billing when a flat-plan org subscription failed.

- Billing pages show a lock card when redirected with `?reason=subscription_required`.

## Tests

- `tests/unit/subscription-validity.test.ts` — pending lookup + access helpers
- `tests/unit/billing-actions.test.ts` — retry checkout action
- `tests/components/PaymentPendingBanner.test.tsx`
- `tests/e2e/subscription-unpaid-dashboard.spec.ts`

## Acceptance criteria status

- [x] Pending payment shows "Payment pending — click here to retry" and links to PayFast checkout.
- [x] Never paid / failed users cannot access restaurant/menu management routes.
- [x] Blocked routes redirect to billing with an upgrade prompt card.
- [x] Billing/settings remain accessible for payment.
- [x] Unit tests for access-control logic and retry action.
