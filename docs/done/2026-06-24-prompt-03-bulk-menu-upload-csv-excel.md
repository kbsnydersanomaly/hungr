# Prompt 3: Bulk menu upload via CSV/Excel modal

## Summary
Added a "Bulk upload" modal to the menu workspace that lets restaurant owners download a
sample spreadsheet, fill it in, and upload it to **add**, **modify**, or **replace** the items
on a menu. Files are parsed and validated client-side (with row-level error feedback) and the
chosen operation is applied by a single server action that returns a summary.

## Acceptance Criteria
- [x] A "Bulk upload" button opens a modal from the menu workspace page.
- [x] The modal provides a downloadable sample CSV showing the expected columns.
- [x] The user can select an upload mode: add new items, modify existing items, or replace the entire menu.
- [x] Uploading parses the file (CSV/Excel) and applies the chosen operation.
- [x] Clear validation errors are shown for malformed rows (row number, field, reason).
- [x] A summary is shown at the end: added, updated, skipped, failed (plus categories created).
- [x] Large files are handled gracefully — a row cap (2000) is enforced with a clear error.

## Placement Note
Menu items are scoped to a specific menu, not the restaurant-level menus list. The button
therefore lives on the **menu workspace page**
(`app/(dashboard)/restaurants/[restaurantId]/menus/[menuId]/page.tsx`), in the toolbar next to
Publish — matching the existing model where every item action takes a `menuId`.

## Files Changed
- `lib/menu/bulk-upload.ts` (new) — framework-free parse + validation, shared by client and server:
  - `parseSpreadsheet(file)` — papaparse for `.csv`, `xlsx`/SheetJS for `.xlsx`/`.xls`;
    case-insensitive header normalization; `MAX_ROWS` (2000) cap; clear errors for empty/unsupported files.
  - `BulkRowSchema` + `validateRows(rows)` — zod validation mirroring `lib/schemas/menu.ts`'s
    `ItemSchema`; converts `price → price_cents` via `Math.round(value * 100)` (same convention as
    `upsertItem`); splits semicolon-separated allergens/labels; validates optional image URL.
    Returns `{ valid, errors }` where errors are `{ row, field, reason }` (1-based incl. header).
  - `buildSampleCsv()` / `SAMPLE_ROWS` — downloadable sample.
  - Shared types: `BulkUploadMode`, `ParsedRow`, `RawRow`, `RowError`, `BulkUploadPayload`, `BulkUploadSummary`.
- `lib/data/menu-actions.ts` — added `bulkUpsertItems(menuId, { mode, rows })`:
  - Follows existing pattern: `loadMenuById` → `requireRestaurantAccess(..., "manager")` →
    `safeAction` → `writeAudit` → `revalidatePath`.
  - Re-validates rows server-side (never trusts the client).
  - Auto-creates any categories referenced in the file that don't exist yet (case-insensitive).
  - **add:** insert new items, skip ones whose name already exists in the same category.
  - **modify:** update items matched by name within their category, skip unmatched.
  - **replace:** delete all existing items on the menu (categories preserved), then insert.
  - Returns `{ added, updated, skipped, failed, categoriesCreated, errors }`.
- `components/menu/BulkUploadModal.tsx` (new) — client modal using the existing `Dialog`/`Select`/
  `Table`/`Button` primitives (mirrors `MediaUploadDialog` trigger pattern). Mode select with helper
  text, sample download, file input (`.csv,.xlsx,.xls`), preview table, row/field/reason error list,
  a destructive confirmation checkbox for **replace**, and a final summary with sonner toasts.
- `app/(dashboard)/restaurants/[restaurantId]/menus/[menuId]/page.tsx` — wired `<BulkUploadModal />`
  into the workspace toolbar.
- `tests/unit/bulk-upload.test.ts` (new) — validation/parsing tests: valid rows, price→cents
  conversion and rounding, semicolon list splitting, blank→null, missing name/category, non-numeric
  and negative price, bad/valid image URL, empty input; CSV header normalization, unsupported type,
  empty file, row-cap overflow; sample CSV round-trips through validation.
- `tests/components/BulkUploadModal.test.tsx` (new) — renders the modal, uploads a CSV, asserts the
  preview rows and a row/field/reason error, and verifies submit calls `bulkUpsertItems` with the raw
  rows and shows the summary.

## Dependencies Added
- `papaparse` (CSV) + `@types/papaparse` (dev)
- `xlsx` / SheetJS (Excel)

## Implementation Notes
- **Single source of truth for validation:** the client sends raw rows; the server re-runs the same
  `validateRows`, so client and server can never diverge and the action is safe on its own.
- **Identifier for "modify":** item **name** within its resolved category.
- **Columns:** `name`, `description`, `price`, `category` (required: name, price, category) plus
  `allergens`, `labels` (semicolon-separated), `image_url`.
- **Price** stored as cents; `image_url` mirrored into `image_urls: [url]` exactly like `upsertItem`.
- After a successful upload the action calls `revalidatePath`, so `MenuWorkspace` re-syncs via its
  existing derived-state-from-props pattern (no extra client refetch).

## Out of Scope (v1)
- Complex option columns (preparations/variations/sides/sauces) and multi-image arrays.
- True streaming/chunked parsing — a 2000-row cap stands in, sufficient for expected menu sizes.
- Playwright e2e happy-path (existing `menu-management.spec.ts` needs a running stack with
  auth/seed); left for a manual/e2e pass.

## Verification
- `tsc --noEmit` — clean
- `eslint` on all changed files — clean
- `pnpm vitest run --project node --project components` — full suite 71/71 passed
  (includes the new `bulk-upload` unit tests and `BulkUploadModal` component tests)
