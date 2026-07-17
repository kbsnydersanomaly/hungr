# Loading-state UX: auth/invite buttons + navigation cues

**Date:** 2026-07-17
**Goal:** Every button that triggers async work shows a spinner and stays disabled for the *entire* busy period (action + subsequent navigation), and every in-app navigation gives the user an immediate visual cue.

## Findings

Building on `docs/done/2026-06-24-loading-spinners-server-actions.md` (which covered dashboard server-action buttons), an audit of the remaining flows found:

1. **Accept-invite page had no pending state at all** — three server-action forms used plain `<Button type="submit">`.
2. **Sign-in cleared its loading state too early** — `setLoading(false)` ran before `router.push(next)`, so the button re-enabled and sat idle while the `force-dynamic` dashboard layout rendered. This was the "spinner disappears, page sits static" complaint.
3. **Sign-up / forgot / reset** showed text-only loading ("Creating account...") with no spinner icon, inconsistent with the `SubmitButton` convention.
4. **Navigation gave no click acknowledgment** — sidebar links, tab nav, and the public-menu `MenuSwitcher` are plain links / `router.push` with no pending indicator. Route-level `loading.tsx` fallbacks exist, but they don't acknowledge the click itself and don't cover cross-route-group transitions (e.g. `/sign-in` → `/dashboard`).

## What was done

### Buttons

- `app/(auth)/accept-invite/[token]/page.tsx` — all three submit buttons (Accept invitation, Sign out and use the correct email, Create account & accept) now use the existing `SubmitButton` (`useFormStatus` spinner + disable).
- `app/(auth)/sign-in/sign-in-form.tsx` — added `Loader2` spinner; the success-path navigation is wrapped in `useTransition` (`startTransition(() => { router.push(next); router.refresh(); })`) and the busy state is `loading || isNavigating`, so the button stays disabled+spinning until the navigation commits. `loading` is only reset on the error path. Resend-verification button also got a spinner.
- `app/(auth)/sign-in/sign-up-form.tsx`, `forgot/page.tsx`, `reset/page.tsx` — added `Loader2` spinner alongside the existing loading text.

### Navigation cues

- New `components/dashboard/LinkPendingHint.tsx` — fixed-size pulsing dot driven by Next's `useLinkStatus()` (Next ≥15.3; project is on 16.2.4). Mounted inside `SidebarNavLink`, `SidebarPlainLink`, and `TabNav`. CSS in `app/globals.css` (`.link-hint` / `.is-pending`): always rendered at a fixed size (no layout shift), fades in after a ~120ms delay so fast navigations never flash it (pattern from the bundled Next docs).
- `components/menu/MenuSwitcher.tsx` — menu switching wrapped in `useTransition`; the trigger shows a spinner (replacing the chevron) and `aria-busy` while pending.
- New `components/NavigationProgress.tsx` mounted in `app/layout.tsx` — thin fixed top progress bar that starts on any internal link click (capture-phase listener; ignores new-tab/modifier clicks, external URLs, downloads, and same-URL/hash clicks) and on `popstate`, trickles toward 85%, and completes when the pathname commits. Failsafe auto-completes after 8s so an aborted navigation never leaves it running. Uses `usePathname` only — deliberately not `useSearchParams`, which would force a Suspense boundary onto every static page.

### Tests

- `tests/components/SignInForm.test.tsx` — error path shows the message and re-enables the button; success path keeps the button disabled with a spinner after the action resolves and calls `router.push("/dashboard")`.
- `tests/components/LinkPendingHint.test.tsx` — hint gets `is-pending` while its link is navigating, stays hidden otherwise; `SidebarNavLink` renders the hint inside the link.

## Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | ✅ Passed |
| `pnpm test --run` | ✅ 445 tests passed (57 files) |
| `pnpm build` | ✅ Passed |

## Deployment notes

- No database migrations, env changes, or new dependencies.
- Purely client-side UX changes; deploy via the normal `pnpm build` pipeline.
