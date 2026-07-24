---
name: hungr-next-ui-work
description: Use when changing Hungr Next.js routes, layouts, proxy behaviour, React components, forms, navigation, loading states, Tailwind styling, or UI primitives.
---

# Hungr Next.js and UI Work

## Version Rule

Project uses Next.js 16.2.4 and React 19.2.4.

Before writing Next.js code, read relevant bundled guide under `node_modules/next/dist/docs/`, as required by `AGENTS.md`. If dependencies or bundled docs are unavailable, state that and use official documentation matching installed Next.js version. Do not rely on older Next.js conventions from memory.

## Architecture

- Use App Router and existing route groups.
- Use `proxy.ts`, not legacy `middleware.ts`.
- Prefer Server Components.
- Add `"use client"` only for state, effects, browser APIs, or event handlers.
- Await asynchronous Next.js request APIs such as `cookies()` through established project helpers.
- Keep public patron/menu routes separate from authenticated restaurant dashboard routes.
- Preserve redirect targets and active organisation/restaurant context.

## Current Component Rules

- Reuse `components/ui/` and existing feature components before adding primitives.
- Inspect primitive implementation before composing it. Current primitives do not all expose identical composition APIs.
- Current Button supports Radix `asChild`.
- Current Base UI Dialog composition uses `render`; do not assume Radix Dialog APIs.
- Use `lucide-react` only for icons.
- Use Tailwind theme tokens rather than hard-coded colours where tokens exist.
- Preserve Poppins body and Figtree heading conventions.
- Maintain accessible names, descriptions, focus return, keyboard behaviour, and destructive confirmations.
- Verify mobile and desktop layouts.

## Forms and Async Actions

- Disable relevant controls for entire pending period.
- Show `Loader2` or established pending UI.
- Use existing `SubmitButton`, `ServerActionForm`, `useFormStatus`, `useTransition`, or `use-action` pattern appropriate to current caller.
- Inspect `ActionResult`; never show success before confirmed `ok` result.
- Preserve user input after validation/network failure.
- Keep pending state through subsequent navigation when action triggers route change.
- Use `sonner` for action feedback where current feature uses toasts.
- Guard destructive close/navigation when locally edited data would be lost.

## Data Loading and Realtime

- Database remains source of truth.
- Realtime should invalidate or refresh authoritative state, not become sole state store.
- On reconnect, reload rows needed to recover missed events.
- Keep subscription cleanup and tenant filters explicit.

## Testing

Add/update component tests for behaviour, accessibility, pending state, server errors, navigation, and mobile-sensitive interactions. Add targeted Playwright coverage for critical multi-page journeys.

## References

Read current versions before changing related code:

- `AGENTS.md`
- `package.json`
- `proxy.ts`
- `lib/supabase/server.ts`
- `components/ui/button.tsx`
- `components/ui/dialog.tsx`
- `components/ui/link-button.tsx`
- `components/forms/SubmitButton.tsx`
- `components/forms/ServerActionForm.tsx`
- `components/dashboard/LinkPendingHint.tsx`
- `components/NavigationProgress.tsx`
- `DESIGN_SYSTEM.md` as guidance only; verify against current primitives
- `tests/components/`
