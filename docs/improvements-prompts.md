# AI-Coder Prompts from `improvements.txt`

This file contains standalone, full-spec prompts derived from `docs/improvements.txt`. Each prompt targets one distinct feature or bug. Prompts follow the same structure so any AI coder can pick one up and run with it without reading the original list.

Project context for every prompt:
- **Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres, Auth, Storage, Edge Functions), PayFast billing.
- **Conventions:** See `DESIGN_SYSTEM.md` and `README.md`. Use shadcn/ui primitives in `components/ui/`, server actions for mutations, `zod` for validation, `sonner` for toasts, `lucide-react` for icons.
- **Patterns:** Server actions return `{ ok, data?, code?, message? }`. Dashboard routes live under `app/(dashboard)/`. Public menu routes live under `app/m/`.

---

## Prompt 1: Add loading + disabled state to "Add" buttons

### Context
When users click an "Add" button (for example, "Add menu"), the button remains enabled and shows no loading indicator while the server action runs. Users click multiple times and accidentally create duplicate menus.

### Goal
Every primary "Add" button in the dashboard must show a spinner and become disabled while its action is pending.

### Acceptance Criteria
- [ ] The "Add menu" button (and equivalent primary Add buttons in the dashboard) displays a loading spinner and is disabled during the server action.
- [ ] The button returns to its normal state after the action succeeds or fails.
- [ ] Duplicate submissions are prevented even if the user clicks rapidly.
- [ ] A toast notification shows success or error using `sonner`.

### Relevant Files / Patterns
- Likely routes: `app/(dashboard)/menus/page.tsx`, other `app/(dashboard)/**/page.tsx` with Add buttons.
- Pattern: React `useTransition` or `useState` pending flag + `Button` from `components/ui/button`.
- Reference: `DESIGN_SYSTEM.md` §4 (Button variants) and §7 (Server Action pattern).

### Implementation Notes
- Prefer `useTransition` around the server action call; disable the button when `isPending` is true.
- Use `Loader2` icon from `lucide-react` as the spinner.
- Do not rely solely on the server action being slow; the UX must communicate progress immediately.

### Testing
- [ ] Manual: open the menus page, throttle network, click "Add menu" — only one menu is created.
- [ ] Component test (if one exists): simulate click and assert button is disabled and spinner is shown while pending.

### Priority
High — this is a quick win that prevents data corruption.

---

## Prompt 2: Delete draft and published menus

### Context
There is no obvious way to delete a menu, whether draft or published. Users need this to clean up experiments and outdated menus.

### Goal
Add a safe, reversible-by-confirmation delete action for every menu in the dashboard.

### Acceptance Criteria
- [ ] Each menu card/row has a visible delete action (button or dropdown item).
- [ ] Clicking delete opens a confirmation dialog explaining the action is permanent.
- [ ] The server action deletes the menu record and any dependent data as appropriate.
- [ ] Public URLs for deleted menus return 404.
- [ ] A success toast appears after deletion; the UI list updates optimistically or after refresh.

### Relevant Files / Patterns
- Likely routes: `app/(dashboard)/menus/page.tsx`, `components/menu/`.
- Use `Dialog` from `components/ui/dialog` for confirmation.
- Server action pattern from `DESIGN_SYSTEM.md` §7.

### Implementation Notes
- Decide on hard delete vs. soft delete. Soft delete (`deleted_at`) is safer and easier to recover; align with existing patterns in the schema.
- If soft deleting, update public menu queries to filter `deleted_at IS NULL`.
- Consider whether menu items, categories, and media references need cascading cleanup.

### Testing
- [ ] Manual: create a menu, delete it, confirm it disappears from dashboard and public URL 404s.
- [ ] Add a unit test for the delete server action if a test pattern exists.

### Priority
High.

---

## Prompt 3: Bulk menu upload via CSV/Excel modal

### Context
Restaurant owners need to populate or update menus quickly from a spreadsheet instead of adding items one by one.

### Goal
Build a modal that lets users download a sample spreadsheet, fill it out, and upload it to add, modify, or replace a menu.

### Acceptance Criteria
- [ ] A "Bulk upload" button opens a modal from the menus page.
- [ ] The modal provides a downloadable sample file (CSV and/or Excel) showing the expected columns.
- [ ] The user can select an upload mode: add new items, modify existing items, or replace the entire menu.
- [ ] Uploading parses the file and applies the chosen operation.
- [ ] Clear validation errors are shown for malformed rows (row number, field, reason).
- [ ] A summary is shown at the end: items added, updated, skipped, failed.
- [ ] Large files are handled gracefully (streaming or chunked parsing).

