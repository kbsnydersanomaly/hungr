# Unified Auth Entry Point + Cellphone Field

## Status

Design approved. Waiting for implementation plan.

## Goal

Replace the current public marketing surface with a single, unified sign-in page that is the only destination for unauthenticated users. The page must match the provided two-column design and embed both sign-in and sign-up flows. Sign-up must also collect a South African cellphone number, store it on the user profile, and allow editing it from profile settings.

## Context

- The project is a Next.js app using Supabase Auth and SSR (`@supabase/ssr`).
- Existing auth routes live under `app/(auth)/` (`/sign-in`, `/sign-up`, `/forgot`, `/reset`, `/verify`, `/accept-invite/[token]`).
- Existing marketing routes live under `app/(marketing)/` (`/`, `/pricing`, `/contact-sales`).
- Existing profile settings live at `/settings/profile` and edit `public.profiles` via `lib/data/profile-actions.ts`.
- Current sign-up collects email, password, first/last name, and an optional organisation name. New users are created unconfirmed and must verify by email before signing in.
- No middleware currently protects routes.

## Decisions from brainstorming

| Question | Decision |
| --- | --- |
| Which guest pages become the login page? | All unauthenticated routes redirect to `/sign-in`. Marketing pages are removed. |
| Sign-up handling | Embedded toggle on `/sign-in`; no separate `/sign-up` page. |
| Login identifier | Email (keeps existing Supabase auth backend). |
| Post-login redirect | Default dashboard/role home. Preserve `?next=` when available. |
| Marketing page disposition | Remove marketing pages from this codebase entirely. |
| Canonical auth URL | `/sign-in`. |
| Phone validation | Required, South African cellphone format, no SMS verification. |

## Design

### 1. Redirect behavior

Create `middleware.ts` at the project root. It must:

1. Refresh the Supabase session from cookies.
2. Allow public access to:
   - `/sign-in`
   - `/forgot`
   - `/reset`
   - `/verify`
   - `/accept-invite/*`
   - Static assets (`/_next/`, `/public/`, etc.)
3. Redirect all other unauthenticated requests to `/sign-in`.
4. Preserve the originally requested path in a `?next=` query parameter so a user who tries `/dashboard` while logged out lands at `/sign-in?next=/dashboard` and is returned after login.
5. Redirect authenticated users who visit the removed root `/` to `/dashboard`.
6. Redirect the legacy `/sign-up` path to `/sign-in` so old links/bookmarks land on the unified page.

The existing `sign-in-form.tsx` already reads `?next=` and defaults to `/dashboard`, so this behavior is reused.

### 2. Page layout

`/sign-in` becomes a full-viewport two-column page:

- **Left column**
  - Background image: `public/login.webp`
  - Tagline: *“HUNGRY TO CREATE BETTER GUEST EXPERIENCES?”*
  - Subtext: *“Mobile menu and order & pay software for the hospitality industry.”*
- **Right column**
  - Logo: `public/Logo.svg`
  - Form heading toggles between **LOG IN** and **SIGN UP**
  - The active form
  - Footer toggle link: *“Don’t have an account? Sign up”* / *“Already have an account? Sign in”*

Responsive behavior:

- `md` and up: two-column split as in the design.
- Below `md`: left image column hidden; right column is full-width and centered.

### 3. Sign-in mode

Reuse the existing `signInAction` and validation:

- Email
- Password
- “Forgot Password?” link → `/forgot`
- “Log in” button
- Existing unconfirmed-email resend flow stays unchanged.

### 4. Sign-up mode

Reuse the existing `signUpAction` and extend it for cellphone collection:

- First name
- Last name
- Email
- **Cellphone** (South African format)
- Password
- Confirm password
- Organisation name (optional, kept from current form)
- “Sign up” button

After submission, show the existing verification message: *“Check your email to verify your account.”*

### 5. Cellphone data model

1. Add a nullable `phone text` column to `public.profiles` via a new migration.
2. Validate the field with a South African cellphone regex in:
   - `lib/schemas/auth.ts` (`SignUpSchema`)
   - A new or updated profile update schema
3. Pass the phone number in `user_metadata.phone` when calling `adminClient.auth.admin.createUser` in `signUpAction`.
4. Update the `handle_new_user()` trigger (and the related org-name/invite triggers) to write `new.raw_user_meta_data->>'phone'` into `profiles.phone`.
5. Add the phone field to `/settings/profile` and update `updateProfile` to save it.

Phone format rules (South African):

- Accept local forms such as `0821234567`, `082 123 4567`, `(082) 123 4567`.
- Accept international forms such as `+27821234567`, `+27 82 123 4567`.
- Normalize to a consistent canonical form for storage (recommended: E.164, e.g., `+27821234567`).
- Do not send SMS verification; validation is regex-only.

### 6. Existing pages to remove

- `app/(marketing)/layout.tsx`
- `app/(marketing)/page.tsx`
- `app/(marketing)/pricing/page.tsx`
- `app/(marketing)/contact-sales/page.tsx`
- Any marketing-only components that are no longer referenced.

### 7. Out of scope

- SMS/OTP verification.
- Username-based login.
- Moving marketing content to a separate site (content is deleted, not relocated).
- Redesigning `/forgot`, `/reset`, `/verify`, or `/accept-invite/[token]` (they remain functional but keep their current styling for now).

## Error handling

- Form-level validation errors come from Zod (`lib/schemas/auth.ts`) and are displayed inline.
- Server action errors are surfaced by the existing `safeAction` wrapper.
- The unconfirmed-email resend flow remains as-is in `sign-in-form.tsx`.
- Middleware should not throw on missing session; it simply redirects.

## Testing considerations

- Update existing E2E tests that rely on `/` or `/pricing` as entry points.
- Add E2E coverage for:
  - Unauthenticated access to `/dashboard` redirects to `/sign-in`.
  - Sign-up with an invalid SA cellphone shows a validation error.
  - Sign-up with a valid cellphone creates the profile with the normalized number.
  - Editing the cellphone in `/settings/profile` persists correctly.
- Add unit tests for the SA cellphone regex.

## Affected files (expected)

- New: `middleware.ts`
- Modify: `app/(auth)/sign-in/page.tsx`, `app/(auth)/sign-in/sign-in-form.tsx`
- Modify: `app/(auth)/layout.tsx` (or replace with page-specific layout for the two-column design)
- Remove or redirect: `app/(auth)/sign-up/*` (sign-up moves into `/sign-in`)
- Modify: `lib/schemas/auth.ts`, `lib/auth/actions.ts`, `lib/data/profile-actions.ts`
- Modify: `app/(dashboard)/settings/profile/page.tsx`
- Modify: `supabase/migrations/*` (new migration for `profiles.phone` and trigger updates)
- Delete: `app/(marketing)/*`
