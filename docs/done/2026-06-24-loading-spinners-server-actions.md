# Loading Spinners for Dashboard Server Actions

> Note: Prompt 7 later moved restaurant management routes under `(manage)/` (e.g. `app/(dashboard)/restaurants/[restaurantId]/(manage)/...`); public URLs are unchanged.

**Date:** 2026-06-24  
**Goal:** Prevent duplicate submissions and communicate progress by showing a loading spinner and disabling every dashboard server-action button while its action is pending, with `sonner` toast feedback.

## Findings

Primary "Add" buttons fell into two groups:

1. **Navigation links** (`New menu`, `Add restaurant`) — these are `<Link>` wrappers inside `<Button asChild>` and do not trigger server actions, so they do not need pending spinners.
2. **Form submit buttons and action buttons** — these call server actions and were submitting repeatedly because the UI gave no pending-state feedback.

Several existing client components already had manual loading states (e.g. `SubscriptionActions`, `SpecialEditor`, `QrManager`, `MemberActionsMenu`, `ItemEditSheet`), but many Server Component forms and icon-button actions had no spinner at all.

A related issue was that several `safeAction`-wrapped server actions used `await safeAction(...)` and returned `void`, so validation failures were returned as `{ ok: false, message }` but never propagated to the UI. Fixing the return type was required before toast error messages could work.

## What was done

### New reusable components

- `components/forms/ServerActionForm.tsx`  
  Client wrapper around a form. Calls the server action inside `useTransition`, disables children via render-prop `({ isPending })`, and shows `sonner` error/success toasts. Handles `NEXT_REDIRECT` errors gracefully.

- `components/forms/SubmitButton.tsx`  
  Submit button using `useFormStatus` to show a `Loader2` spinner and disable itself automatically while the parent form is pending.

### Forms converted to the reusable pattern

| Page | Button |
|------|--------|
| `app/(dashboard)/settings/organization/page.tsx` | Save changes |
| `app/(dashboard)/settings/profile/page.tsx` | Save changes |
| `app/(dashboard)/settings/notifications/page.tsx` | Save preferences (added explicit save button) |
| `app/(dashboard)/restaurants/[restaurantId]/settings/page.tsx` | Save changes |
| `app/(dashboard)/restaurants/[restaurantId]/menus/[menuId]/page.tsx` | Publish / Unpublish |
| `app/(dashboard)/admin/subscriptions/page.tsx` | Force active / Force pause |
| `app/(dashboard)/admin/subscriptions/[id]/page.tsx` | Save changes |
| `app/(dashboard)/settings/billing/page.tsx` | Upgrade to Pro |

### Creation forms updated (original scope)

| Component | Action |
|-----------|--------|
| `components/menu/CreateMenuForm.tsx` | Create menu |
| `components/menu/AddCategoryForm.tsx` | Add category |
| `components/forms/NewRestaurantForm.tsx` | Create restaurant |

### Icon / list action buttons updated

| Component | Action |
|-----------|--------|
| `components/menu/SortableItem.tsx` | Delete item |
| `components/menu/SortableCategory.tsx` | Rename category, delete category |
| `components/dashboard/SpecialsList.tsx` | Delete special |
| `components/dashboard/MediaLibrary.tsx` | Delete image |
| `components/branding/BrandingEditor.tsx` | Save draft, publish, discard/reset |
| `components/dashboard/PlanDialog.tsx` | Create / update plan |
| `components/dashboard/AvatarMenu.tsx` | Sign out |

### Server actions fixed to return `ActionResult`

Previously these actions swallowed validation errors by returning `void`:

- `lib/data/organization-actions.ts` — `updateOrganizationName`
- `lib/data/profile-actions.ts` — `updateProfile`
- `lib/data/restaurant-settings-actions.ts` — `updateRestaurantSettings`
- `lib/data/notification-actions.ts` — `updateNotificationPrefs`
- `lib/data/plan-change-actions.ts` — `upgradeToProPlan`
- `lib/data/menu-actions.ts` — `updateMenuStatus`, `upsertCategory`

### Other fixes

- `components/forms/ProvinceSelect.tsx` now forwards `disabled` so the province select can be disabled during form submission.
- `components/branding/BrandingEditor.tsx` had a pre-existing lint error (`ref.current` read during render); converted the saved snapshot to state so lint passes.

## Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | ✅ Passed |
| `pnpm build` | ✅ Passed |
| `pnpm test --run` | ✅ 91 tests passed |

`npx tsc --noEmit` is clean.

## Deployment notes

- No database migrations or environment variable changes are required.
- The changes are purely client-side UX improvements plus server-action return-type fixes.
- Deploy via the normal Next.js build pipeline (`pnpm build`) and restart the app.
- No special rollout order; these are non-breaking UI changes.
