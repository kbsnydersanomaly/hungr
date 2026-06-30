# Help Category Management — Design Spec

## Context

The help center already has a `help_categories` table and a Category dropdown in the super-admin article form. However, there is currently no super-admin UI to create, edit, reorder, or delete categories. Categories can only be manipulated directly in the database.

## Goal

Add an inline category-management UI to the existing `/admin/help` page so super admins can manage help categories without touching the database.

## Out of Scope

- Changing the public `/help` page or article detail page.
- Adding category descriptions or icons (only name, slug, and sort order).
- Drag-and-drop reordering in the first iteration (sort-order editing via numeric input is sufficient).

## Data Model

The existing schema in `supabase/migrations/20260624130000_help_articles.sql` is used as-is:

```sql
create table if not exists help_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

RLS policies already restrict writes to super admins and allow public reads.

## Server Actions

Extend `lib/data/help-actions.ts` with the following functions, following the existing `safeAction` + `requireSuperAdmin` pattern:

### `createHelpCategory(formData: FormData)`

- Parse `name` (required, max 200), `slug` (optional, auto-generated from name if blank), and `sort_order` (integer, default 0).
- Validate slug format and ensure uniqueness via DB constraint.
- Insert into `help_categories`.
- Return `{ id }` on success.

### `updateHelpCategory(id: string, formData: FormData)`

- Validate same fields as create.
- Update the matching row and set `updated_at = now()`.
- Return `{ updated: true }`.

### `deleteHelpCategory(id: string)`

- Delete the category. Articles referencing it will have `category_id` set to `null` via the existing `on delete set null` FK.
- Return `{ deleted: true }`.

### `updateHelpCategorySortOrders(updates: { id: string; sort_order: number }[])`

- Bulk update `sort_order` for the provided category IDs.
- Only used if drag-and-drop reordering is implemented; otherwise sort order is edited per category.

## Components

### `components/help/HelpCategoryManager.tsx`

A client component that owns the category-management dialog.

Responsibilities:
- Render a "Manage categories" trigger button.
- Open a `Dialog` titled "Help categories".
- Fetch/display the current category list ordered by `sort_order`.
- Provide an inline create form at the top of the dialog.
- Render each category row with:
  - Name, slug, and sort-order display.
  - Edit button that switches the row to an inline edit form.
  - Delete button with a confirmation step.
- Use `useTransition` + `router.refresh()` to keep the underlying `/admin/help` page in sync when the dialog closes.

### Inline create/edit form

- Fields: Name, Slug (with auto-fill from name on create), Sort order.
- Save button triggers the relevant server action.
- Cancel button resets the form.

### Delete confirmation

- Inline confirmation state per row or a small nested `Dialog` warning that articles currently in the category will become uncategorized.

## Page Changes

### `app/(dashboard)/admin/help/page.tsx`

Add a "Manage categories" button next to the existing "Manage media" button in the header actions area. Pass the current category list to `HelpCategoryManager` so it can render immediately without a separate fetch.

## UI/UX Details

- The dialog should be `max-w-md` or `max-w-lg`.
- Sort order is a small numeric input.
- Empty state: "No categories yet."
- Error states use `toast` for server-action failures, consistent with `AdminArticleActions`.
- After create/update/delete, refresh the page route so the category filter dropdown and article badges reflect changes.

## Error Handling

- Validation errors from Zod are surfaced as `ValidationError` messages.
- Slug collisions are caught at the DB level and returned as a user-friendly message.
- Delete errors are logged and shown via toast.

## Testing

- Manual:
  - Create a category from `/admin/help`.
  - Edit its name and slug.
  - Delete a category with articles and confirm articles become uncategorized.
  - Verify the article form's category dropdown includes the new category.
  - Verify the public `/help` page still filters by category correctly.
- E2E (if existing admin CRUD tests exist): add a Playwright test for category creation and deletion.

## Open Questions / Future Work

- Drag-and-drop reordering can be added later using `@dnd-kit/sortable`, which is already a project dependency.
- Category descriptions or icons can be added later by extending the table and form.

## Files to Modify

- `lib/data/help-actions.ts` — add server actions.
- `components/help/HelpCategoryManager.tsx` — new component.
- `app/(dashboard)/admin/help/page.tsx` — add trigger button.

## Success Criteria

- A super admin can open the category manager from `/admin/help`.
- Categories can be created, edited, and deleted without database access.
- Changes are reflected immediately in the article form's category dropdown and the admin category filter.
- Articles in a deleted category remain accessible but show no category badge.
