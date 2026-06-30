# Unified Auth + Cellphone Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace public marketing pages with a unified `/sign-in` page that embeds sign-in and sign-up, protect all routes with `proxy.ts`, and add a required South African cellphone number to sign-up and profile settings.

**Architecture:** Use `proxy.ts` to redirect unauthenticated traffic to `/sign-in` and authenticated `/` to `/dashboard`. Build a two-column auth layout shared by all `(auth)` pages. Embed sign-up as a mode inside `/sign-in`. Store phone in `profiles.phone`, validated by a small utility, and propagate it from `user_metadata` via the `handle_new_user` trigger.

**Tech Stack:** Next.js 16 (Proxy), React 19, Supabase SSR, Zod, Tailwind CSS, Vitest, Playwright.

---

## File structure

| File | Responsibility |
| --- | --- |
| `lib/utils/phone.ts` | South African cellphone normalization / validation |
| `tests/unit/phone.test.ts` | Unit tests for phone utility |
| `supabase/migrations/20260629100000_profile_phone.sql` | Add `profiles.phone` and update `handle_new_user` trigger |
| `lib/schemas/auth.ts` | Add `phone` to `SignUpSchema` |
| `lib/schemas/profile.ts` | `UpdateProfileSchema` with optional phone validation |
| `lib/auth/actions.ts` | Pass normalized phone in sign-up metadata |
| `lib/data/profile-actions.ts` | Save phone from profile settings |
| `proxy.ts` | Redirect guests to `/sign-in`, legacy `/sign-up` to `/sign-in`, authenticated `/` to `/dashboard` |
| `app/(auth)/layout.tsx` | Two-column layout (image left, logo + form right) |
| `app/(auth)/sign-in/page.tsx` | Mode toggle wrapper |
| `app/(auth)/sign-in/sign-in-form.tsx` | Existing sign-in form adapted to new layout/toggle |
| `app/(auth)/sign-in/sign-up-form.tsx` | New embedded sign-up form with cellphone field |
| `app/(auth)/verify/verify-form.tsx` | Update failed-state link to `/sign-in` |
| `app/(dashboard)/settings/profile/page.tsx` | Add editable cellphone field |
| `app/(dashboard)/restaurants/new/page.tsx` | Replace `/pricing` and `/contact-sales` links |
| `tests/e2e/helpers.ts` | Update `signUp` helper to use unified `/sign-in` |
| `tests/e2e/onboarding.spec.ts` | Remove marketing tests, add redirect tests |
| `tests/e2e/auth-redirect.spec.ts` | New redirect E2E coverage |

---

### Task 1: South African phone utility + unit tests

**Files:**
- Create: `lib/utils/phone.ts`
- Create: `tests/unit/phone.test.ts`

- [ ] **Step 1: Write the utility**

```ts
const DIGITS_ONLY = /\D/g;

export function normalizeSouthAfricanPhone(input: string): string | null {
  const digits = input.replace(DIGITS_ONLY, "");
  const normalized = digits.startsWith("0")
    ? `27${digits.slice(1)}`
    : digits.startsWith("27")
    ? digits
    : null;
  if (!normalized) return null;
  if (!/^27[6-8]\d{8}$/.test(normalized)) return null;
  return `+${normalized}`;
}

export function isValidSouthAfricanPhone(input: string): boolean {
  return normalizeSouthAfricanPhone(input) !== null;
}
```

- [ ] **Step 2: Write the tests**

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeSouthAfricanPhone,
  isValidSouthAfricanPhone,
} from "@/lib/utils/phone";

