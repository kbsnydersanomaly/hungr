# Prompt 4: Search bar for media upload panel

## Summary
Added a real-time search input to the media panel that filters uploaded media by filename. The search bar appears at the top of the media library and picker dialogs.

## Acceptance Criteria
- [x] A search input is visible at the top of the media panel.
- [x] Typing filters the displayed media items immediately (client-side).
- [x] Empty state updates to "No media matches your search" when there are no results.
- [x] Search state is cleared with a clear button or by deleting the query.

## Files Changed
- `components/dashboard/MediaLibrary.tsx` — added search input, client-side filtering, clear button, and updated empty state.
- `tests/components/MediaLibrary.test.tsx` — added component tests for search behavior.

## Implementation Notes
- Media is fetched in full via `listMediaForRestaurant` (no pagination), so client-side filtering in React state was the right fit.
- Filter matches `item.name` with a case-insensitive partial match. Whitespace is trimmed from the query.
- The `name` field is also used as the image `alt` attribute in the UI; there is no dedicated `alt` column in the `media` table.

## Verification
- `pnpm test tests/components/MediaLibrary.test.tsx` — 6/6 passed
- `pnpm lint` — passed
- `pnpm test` — full suite 53/53 passed
