# Done: Prompt 2 — Delete draft and published menus

**Date:** 2026-06-24  
**Prompt:** Prompt 2: Delete draft and published menus

## Summary
Added a safe, confirmation-backed delete action for every menu in the dashboard. Deletion is a hard delete that cascades dependent data via existing foreign keys, clears `default_menu_id`, removes the generated QR code, and renders the not-found page for the menu's public URL.

## Files changed
- `lib/data/menu-actions.ts` — Added `deleteMenu(menuId)` server action.
- `components/menu/MenuCard.tsx` — New client card component with visible Edit/Delete actions and a confirmation dialog.
- `app/(dashboard)/restaurants/[restaurantId]/menus/page.tsx` — Uses `<MenuCard />` for each menu.
- `app/m/[restaurantSlug]/[menuSlug]/page.tsx` — Calls `notFound()` when the menu cannot be loaded.
- `tests/e2e/menu-delete.spec.ts` — New E2E spec for the delete flow.

## Verification
- ESLint passes for all changed files.
- Playwright E2E spec `tests/e2e/menu-delete.spec.ts` passes end-to-end.
- TypeScript has pre-existing unrelated errors in `components/dashboard/SubscriptionActions.tsx` and `tests/unit/billing-actions.test.ts`.