describe("normalizeSouthAfricanPhone", () => {
  it("normalizes local 082 numbers", () => {
    expect(normalizeSouthAfricanPhone("082 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("(082) 123-4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("0821234567")).toBe("+27821234567");
  });

  it("normalizes international +27 numbers", () => {
    expect(normalizeSouthAfricanPhone("+27 82 123 4567")).toBe("+27821234567");
    expect(normalizeSouthAfricanPhone("27821234567")).toBe("+27821234567");
  });

  it("rejects invalid numbers", () => {
    expect(normalizeSouthAfricanPhone("1234567890")).toBeNull();
    expect(normalizeSouthAfricanPhone("082123")).toBeNull();
    expect(normalizeSouthAfricanPhone("")).toBeNull();
    expect(normalizeSouthAfricanPhone("+1 555 123 4567")).toBeNull();
  });
});

describe("isValidSouthAfricanPhone", () => {
  it("accepts valid numbers", () => {
    expect(isValidSouthAfricanPhone("0821234567")).toBe(true);
    expect(isValidSouthAfricanPhone("+27 82 123 4567")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidSouthAfricanPhone("123")).toBe(false);
    expect(isValidSouthAfricanPhone("")).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `pnpm test tests/unit/phone.test.ts`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/utils/phone.ts tests/unit/phone.test.ts
git commit -m "feat(auth): add South African phone normalization utility"
```

---

### Task 2: Add `profiles.phone` column and update trigger

**Files:**
- Create: `supabase/migrations/20260629100000_profile_phone.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add cellphone to profiles.
alter table public.profiles add column if not exists phone text;

-- Recreate handle_new_user so it persists phone from user_metadata.
create or replace function handle_new_user() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_display_name text;
  v_org_name text;
  v_org_id uuid;
  v_base_slug text;
  v_slug text;
begin
  v_display_name := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'User');
  v_org_name := nullif(trim(coalesce(new.raw_user_meta_data->>'org_name', '')), '');
  if v_org_name is null then
    v_org_name := v_display_name || '''s Organization';
  end if;

  insert into public.profiles (id, email, first_name, last_name, display_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    v_display_name,
    nullif(new.raw_user_meta_data->>'phone', '')
  );

  v_base_slug := lower(regexp_replace(regexp_replace(regexp_replace(v_org_name, '[^\w\s-]', '', 'g'), '[\s_-]+', '-', 'g'), '^-+|-+$', '', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'org';
  end if;

  v_slug := v_base_slug;
  while exists (select 1 from public.organizations where slug = v_slug) loop
    v_slug := v_base_slug || '-' || floor(random() * 10000)::text;
  end loop;

  insert into public.organizations (name, slug, owner_id)
  values (v_org_name, v_slug, new.id)
  returning id into v_org_id;

  insert into organization_members (org_id, user_id, role, invited_by)
  values (v_org_id, new.id, 'owner', new.id);

  update public.profiles set default_org_id = v_org_id where id = new.id;

  return new;
end $$;
```

- [ ] **Step 2: Apply the migration locally**

Run: `pnpm db:migrate`
Expected: migration applies successfully.

- [ ] **Step 3: Regenerate TypeScript database types**

Run: `pnpm db:gen-types`
Expected: `lib/database.types.ts` is updated with `phone?: string | null` in `profiles.Row/Insert/Update`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260629100000_profile_phone.sql lib/database.types.ts
git commit -m "feat(db): add profiles.phone column and trigger support"
```

---

### Task 3: Add phone validation to auth and profile schemas

**Files:**
- Modify: `lib/schemas/auth.ts`
- Create: `lib/schemas/profile.ts`

- [ ] **Step 1: Update SignUpSchema**

Modify `lib/schemas/auth.ts` to import the validator and add the `phone` field:

```ts
import { isValidSouthAfricanPhone } from "@/lib/utils/phone";

export const SignUpSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().refine(isValidSouthAfricanPhone, {
      message: "Please enter a valid South African cellphone number",
    }),
    organizationName: z
      .string()
      .trim()
      .max(120, "Organisation name is too long")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
```

- [ ] **Step 2: Create UpdateProfileSchema**

Create `lib/schemas/profile.ts`:

```ts
import { z } from "zod";
import { isValidSouthAfricanPhone } from "@/lib/utils/phone";

export const UpdateProfileSchema = z.object({
  display_name: z.string().min(1, "Display name is required"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z
    .string()
    .refine((v) => !v || isValidSouthAfricanPhone(v), {
      message: "Please enter a valid South African cellphone number",
    })
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/auth.ts lib/schemas/profile.ts
git commit -m "feat(schemas): add SA phone validation to sign-up and profile"
```

---

### Task 4: Pass phone through sign-up server action

**Files:**
- Modify: `lib/auth/actions.ts`

- [ ] **Step 1: Update signUpAction metadata**

Add the import at the top:

```ts
import { normalizeSouthAfricanPhone } from "@/lib/utils/phone";
```

Update the metadata object inside `signUpAction`:

```ts
const metadata = {
  first_name: parsed.firstName,
  last_name: parsed.lastName,
  display_name: `${parsed.firstName} ${parsed.lastName}`,
  phone: normalizeSouthAfricanPhone(parsed.phone),
  ...(parsed.organizationName
    ? { org_name: parsed.organizationName }
    : {}),
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth/actions.ts
git commit -m "feat(auth): persist normalized cellphone during sign-up"
```

---

### Task 5: Save phone in profile update action

**Files:**
- Modify: `lib/data/profile-actions.ts`

- [ ] **Step 1: Replace updateProfile with schema-driven validation**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { safeAction } from "@/lib/errors";
import { UpdateProfileSchema } from "@/lib/schemas/profile";
import { normalizeSouthAfricanPhone } from "@/lib/utils/phone";

export async function updateProfile(formData: FormData) {
  return safeAction(async () => {
    const { user } = await requireSession();

    const raw = Object.fromEntries(formData);
    const parsed = UpdateProfileSchema.parse(raw);

    const normalizedPhone = parsed.phone
      ? normalizeSouthAfricanPhone(parsed.phone)
      : null;

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.display_name,
        first_name: parsed.first_name ?? "",
        last_name: parsed.last_name ?? "",
        phone: normalizedPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/settings/profile");
    return { displayName: parsed.display_name };
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/data/profile-actions.ts
git commit -m "feat(profile): allow editing cellphone in settings"
```

---

### Task 6: Update `proxy.ts` for unified auth

**Files:**
- Modify: `proxy.ts`

- [ ] **Step 1: Replace the file contents**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/lib/database.types";

const PUBLIC_EXACT = ["/sign-in", "/forgot", "/reset", "/verify", "/api/health"];

const PUBLIC_PREFIXES = [
  "/m/",
  "/sign-in",
  "/forgot",
  "/reset",
  "/verify",
  "/accept-invite/",
  "/api/webhooks/",
  "/api/qr/",
  "/api/cron/", // protected by CRON_SECRET in the route handler
];

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some(
      (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p)
    )
  );
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Legacy sign-up route now lives inside /sign-in.
  if (pathname === "/sign-up" || pathname.startsWith("/sign-up/")) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Create a Supabase client bound to the request/response so that
  // refreshed session cookies are forwarded to both the server
  // components (via the mutated request) and the browser.
  let response = NextResponse.next({ request: req });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            req.cookies.set(name, value);
          }
          response = NextResponse.next({ request: req });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Authenticated users hitting the removed homepage go to the dashboard.
  if (user && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_super_admin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add proxy.ts
git commit -m "feat(auth): redirect all guests to /sign-in via proxy"
```

---

### Task 7: Create the two-column auth layout

**Files:**
- Modify: `app/(auth)/layout.tsx`

- [ ] **Step 1: Replace the layout**

```tsx
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      <div className="relative hidden md:block">
        <Image
          src="/login.webp"
          alt="Hungr dashboard and mobile menu preview"
          fill
          className="object-cover"
          priority
        />
      </div>
      <div className="flex flex-col items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Image
              src="/Logo.svg"
              alt="Hungr"
              width={180}
              height={60}
              className="h-14 w-auto mx-auto"
              priority
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/layout.tsx
git commit -m "feat(auth): two-column layout for auth pages"
```

---

### Task 8: Build the embedded sign-up form

**Files:**
- Create: `app/(auth)/sign-in/sign-up-form.tsx`

- [ ] **Step 1: Create the form**

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signUpAction } from "@/lib/auth/actions";

interface SignUpFormProps {
  onSwitchToSignIn: () => void;
}

export default function SignUpForm({ onSwitchToSignIn }: SignUpFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signUpAction(formData);

    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Something went wrong");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold font-heading">Check your email</h2>
        <p className="text-sm text-muted-foreground">
          We sent you a verification link. Click it to activate your account.
        </p>
        <Button variant="outline" className="w-full" onClick={onSwitchToSignIn}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold font-heading">Sign up</h1>
        <p className="text-sm text-muted-foreground">
          Create your Hungr account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationName">
            Organisation name{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="organizationName"
            name="organizationName"
            placeholder="e.g. Mama's Kitchen Group"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Cellphone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="082 123 4567"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="text-primary hover:underline"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/sign-in/sign-up-form.tsx
git commit -m "feat(auth): add embedded sign-up form with cellphone"
```

---

### Task 9: Update the sign-in form for the new layout and toggle

**Files:**
- Modify: `app/(auth)/sign-in/sign-in-form.tsx`

- [ ] **Step 1: Replace the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signInAction, resendVerificationEmail } from "@/lib/auth/actions";

const RESEND_COOLDOWN_SECONDS = 60;

interface SignInFormProps {
  onSwitchToSignUp: () => void;
}

export default function SignInForm({ onSwitchToSignUp }: SignInFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next =
    nextParam?.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await signInAction(formData);

    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Something went wrong");
      return;
    }

    router.push(next);
    router.refresh();
  }

  const isUnconfirmedError =
    error?.toLowerCase().includes("not confirmed") ?? false;

  async function handleResend() {
    if (!email || !password || resendCountdown > 0 || resendLoading) return;

    setResendLoading(true);
    setResendMessage(null);
    const result = await resendVerificationEmail(email, password);
    setResendLoading(false);

    if (!result.ok) {
      setResendMessage(result.message ?? "Failed to resend email");
      return;
    }

    setResendCountdown(RESEND_COOLDOWN_SECONDS);
    setResendMessage("Verification email sent.");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold font-heading">Log in</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Forgot Password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="flex items-start justify-between gap-3 text-sm">
            <p className="text-destructive">{error}</p>
            {isUnconfirmedError && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto shrink-0 px-2 py-1 text-xs"
                onClick={handleResend}
                disabled={
                  resendLoading || resendCountdown > 0 || !email || !password
                }
              >
                {resendLoading
                  ? "Sending..."
                  : resendCountdown > 0
                  ? `Resend in ${resendCountdown}s`
                  : "Resend email"}
              </Button>
            )}
          </div>
        )}

        {resendMessage && !error && (
          <p className="text-sm text-muted-foreground">{resendMessage}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Signing in..." : "Log in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="text-primary hover:underline"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/sign-in/sign-in-form.tsx
git commit -m "feat(auth): update sign-in form for unified page"
```

---

### Task 10: Wire up the mode toggle in `/sign-in`

**Files:**
- Modify: `app/(auth)/sign-in/page.tsx`

- [ ] **Step 1: Replace the page**

```tsx
"use client";

import { useState } from "react";
import SignInForm from "./sign-in-form";
import SignUpForm from "./sign-up-form";

export default function SignInPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");

  return (
    <>
      {mode === "sign-in" ? (
        <SignInForm onSwitchToSignUp={() => setMode("sign-up")} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setMode("sign-in")} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/sign-in/page.tsx
git commit -m "feat(auth): toggle sign-in and sign-up on /sign-in"
```

---

### Task 11: Remove the standalone sign-up route

**Files:**
- Delete: `app/(auth)/sign-up/`

- [ ] **Step 1: Delete the directory**

```bash
rm -rf app/\(auth\)/sign-up
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/sign-up
git commit -m "feat(auth): remove standalone /sign-up route"
```

---

### Task 12: Add cellphone field to profile settings

**Files:**
- Modify: `app/(dashboard)/settings/profile/page.tsx`

- [ ] **Step 1: Replace the page**

```tsx
import { requireSession } from "@/lib/auth/session";
import { createServerClient } from "@/lib/supabase/server";
import { updateProfile } from "@/lib/data/profile-actions";
import { PageHeader } from "@/components/PageHeader";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function ProfileSettingsPage() {
  const { user } = await requireSession();

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, first_name, last_name, phone")
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Profile" description="Manage your account settings" />
      <Card>
        <CardContent className="space-y-4">
          <ServerActionForm
            action={updateProfile}
            successMessage="Profile updated."
          >
            {({ isPending }) => (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={user.email ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display name</Label>
                  <Input
                    id="display_name"
                    name="display_name"
                    defaultValue={profile?.display_name ?? ""}
                    placeholder="Your display name"
                    required
                    disabled={isPending}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First name</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      defaultValue={profile?.first_name ?? ""}
                      placeholder="First name"
                      disabled={isPending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last name</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      defaultValue={profile?.last_name ?? ""}
                      placeholder="Last name"
                      disabled={isPending}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Cellphone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    placeholder="082 123 4567"
                    disabled={isPending}
                  />
                </div>
                <SubmitButton>Save changes</SubmitButton>
              </div>
            )}
          </ServerActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(dashboard\)/settings/profile/page.tsx
git commit -m "feat(settings): add cellphone field to profile settings"
```

---

### Task 13: Fix remaining auth link in verify form

**Files:**
- Modify: `app/(auth)/verify/verify-form.tsx`

- [ ] **Step 1: Update the failed-state link**

Replace the failed-state link block (around line 66-71):

```tsx
<Link
  href="/sign-in"
  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-all hover:bg-muted w-full"
>
  Back to sign in
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/verify/verify-form.tsx
git commit -m "fix(auth): point verify failure link to unified /sign-in"
```

---

### Task 14: Remove marketing pages and update internal links

**Files:**
- Delete: `app/(marketing)/`
- Modify: `app/(dashboard)/restaurants/new/page.tsx`

- [ ] **Step 1: Delete the marketing directory**

```bash
rm -rf app/\(marketing\)
```

- [ ] **Step 2: Update new-restaurant links**

In `app/(dashboard)/restaurants/new/page.tsx`, replace the two affected buttons:

For the "no_plan" card:

```tsx
<Button asChild>
  <Link href="/settings/billing">Manage billing</Link>
</Button>
```

For the "custom" card:

```tsx
<Button asChild variant="outline">
  <a href="mailto:hello@hungr.app?subject=Enterprise%20plan%20enquiry">
    Contact sales
  </a>
</Button>
```

- [ ] **Step 3: Commit**

```bash
git add app/\(marketing\) app/\(dashboard\)/restaurants/new/page.tsx
git commit -m "feat(marketing): remove public marketing pages and fix internal links"
```

---

### Task 15: Update E2E helpers and tests

**Files:**
- Modify: `tests/e2e/helpers.ts`
- Modify: `tests/e2e/onboarding.spec.ts`

- [ ] **Step 1: Update signUp helper**

Replace the existing `signUp` function in `tests/e2e/helpers.ts`:

```ts
export async function signUp(
  page: Page,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone: string = "0821234567"
) {
  await page.goto("/sign-in");
  await page.waitForSelector("form");

  await page.getByRole("button", { name: /sign up/i }).click();
  await page.waitForSelector('input[name="phone"]');

  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="phone"]', phone);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText("Check your email")).toBeVisible({ timeout: 15000 });
}
```

- [ ] **Step 2: Update onboarding.spec.ts**

Replace the first four smoke tests with redirect/unified-auth tests:

```ts
import { test, expect } from "@playwright/test";
import { signUpAndVerify, createRestaurant, createMenu } from "./helpers";

const TEST_EMAIL = `e2e-smoke-${Date.now()}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Onboarding smoke test", () => {
  test("unauthenticated root redirects to /sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated /pricing redirects to /sign-in", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sign-in page loads and sign-up mode is accessible", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await page.getByRole("button", { name: /sign up/i }).click();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test("full onboarding flow: sign-up → create restaurant → create menu", async ({ page }) => {
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Smoke", "Test");
    await createRestaurant(page, `Smoke Test Restaurant ${Date.now()}`);
    await createMenu(page, `Smoke Test Menu ${Date.now()}`);
    await expect(page).toHaveURL(/\/menus\//);
    await expect(page.locator('text=/workspace|menu/i').first()).toBeVisible();
  });

});
```

- [ ] **Step 3: Update signIn helper**

In `tests/e2e/helpers.ts`, update the button matcher in `signIn`:

```ts
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.waitForSelector("form");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/helpers.ts tests/e2e/onboarding.spec.ts
git commit -m "test(e2e): update helpers and onboarding tests for unified auth"
```

---

### Task 16: Add redirect E2E coverage

**Files:**
- Create: `tests/e2e/auth-redirect.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";

test.describe("Auth redirects", () => {
  test("unauthenticated /dashboard redirects to /sign-in with next param", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
  });

  test("legacy /sign-up redirects to /sign-in", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated /settings/profile redirects to /sign-in", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/auth-redirect.spec.ts
git commit -m "test(e2e): add auth redirect coverage"
```

---

### Task 17: Run lint, typecheck, and unit tests

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 2: Type check**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Unit tests**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: lint and type fixes"
```

---

### Task 18: Update docs references (optional)

**Files:**
- Modify: `DEMO_AND_TEST_PLAN.md`
- Modify: `PROJECT_STATUS.md`
- Modify: `CHECKLIST.md`

- [ ] **Step 1: Replace stale marketing/sign-up references**

In each doc:
- Replace public `/pricing` and `/contact-sales` references with `/settings/billing` or remove them.
- Replace `/sign-up` links with `/sign-in` and note the embedded sign-up toggle.
- Update `CHECKLIST.md` to reflect that logged-out `/dashboard` → `/sign-in` and that `/` no longer serves marketing content.

- [ ] **Step 2: Commit**

```bash
git add DEMO_AND_TEST_PLAN.md PROJECT_STATUS.md CHECKLIST.md
git commit -m "docs: update auth and marketing references"
```

---

## Self-review

- **Spec coverage:**
  - Unified `/sign-in` page → Tasks 7-11.
  - Redirect unauthenticated traffic → Task 6.
  - Remove marketing pages → Task 14.
  - Two-column layout → Task 7.
  - Embedded sign-up toggle → Tasks 8-10.
  - South African cellphone in sign-up → Tasks 1-4.
  - Cellphone stored on profile and editable → Tasks 2, 5, 12.
  - Post-login redirect → handled by existing `sign-in-form.tsx` `?next=` logic and Task 6.
- **Placeholder scan:** No TBD/TODO or vague steps.
- **Type consistency:** `phone` is consistently a string in forms, normalized to E.164 or null in storage, and validated with `isValidSouthAfricanPhone` / `normalizeSouthAfricanPhone`.