### Relevant Files / Patterns
- Likely route: `app/(dashboard)/menus/page.tsx`.
- Create new components in `components/menu/` (e.g., `BulkUploadModal.tsx`).
- Use `Dialog` from `components/ui/dialog`, `Button`, `Select`, file input.
- Server action in `app/(dashboard)/menus/actions.ts` or `lib/menu/actions.ts`.

### Implementation Notes
- Required columns at minimum: name, description, price, category. Add optional columns as needed (dietary tags, image URL, etc.).
- For "replace entire menu", confirm with the user before deleting existing items.
- For "modify existing", use a unique identifier column (e.g., item name or an `id` column in the sample).
- Use a robust CSV/Excel parser. Check existing dependencies before adding new ones; if none exist, evaluate lightweight options (`papaparse` for CSV, `xlsx` for Excel) and add via `pnpm`.
- Validate rows with `zod` before inserting.

### Testing
- [ ] Manual: download sample, fill it, upload in each mode, verify results.
- [ ] Unit test the parser/validator with valid, malformed, and empty files.
- [ ] Add a Playwright test for the happy path if e2e tests exist for menus.

### Priority
Medium — significant feature, but not blocking existing workflows.

---

## Prompt 4: Search bar for media upload panel

### Context
The media library grows quickly. Users need to find existing images without scrolling through every upload.

### Goal
Add a search input to the media upload panel that filters uploaded media by filename or alt text in real time.

### Acceptance Criteria
- [ ] A search input is visible at the top of the media panel.
- [ ] Typing filters the displayed media items immediately (client-side) or on submit (server-side) — choose the approach that matches the existing media list size.
- [ ] Empty state updates to "No media matches your search" when there are no results.
- [ ] Search state is cleared with a clear button or by deleting the query.

### Relevant Files / Patterns
- Likely components: `components/media/`, `components/ui/input`.
- Search should use `Input` with a `Search` icon from `lucide-react`.

### Implementation Notes
- If media is already fetched client-side, filter in React state.
- If media is paginated/server-fetched, add a query parameter and call the server action/API with the search term.
- Debounce server-side search to avoid excessive requests.

### Testing
- [ ] Manual: upload several images, search by partial filename, verify filtering.
- [ ] Component test: render media panel, type query, assert correct items are shown.

### Priority
Medium.

---

## Prompt 5: Cancel/pause subscription via PayFast

### Context
Restaurant owners currently cannot cancel or pause their subscription from the dashboard. This forces them to contact support.

### Goal
Add dashboard controls to cancel or pause an active PayFast subscription, following PayFast's recurring-billing API.

### Acceptance Criteria
- [ ] A "Pause subscription" button/action is available on the billing/settings page.
- [ ] A "Cancel subscription" button/action is available on the billing/settings page.
- [ ] Both actions show a confirmation dialog explaining the consequences.
- [ ] The action calls the PayFast API correctly for pause/cancel.
- [ ] The local subscription record is updated to reflect the new status.
- [ ] The UI updates to show the subscription as paused or cancelled.
- [ ] Appropriate emails/notifications are sent (reuse existing email patterns if they exist).

### Relevant Files / Patterns
- Likely routes: `app/(dashboard)/settings/billing/page.tsx` or `app/(dashboard)/billing/page.tsx`.
- Billing logic likely in `lib/billing/`.
- Use `Dialog` for confirmations.

