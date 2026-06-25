# Prompt 14: Add back button on public menu about page

**Date:** 2026-06-24  
**Prompt:** Prompt 14: Add back button on public menu about page

## Summary
Added a "Back to menu" link on the public about page that returns diners to the menu they were viewing. About links from the menu header and mobile nav now pass `?menu={menuSlug}` so the back target is preserved. Direct visits to `/about` fall back to the restaurant's default (or first published) menu.

## Acceptance Criteria
- [x] The about page (`/m/[restaurantSlug]/about`) displays a back button.
- [x] Clicking it navigates back to the restaurant's menu.
- [x] The button is accessible and uses `ArrowLeft` from `lucide-react`.
- [x] It works on mobile and desktop (lightweight link styling, `min-h-9` tap target).

## Files Changed
- `lib/menu/public-routes.ts` — `publicAboutHref`, `publicMenuHref`, and `menuSlugFromPublicMenuHref` helpers.
- `components/menu/MenuBackLink.tsx` — Presentational back link with `ArrowLeft` icon.
- `components/menu/Header.tsx` — About link appends `?menu=` when `currentMenuSlug` is set.
- `components/menu/MobileNav.tsx` — Same `?menu=` behavior for the mobile About link.
- `app/m/[restaurantSlug]/about/page.tsx` — Reads `searchParams.menu`, renders `MenuBackLink`, aligns header menu context.
- `tests/unit/public-routes.test.ts` — Unit tests for route helpers.
- `tests/components/MenuBackLink.test.tsx` — Component tests for the back link.
- `tests/components/Header.test.tsx` — Updated About link href expectations.

## Implementation Notes
- Used `next/link` (not `router.back()`) so the back target is predictable and works in new tabs.
- `publicMenuHref` validates `?menu=` against published menu slugs server-side; unknown slugs fall back to default/first menu.
- Back button is placed below the header and above the hero image in the content area.
- Public menu UI uses a simple text link (not dashboard `Button`) to stay lightweight on mobile.

## Verification
- `pnpm vitest run tests/unit/public-routes.test.ts tests/components/MenuBackLink.test.tsx tests/components/Header.test.tsx` — 17/17 passed
