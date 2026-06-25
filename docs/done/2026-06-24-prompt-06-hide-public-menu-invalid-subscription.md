# Done: Prompt 6 — Hide public menus + show fixed notification when subscription invalid

**Date:** 2026-06-24  
**Prompt:** Prompt 6: Hide public menus + show fixed notification when subscription invalid

## Summary

The feature was already implemented in the repository. A shared subscription-validity helper is used by both the public menu layout (to return 404 for invalid subscriptions) and the dashboard layout (to show a persistent banner).

## Files involved

- `lib/billing/subscription.ts`
  - `isRestaurantSubscriptionValid(subscriptions, now?)` — shared pure helper that returns `{ valid: true }` or `{ valid: false, reason }`.
  - `loadRestaurantSubscriptions(supabase, restaurant)` — loads `active`, `pending`, `paused`, `cancelled`, and `failed` subscriptions scoped to the restaurant or its org.

- `app/m/[restaurantSlug]/layout.tsx`
  - Loads the restaurant by slug; if missing or subscription invalid, calls `notFound()`.
  - This protects `/m/[restaurantSlug]`, `/m/[restaurantSlug]/[menuSlug]`, `/m/[restaurantSlug]/about`, and item-detail routes from a single point.

- `components/dashboard/SubscriptionInvalidBanner.tsx`
  - Async server component that loads subscriptions, checks validity, and renders a fixed banner with a reason-specific message and a link to billing settings.

- `app/(dashboard)/layout.tsx`
  - Renders `<SubscriptionInvalidBanner />` above the dashboard header for owners of the active restaurant.

- `tests/unit/subscription-validity.test.ts`
  - Unit tests for the helper and the loader filter.

- `tests/e2e/subscription-invalid-menu.spec.ts`
  - Playwright test: creates an active restaurant, seeds a menu, cancels the subscription, then asserts public menu 404 and dashboard banner visibility.

## Verification

```bash
pnpm test tests/unit/subscription-validity.test.ts --run
# 17 tests passed
```

- Unit tests pass.
- E2E spec exists and matches the acceptance criteria; it was not re-run in this session because no code changes were required.

## Uncommitted changes

The following files had uncommitted refactor work at the time of review:

- `tests/e2e/helpers.ts` — new `seedPublishedMenu()` helper.
- `tests/e2e/public-menu.spec.ts` — refactored to use `seedPublishedMenu()`.
- `tests/e2e/subscription-invalid-menu.spec.ts` — refactored to use `seedPublishedMenu()`.

## Acceptance criteria status

- [x] Public menu routes (`/m/[restaurantSlug]`) check subscription validity before rendering.
- [x] If the subscription is invalid, the page returns a 404.
- [x] A fixed notification/banner is shown on dashboard pages when the subscription is invalid.
- [x] The notification explains the issue and links to billing settings.
- [x] The check is efficient — one subscriptions query in the shared public layout, no N+1.
- [x] Unit tests cover the subscription validity helper.
- [x] Playwright test covers invalid subscription → public menu 404.

## Notes / caveats

- `pnpm lint` and `npx tsc --noEmit` are clean.
- The dashboard banner is currently rendered only for owners (`hasMinRole(orgRole, "owner")`). If non-owner dashboard users should also see it, that guard can be relaxed.