### Implementation Notes
- Reference: [PayFast recurring billing docs](https://developers.payfast.co.za/api#recurring-billing).
- Determine how PayFast subscription tokens/IDs are stored in the database.
- Pausing may differ from cancelling in PayFast; implement both correctly.
- Ensure only owners/admins can cancel/pause (check permissions).

### Testing
- [ ] Manual: pause a test subscription, verify status; cancel a test subscription, verify status.
- [ ] Unit test the server action with mocked PayFast responses.
- [ ] Test that unauthorized users cannot trigger these actions.

### Priority
High — core billing capability.

---

## Prompt 6: Hide public menus + show fixed notification when subscription invalid

### Context
Restaurants without a valid subscription still have publicly accessible menus. This should not be possible.

### Goal
When a restaurant's subscription is invalid (cancelled, paused, expired, or never paid), the public menu must return 404, and the dashboard must show a persistent fixed notification about the invalid subscription.

### Acceptance Criteria
- [ ] Public menu routes (`/m/[restaurantSlug]`) check subscription validity before rendering.
- [ ] If the subscription is invalid, the page returns a 404 (menu "does not exist").
- [ ] A fixed notification/banner is shown on dashboard pages when the subscription is invalid.
- [ ] The notification explains the issue and links to billing settings.
- [ ] The check is efficient (avoid N+1 queries on public routes).

### Relevant Files / Patterns
- Public routes: `app/m/[...]/page.tsx` or similar.
- Dashboard layout: `app/(dashboard)/layout.tsx`.
- Subscription data likely in `lib/billing/` or `lib/data/`.

### Implementation Notes
- Reuse the same subscription-status helper for public routes and dashboard banner.
- Consider edge cases: trial periods, grace periods, pending payments.
- The 404 should not leak that the restaurant exists for privacy.

### Testing
- [ ] Manual: cancel a subscription, verify public menu 404s and dashboard banner appears.
- [ ] Unit test the subscription validity helper.
- [ ] Playwright test: invalid subscription → public menu 404.

### Priority
High.

---

## Prompt 7: Payment retry link + restrict dashboard when unpaid

### Context
When a payment is pending, users have no way to retry. When they haven't paid at all, they can still access parts of the dashboard they shouldn't.

### Goal
Provide a retry-payment link for pending payments and block access to restaurant/menu management when the account is unpaid.

### Acceptance Criteria
- [ ] If the latest payment is pending, a clear banner/link says "Payment pending — click here to retry" and takes the user to PayFast checkout.
- [ ] If the account has never paid or payment failed entirely, the user cannot access routes for adding/modifying restaurants or menus.
- [ ] Blocked routes redirect to a billing page or show a full-screen upgrade prompt.
- [ ] Read-only access to billing/settings is still allowed so they can pay.

### Relevant Files / Patterns
- Dashboard layout/guards: `app/(dashboard)/layout.tsx` or middleware.
- Billing server actions: `lib/billing/actions.ts`.
- PayFast checkout integration.

### Implementation Notes
- Distinguish between "pending payment" and "never paid" statuses.
- The retry link should probably regenerate a PayFast payment identifier or reuse the existing one per PayFast docs.
- Use middleware or layout-level checks; avoid sprinkling guards on every page.

### Testing
- [ ] Manual: create pending payment, verify retry link; create unpaid account, verify restricted routes.
- [ ] Unit test access-control logic.

### Priority
High.

---

## Prompt 8: Rework team members section / fix invites flow

### Context
Team member invites send, but the section "is not working properly." The exact failures need to be diagnosed and fixed.

### Goal
Audit and fix the team members section so invites are reliable and the UI correctly reflects invite status.

### Acceptance Criteria
- [ ] Sending an invite creates the invite record, sends the email, and shows a success toast.
- [ ] The invitee receives an email with a working acceptance link.
- [ ] Pending invites are clearly listed with status (pending, accepted, expired).
- [ ] Expired invites can be resent or revoked.
- [ ] Duplicate invites for the same email are handled gracefully.
- [ ] Errors during invite creation/sending are surfaced to the user.

### Relevant Files / Patterns
- Likely route: `app/(dashboard)/team/page.tsx`.
- Components: `components/admin/` or `components/dashboard/`.
- Email templates: `emails/invitation.tsx`.
- Server actions: likely `app/(dashboard)/team/actions.ts` or `lib/team/actions.ts`.

### Implementation Notes
- Investigate whether invites are being created but emails fail, or if the invite record itself fails.
- Check Resend configuration and email template rendering.
- Ensure invite tokens are unique and expire after a reasonable period.

### Testing
- [ ] Manual: send invite, accept invite, verify user is added to team.
- [ ] Test email rendering with `pnpm mail:test` or similar.
- [ ] Add unit tests for invite creation and acceptance actions.

### Priority
High — team collaboration is broken.

---

## Prompt 9: Allow team members to switch organisations

### Context
A user who is a team member of multiple restaurants cannot switch between organisations from the dashboard. When accepting an invite - they should be changed to the correct organisation that invited them by default. 

### Goal
Add an organisation switcher so team members can move between restaurants they belong to.

### Acceptance Criteria
- [ ] A dropdown or menu in the dashboard shell lists all organisations the current user belongs to (owner + team member).
- [ ] Selecting an organisation switches the active organisation context.
- [ ] All dashboard data (restaurants, menus, billing, team) updates to the selected organisation.
- [ ] The active organisation is persisted across page navigations (URL segment, cookie, or context).
- [ ] Owners can also use this switcher if they have multiple restaurants.

### Relevant Files / Patterns
- Dashboard layout/shell: `app/(dashboard)/layout.tsx`, likely a sidebar or top-bar component.
- Organisation context may already exist; inspect current routing (e.g., `app/(dashboard)/[orgSlug]/...` or org stored in session).

### Implementation Notes
- Prefer URL-based org switching (`/dashboard/[orgSlug]/...`) if the app doesn't already use it — it is shareable and refresh-safe.
- Update the active organisation in the session/context when switching.
- Ensure RLS policies return data for the selected organisation.

### Testing
- [ ] Manual: add a user to two restaurants, verify switching updates data.
- [ ] Test that a team member cannot access organisations they do not belong to.

### Priority
Medium-High.

---

## Prompt 10: Team member list with edit permissions, delete, promote

### Context
Users can be added to a team, but they don't appear in the team list, and admins cannot edit permissions, delete members, or promote them.

### Goal
Build a complete team member management table with list, edit permissions, delete, and promote-to-owner actions.

### Acceptance Criteria
- [ ] The team page shows a table/card list of all members with their email, role, and status.
- [ ] Each member has an action to edit permissions/role.
- [ ] Each member has a delete action with confirmation (cannot delete the sole owner).
- [ ] Each member has a promote-to-owner action with confirmation.
- [ ] Changes reflect immediately in the UI.
- [ ] Only owners/admins can perform these actions (enforce server-side).

### Relevant Files / Patterns
- Likely route: `app/(dashboard)/team/page.tsx`.
- Use `Table` from `components/ui/table` and `Dialog` for confirmations.
- Server actions in `app/(dashboard)/team/actions.ts`.

### Implementation Notes
- Define clear roles (e.g., owner, admin, editor, viewer) and what each can do.
- Prevent self-demotion if it would leave the organisation without an owner.
- Audit permissions server-side; never trust client-only checks.

### Testing
- [ ] Manual: invite member, edit role, promote, delete, verify permissions.
- [ ] Unit test permission checks and role transitions.
- [ ] Test that last owner cannot be deleted/demoted.

### Priority
High.

---

## Prompt 11: Fix branding save reliability + replace discard icon with delete button

### Context
Branding changes sometimes don't save, and the refresh icon used to discard changes is ambiguous — users don't understand it resets values.

### Goal
Make branding saves reliable and replace the discard icon with an explicit delete/reset button.

### Acceptance Criteria
- [ ] All branding form fields save consistently when the save action is triggered.
- [ ] Save failures are clearly reported with inline errors or toasts.
- [ ] The discard/reset control is a clearly labeled button (e.g., "Reset changes" or "Delete logo") rather than a refresh icon.
- [ ] The reset action requires confirmation if it will remove uploaded media.

### Relevant Files / Patterns
- Likely route: `app/(dashboard)/settings/branding/page.tsx` or `app/(dashboard)/branding/page.tsx`.
- Components: `components/branding/`.
- Form pattern: `FormField`, `react-hook-form`, `zod`.

### Implementation Notes
- Investigate why saves fail: race condition, missing field in zod schema, optimistic update bug, server action error swallowed?
- Ensure the server action persists every field and returns clear errors.
- If "reset" removes an uploaded logo, use a destructive button variant and confirmation dialog.

### Testing
- [ ] Manual: change each branding field, save, refresh page, verify persistence.
- [ ] Test reset button behavior.
- [ ] Add a component or unit test for the save action if none exists.

### Priority
Medium-High.

---

## Prompt 12: Add undo + obvious publish-to-apply button in branding

### Context
Users make branding changes but are not sure how to apply them to the live menu. They also want an undo option for recent changes.

### Goal
Add an undo action for branding changes and an explicit "Publish to apply changes" button that makes it clear how changes go live.

### Acceptance Criteria
- [ ] Branding changes are staged until explicitly published.
- [ ] An "Undo" action reverts the last change (or all changes since last publish).
- [ ] A prominent "Publish menu / Apply changes" button publishes the branding to the live menu.
- [ ] Unpublished changes are visually indicated (e.g., "Unsaved changes" badge or dot).
- [ ] Publishing shows a success toast and clears the unsaved indicator.

### Relevant Files / Patterns
- Likely route: `app/(dashboard)/settings/branding/page.tsx` or `app/(dashboard)/branding/page.tsx`.
- State management: React state for draft changes; server action for publish.
- Use `Button` variants to distinguish save/publish/undo.

### Implementation Notes
- Decide if staging is purely client-side (draft state) or server-side (draft record). Client-side is simpler; server-side allows cross-device drafts.
- Ensure the public menu only uses published branding, not drafts.
- The undo stack can be simple: store the previous value on each change.

### Testing
- [ ] Manual: change branding, undo, publish, verify live menu reflects published state.
- [ ] Test that drafts are not visible on the public menu before publish.

### Priority
Medium.

---

## Prompt 13: Build super-admin editable help/FAQ section

### Context
Users need self-service help content. Super admins need to manage articles without deploying code.

### Goal
Build a help/FAQ section with articles that have categories, topics, screenshots, and videos. Content is editable by super admins and searchable/filterable by all users.

### Acceptance Criteria
- [ ] A public or authenticated `/help` route displays a list of help articles.
- [ ] Articles have: title, category, topic/tags, rich content, optional screenshots/video URLs.
- [ ] Users can search articles by keyword and filter by category/topic.
- [ ] Super admins have a management UI to create, edit, and delete articles.
- [ ] Article content supports basic formatting (headings, lists, links). Use a simple rich-text approach or markdown.
- [ ] Media uploads within articles reuse the existing media library if possible.

### Relevant Files / Patterns
- New routes: `app/help/page.tsx`, `app/(dashboard)/admin/help/page.tsx` (or similar).
- New components: `components/help/`.
- New schema: `help_articles`, `help_categories` tables via Supabase migration.
- Use `Input`, `Select`, `Dialog`, `Card`, `Table` from `components/ui/`.

### Implementation Notes
- Keep the schema simple: `help_articles(id, title, slug, category, topics, content, screenshots[], video_url, created_at, updated_at, published boolean)`.
- Slugify titles for SEO-friendly URLs.
- Super admin check: likely based on a role column in `profiles` or a dedicated `is_super_admin` flag.
- Consider reusing the existing media upload component for screenshots.

### Testing
- [ ] Manual: create article as super admin, view as user, search/filter.
- [ ] Unit test slug generation and search filtering.
- [ ] Playwright test for CRUD if admin e2e tests exist.

### Priority
Medium.

---

## Prompt 14: Add back button on public menu about page

### Context
When viewing a public menu and navigating to the about page, there is no way to return to the menu without the browser back button.

### Goal
Add a clear back button on the public menu about page that returns the user to the menu.

### Acceptance Criteria
- [ ] The about page (`/m/[restaurantSlug]/about` or similar) displays a back button.
- [ ] Clicking it navigates back to the restaurant's menu.
- [ ] The button is accessible and uses the project icon library (`lucide-react`).
- [ ] It works on mobile and desktop.

### Relevant Files / Patterns
- Public routes: `app/m/[...]/about/page.tsx` or equivalent.
- Use `ArrowLeft` icon from `lucide-react`.
- Use `next/link` or `router.back()` depending on desired behavior.

### Implementation Notes
- Prefer `next/link` back to the menu route so the link is predictable and works when opened in a new tab.
- Place the button in a consistent location (top-left or below the header).

### Testing
- [ ] Manual: visit about page from menu, click back, return to menu.
- [ ] Component test: render about page, assert back link href.

### Priority
Low — small UX improvement.

---

## Prompt 15: Enforce menu hiding when subscription is paused/cancelled

### Context
Public menus should not be visible when the restaurant's subscription is paused or cancelled. This overlaps with Prompt 6 but focuses on the paused/cancelled states specifically.

### Goal
Ensure the public menu query checks subscription status and returns 404 when paused or cancelled.

### Acceptance Criteria
- [ ] Public menu data fetch checks the restaurant's subscription status.
- [ ] If status is `paused` or `cancelled`, the public menu returns 404.
- [ ] The check covers both the menu list/index and individual menu pages.
- [ ] No data for the restaurant is leaked in the 404 response.

### Relevant Files / Patterns
- Public routes: `app/m/[...]/page.tsx`.
- Subscription helper created in Prompt 6 (reuse or coordinate).

### Implementation Notes
- This prompt and Prompt 6 should share a single subscription-status utility.
- If Prompt 6 is implemented first, build on top of it. If this is implemented first, design the utility so Prompt 6 can reuse it.
- Consider cached subscription status if public routes are high-traffic.

### Testing
- [ ] Manual: pause subscription, verify public menu 404s; reactivate, verify menu returns.
- [ ] Unit test the status-to-visibility mapping.
- [ ] Playwright test for paused/cancelled → 404.

### Priority
High.

---

## Coordination Notes

- **Prompts 5, 6, 7, and 15** all touch subscription status and PayFast. Coordinate on a shared subscription-status helper in `lib/billing/` or `lib/data/`.
- **Prompts 11 and 12** both touch branding UI. Consider implementing them together or in sequence to avoid UI conflicts.
- **Prompts 8, 9, and 10** all touch team members. Implement in the order listed: fix invites, then org switching, then full member management.
