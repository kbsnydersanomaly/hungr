# Prompt 12: Branding undo/redo + explicit publish — Implementation Notes

**Date:** 2026-06-24  
**Priority:** Medium

## Summary

Most of this prompt was already satisfied by the existing branding draft/publish system
(staged drafts in `branding_drafts`, a "Publish changes" button, an "Unsaved changes"
indicator, a success toast, and a public menu that only reads published branding). The
only missing capability was an **Undo** action, so the work here adds a client-side
**undo/redo history** to the branding editor (the user requested undo **and** redo,
stepping one change at a time).

## What already existed (no change needed)

- **Staged until published** — edits live in the `branding_drafts` table; the public menu
  loads published branding via `loadBranding` (drafts via `loadBrandingDraft` only in the
  editor preview).
- **Prominent publish button** — "Publish changes" calls `publishAction`.
- **Unpublished-changes indicator** — "Unsaved changes" / "All changes saved" status.
- **Success toast + cleared indicator** — "Branding published" toast; status resets.

## What was added

- `components/branding/BrandingEditor.tsx`
  - Added an undo/redo history stack: each user edit pushes a `BrandingData` snapshot
    tagged with the field that changed.
  - **Coalescing** — consecutive edits to the *same* field replace the previous step
    instead of adding a new one, so typing/dragging a single colour is one undo step
    rather than one per keystroke.
  - **Redo branch** — editing after an undo discards the orphaned redo branch (standard
    undo-stack behaviour).
  - Editing now flows through a single `commit(next, fieldKey)` helper; `update` and
    `updateNested` delegate to it. `handleUndo` / `handleRedo` navigate the stack and set
    `draftState` (which then autosaves the resulting state, so undo/redo is persisted to
    the draft but never to the live menu until publish).
  - **Reset to published** clears the history (new baseline).
  - Added **Undo** and **Redo** toolbar buttons (lucide `Undo2` / `Redo2`), disabled when
    there is nothing to undo/redo.

- `tests/components/BrandingEditor.test.tsx`
  - Undo/Redo start disabled with no history.
  - Editing enables Undo; undo reverts the value and enables Redo; redo re-applies it.
  - Consecutive edits to the same field coalesce into a single undo step.

## Verification

```bash
npx vitest run --project components --project node   # 113 passed
npx tsc --noEmit        # no new errors in branding files
npx eslint components/branding/BrandingEditor.tsx     # clean
```

Manual checks:
- Change branding, click Undo to step back through edits, Redo to step forward.
- Publish and confirm the live menu reflects the published state.
- Confirm drafts/undone states are not visible on the public menu before publishing.

## Acceptance criteria status

- [x] Branding changes are staged until explicitly published (pre-existing draft system).
- [x] An Undo action reverts the last change (now per-step undo, plus redo).
- [x] Prominent "Publish changes" button applies branding to the live menu (pre-existing).
- [x] Unpublished changes are visually indicated ("Unsaved changes" status, pre-existing).
- [x] Publishing shows a success toast and clears the indicator (pre-existing).

## Design decisions / caveats

- **Client-side history.** The undo stack is in-memory React state, so it does not persist
  across page reloads or devices (the *draft* itself does persist server-side; only the
  step-by-step history is ephemeral). This matches the prompt's "client-side is simpler"
  note and keeps the public menu strictly on published branding.
- **No keyboard shortcuts.** Ctrl/Cmd+Z is intentionally *not* bound, to avoid clobbering
  native text-undo while typing in the colour/hex inputs. Undo/redo is via the toolbar
  buttons. This could be revisited if a global shortcut is desired.
- **Coalescing granularity** is per field key (e.g. `primary_color`, `main_heading.color`,
  `logo`). Switching fields starts a new undo step.

## Deployment notes

- **No database migration** and **no env/config changes** — purely client-side editor
  behaviour.
- Ships with a normal build/deploy.
