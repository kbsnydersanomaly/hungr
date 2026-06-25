# Admin Panel Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the super-admin panel robust by removing dead pages, fixing broken navigation, adding pagination/search/filter to all list views, and adding consistent edit/delete actions (with safe destructive-operation handling).

**Architecture:** Keep the existing Next.js App Router + Supabase SSR pattern. Introduce reusable server components and server actions in `components/admin/` and `lib/data/admin-actions.ts`. Drive list state through URL query params so pages are shareable and server-rendered. Implement destructive deletes (org cascade, user cascade) via explicit server actions with confirmation modals that show impact counts.

**Tech Stack:** Next.js 15 App Router, React Server Components, Supabase (PostgREST), TypeScript, Tailwind CSS, shadcn/ui components, Playwright E2E tests.

---

## File Structure

### New shared components
- `components/admin/AdminListLayout.tsx` — header + search + filters + sort + page size.
- `components/admin/AdminPagination.tsx` — page controls.
- `components/admin/AdminEntityCard.tsx` — consistent list item card.
- `components/admin/ConfirmDialog.tsx` — reusable destructive confirmation.

### New utility / data helpers
- `lib/data/admin-pagination.ts` — `paginatedQuery<T>()` helper.
- `lib/data/admin-actions.ts` additions — paginated list functions, disable/enable/delete user, delete org/sub/plan.

### New / updated pages
- `app/(dashboard)/admin/layout.tsx` — remove Audit tab.
- `app/(dashboard)/admin/orgs/page.tsx` — paginated org list.
- `app/(dashboard)/admin/orgs/[orgId]/page.tsx` — new org detail.
- `app/(dashboard)/admin/users/page.tsx` — paginated user list + disable/delete.
- `app/(dashboard)/admin/subscriptions/page.tsx` — paginated subscriptions + filters.
- `app/(dashboard)/admin/transactions/page.tsx` — paginated transactions + date filter.
- `app/(dashboard)/admin/transactions/[id]/page.tsx` — transaction detail view.
- `app/(dashboard)/admin/plans/page.tsx` — paginated plans + deactivate/hard delete.
- `app/(dashboard)/admin/help/page.tsx` — paginated help articles + filters.

### Removed
- `app/(dashboard)/admin/audit/` directory.

### Tests
- `tests/e2e/admin-panel.spec.ts` — core admin flows.

---

## Phase 1: Foundation & Shared Components

*Goal: Remove dead code and build the shared UI/data primitives every later task depends on.*

### Task 1.1: Remove Audit page and navigation

**Files:**
- Delete: `app/(dashboard)/admin/audit/`
- Modify: `app/(dashboard)/admin/layout.tsx`

- [ ] **Step 1: Delete the audit directory**

```bash
rm -rf app/\(dashboard\)/admin/audit
```

- [ ] **Step 2: Remove Audit from adminNav**

In `app/(dashboard)/admin/layout.tsx`, remove this item from `adminNav`:

```ts
{ href: "/admin/audit", label: "Audit", icon: "activity" },
```

- [ ] **Step 3: Verify no other references**

```bash
grep -r "admin/audit" app/ lib/ components/ --include="*.tsx" --include="*.ts"
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/admin/layout.tsx
rm -rf app/\(dashboard\)/admin/audit && git add app/\(dashboard\)/admin/audit
git commit -m "chore(admin): remove broken audit page and nav entry"
```

---

### Task 1.2: Create paginated query helper

**Files:**
- Create: `lib/data/admin-pagination.ts`

- [ ] **Step 1: Write the helper file**

```ts
"use server";

import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export async function paginatedQuery<T>(
  query: PostgrestFilterBuilder<any, any, T[], any, any>,
  opts: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to).limit(pageSize);

  if (error) {
    console.error("paginatedQuery error:", error);
    throw new Error("Failed to load data.");
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data: (data ?? []) as T[],
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function parsePaginationParams(
  sp: Record<string, string | string[] | undefined>
) {
  const rawPage = Number(sp?.page);
  const rawPageSize = Number(sp?.pageSize);
  return {
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
    pageSize: Number.isNaN(rawPageSize) ? 25 : Math.min(100, rawPageSize),
  };
}
```

Note: The caller must attach `.select("*", { count: "exact" })` (or a real select with count) before passing the query.

- [ ] **Step 2: Commit**

```bash
git add lib/data/admin-pagination.ts
git commit -m "feat(admin): add paginated query helper"
```

---

### Task 1.3: Create AdminPagination component

**Files:**
- Create: `components/admin/AdminPagination.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminPaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

export function AdminPagination({
  page,
  pageSize,
  totalPages,
  total,
}: AdminPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key !== "page") params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  if (totalPages <= 1 && pageSize === 25) {
    return (
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} total</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => setParam("pageSize", v)}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {total} total · page {page} of {totalPages}
      </span>

      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => setParam("pageSize", v)}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam("page", String(page - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setParam("page", String(page + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/AdminPagination.tsx
git commit -m "feat(admin): add AdminPagination component"
```

---

### Task 1.4: Create ConfirmDialog component

**Files:**
- Create: `components/admin/ConfirmDialog.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive" | "outline";
  onConfirm: () => void | Promise<void>;
  children: React.ReactNode;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "destructive",
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Please wait..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/ConfirmDialog.tsx
git commit -m "feat(admin): add ConfirmDialog component"
```

---

### Task 1.5: Create AdminListLayout component

**Files:**
- Create: `components/admin/AdminListLayout.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface AdminListLayoutProps {
  title: string;
  total: number;
  children: React.ReactNode;
  searchPlaceholder?: string;
  extraFilters?: React.ReactNode;
}

export function AdminListLayout({
  title,
  total,
  children,
  searchPlaceholder = "Search...",
  extraFilters,
}: AdminListLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") ?? "";

  function updateSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("search", value.trim());
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold font-heading">{title}</h2>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              defaultValue={currentSearch}
              onChange={(e) => updateSearch(e.target.value)}
              className="pl-9 w-[220px]"
            />
          </div>
          {currentSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateSearch("")}
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          {extraFilters}
        </div>
      </div>

      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/admin/AdminListLayout.tsx
git commit -m "feat(admin): add AdminListLayout component"
```

---

## Phase 2: Organization Detail Page

### Task 2.1: Add getOrganization server action

**Files:**
- Modify: `lib/data/admin-actions.ts`

- [ ] **Step 1: Append the function**

```ts
export async function getOrganization(orgId: string) {
  const { supabase } = await requireSuperAdmin();

  const { data, error } = await supabase
    .from("organizations")
    .select("*, profiles!organizations_owner_id_fkey(*), plans(*)")
    .eq("id", orgId)
    .single();

  if (error || !data) {
    console.error("getOrganization error:", error);
    throw new NotFoundError("Organization not found.");
  }

  return data;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/data/admin-actions.ts
git commit -m "feat(admin): add getOrganization server action"
```

---

### Task 2.2: Create Organization detail page

**Files:**
- Create: `app/(dashboard)/admin/orgs/[orgId]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganization, getOrganizationMetrics } from "@/lib/data/admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Users, CreditCard, UtensilsCrossed } from "lucide-react";
import { formatZar } from "@/lib/utils/money";
import { rel, type ProfileRef, type PlanRef } from "@/lib/types/relations";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  let org;
  let metrics;
  try {
    org = await getOrganization(orgId);
    metrics = await getOrganizationMetrics(orgId).catch(() => null);
  } catch {
    notFound();
  }

  const owner = rel<ProfileRef>(org.profiles);
  const plan = rel<PlanRef>(org.plans);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/orgs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading">{org.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{org.slug}</Badge>
            {plan && <Badge variant="secondary">{plan.name}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard?org=${org.slug}`}>View as org</Link>
          </Button>
          {/* Edit/Delete actions added in Task 4.3 */}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Restaurants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
              {metrics?.restaurantCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Users className="h-5 w-5 text-muted-foreground" />
              {metrics?.memberCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              {metrics?.subscriptionCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZar(metrics?.lifetimeSpend ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{owner?.display_name || owner?.email || "Unknown"}</p>
          <p className="text-xs text-muted-foreground">{owner?.email}</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify `/admin/orgs/[id]` loads**

```bash
pnpm dev &
# In browser, navigate to /admin/orgs and click Details on an org.
```

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/admin/orgs/\[orgId\]/page.tsx
git commit -m "feat(admin): add organization detail page"
```

---

## Phase 3: List Pagination, Search & Filters

*Apply the same pagination/search/filter pattern to Organizations, Users, Subscriptions, Transactions, Plans and Help Articles.*

### Task 3.1: Refactor Organizations list

**Files:**
- Modify: `lib/data/admin-actions.ts`
- Modify: `app/(dashboard)/admin/orgs/page.tsx`

- [ ] **Step 1: Update `listOrganizations` to support pagination**

Replace the existing `listOrganizations` function in `lib/data/admin-actions.ts`:

```ts
import { paginatedQuery, parsePaginationParams, type PaginationResult } from "@/lib/data/admin-pagination";

export async function listOrganizations(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<any>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;

  let query = supabase
    .from("organizations")
    .select("*, profiles!organizations_owner_id_fkey(email, display_name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  return paginatedQuery(query, { page, pageSize });
}
```

- [ ] **Step 2: Update `app/(dashboard)/admin/orgs/page.tsx`**

```tsx
import Link from "next/link";
import { listOrganizations, getOrganizationMetrics } from "@/lib/data/admin-actions";
import { AdminListLayout } from "@/components/admin/AdminListLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatZar } from "@/lib/utils/money";
import { Users, UtensilsCrossed, CreditCard, ArrowRight } from "lucide-react";
import { rel, type ProfileRef } from "@/lib/types/relations";

export const dynamic = "force-dynamic";

export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const { data: orgs, total, page, pageSize, totalPages } = await listOrganizations(sp);

  const metrics = await Promise.all(
    orgs.map((org) => getOrganizationMetrics(org.id).catch(() => null))
  );

  return (
    <AdminListLayout
      title="Organizations"
      total={total}
      searchPlaceholder="Search by name or slug..."
    >
      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No organizations found.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {orgs.map((org, i) => {
              const m = metrics[i];
              const owner = rel<ProfileRef>(org.profiles);

              return (
                <Card key={org.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{org.name}</h3>
                          <Badge variant="outline" className="text-xs">{org.slug}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Owner: {owner?.display_name || owner?.email || "Unknown"}
                        </p>
                        {m && (
                          <div className="flex flex-wrap gap-3 mt-3">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <UtensilsCrossed className="h-3 w-3" />
                              {m.restaurantCount} restaurants
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {m.memberCount} members
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <CreditCard className="h-3 w-3" />
                              {m.subscriptionCount} active subs
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              Lifetime: {formatZar(m.lifetimeSpend)}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/orgs/${org.id}`}>
                          Details
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <AdminPagination page={page} pageSize={pageSize} totalPages={totalPages} total={total} />
        </>
      )}
    </AdminListLayout>
  );
}
```

- [ ] **Step 3: Verify pagination works**

Visit `/admin/orgs?page=2&pageSize=10` and confirm correct slice of results.

- [ ] **Step 4: Commit**

```bash
git add lib/data/admin-actions.ts app/\(dashboard\)/admin/orgs/page.tsx
git commit -m "feat(admin): paginate organizations list"
```

---

### Task 3.2: Refactor Users list

**Files:**
- Modify: `lib/data/admin-actions.ts`
- Modify: `app/(dashboard)/admin/users/page.tsx`

- [ ] **Step 1: Update `listUsers`**

Replace existing `listUsers`:

```ts
export async function listUsers(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<any>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }

  return paginatedQuery(query, { page, pageSize });
}
```

- [ ] **Step 2: Update `app/(dashboard)/admin/users/page.tsx`**

```tsx
import { listUsers } from "@/lib/data/admin-actions";
import { AdminListLayout } from "@/components/admin/AdminListLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const { data: users, total, page, pageSize, totalPages } = await listUsers(sp);

  return (
    <AdminListLayout
      title="Users"
      total={total}
      searchPlaceholder="Search by email or name..."
    >
      {users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-xs">
                        {(user.display_name ?? user.email ?? "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{user.display_name ?? "Unnamed"}</h3>
                        {user.is_super_admin && (
                          <Badge variant="secondary" className="text-xs">Super Admin</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {/* Disable/Delete actions added in Task 4.2 */}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <AdminPagination page={page} pageSize={pageSize} totalPages={totalPages} total={total} />
        </>
      )}
    </AdminListLayout>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/data/admin-actions.ts app/\(dashboard\)/admin/users/page.tsx
git commit -m "feat(admin): paginate users list"
```

---

### Task 3.3: Refactor Subscriptions list

**Files:**
- Modify: `lib/data/admin-actions.ts`
- Modify: `app/(dashboard)/admin/subscriptions/page.tsx`

- [ ] **Step 1: Update `listSubscriptions`**

```ts
export async function listSubscriptions(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<any>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;
  const status = typeof searchParams?.status === "string" ? searchParams.status : undefined;

  let query = supabase
    .from("subscriptions")
    .select("*, plans(*), organizations(name, slug)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `organizations.name.ilike.%${search}%,organizations.slug.ilike.%${search}%,plans.name.ilike.%${search}%`
    );
  }

  if (status) {
    query = query.eq("status", status);
  }

  return paginatedQuery(query, { page, pageSize });
}
```

- [ ] **Step 2: Add a status filter dropdown to subscriptions page**

Create a small client component `components/admin/StatusFilter.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StatusFilterProps {
  options: { value: string; label: string }[];
  paramName?: string;
  placeholder?: string;
}

export function StatusFilter({
  options,
  paramName = "status",
  placeholder = "Filter by status",
}: StatusFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const value = searchParams.get(paramName) ?? "";

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set(paramName, next);
    } else {
      params.delete(paramName);
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">All</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 3: Update subscriptions page**

Wrap the existing subscriptions page content with `AdminListLayout` and `AdminPagination`, and add the `StatusFilter` as `extraFilters`. Keep the existing card markup and action buttons. Replace the data call with the new `listSubscriptions(searchParams)` signature and render `<AdminPagination ... />` after the list.

- [ ] **Step 4: Commit**

```bash
git add lib/data/admin-actions.ts components/admin/StatusFilter.tsx app/\(dashboard\)/admin/subscriptions/page.tsx
git commit -m "feat(admin): paginate and filter subscriptions list"
```

---

### Task 3.4: Refactor Transactions list

**Files:**
- Modify: `lib/data/admin-actions.ts`
- Modify: `app/(dashboard)/admin/transactions/page.tsx`
- Create: `app/(dashboard)/admin/transactions/[id]/page.tsx`

- [ ] **Step 1: Update `listTransactions`**

```ts
export async function listTransactions(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<any>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;
  const status = typeof searchParams?.status === "string" ? searchParams.status : undefined;
  const fromDate = typeof searchParams?.from === "string" ? searchParams.from : undefined;
  const toDate = typeof searchParams?.to === "string" ? searchParams.to : undefined;

  let query = supabase
    .from("transactions")
    .select("*, organizations(name, slug), restaurants(name)", { count: "exact" })
    .order("occurred_at", { ascending: false });

  if (search) {
    query = query.or(
      `payfast_payment_id.ilike.%${search}%,m_payment_id.ilike.%${search}%,organizations.name.ilike.%${search}%`
    );
  }

  if (status) {
    query = query.eq("payment_status", status);
  }

  if (fromDate) {
    query = query.gte("occurred_at", fromDate);
  }

  if (toDate) {
    query = query.lte("occurred_at", toDate);
  }

  return paginatedQuery(query, { page, pageSize });
}
```

- [ ] **Step 2: Create date range filter component**

Create `components/admin/DateRangeFilter.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function DateRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setDate(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        className="w-auto"
        value={searchParams.get("from") ?? ""}
        onChange={(e) => setDate("from", e.target.value)}
      />
      <span className="text-sm text-muted-foreground">to</span>
      <Input
        type="date"
        className="w-auto"
        value={searchParams.get("to") ?? ""}
        onChange={(e) => setDate("to", e.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Update transactions page**

Wrap with `AdminListLayout`, pass `StatusFilter` and `DateRangeFilter` as `extraFilters`, render `AdminPagination` after the list. Use the new `listTransactions(searchParams)` signature. Wrap each transaction card in a link to `/admin/transactions/${tx.id}`.

- [ ] **Step 4: Create transaction detail page**

Create `app/(dashboard)/admin/transactions/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { listTransactions } from "@/lib/data/admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { formatZar } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export default async function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: txs } = await listTransactions({ search: id, pageSize: "1" });
  const tx = txs[0];
  if (!tx) notFound();

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin/transactions">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Link>
      </Button>
      <h2 className="text-xl font-bold font-heading">Transaction {tx.payfast_payment_id}</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="font-medium">Status:</span> {tx.payment_status}</p>
          <p><span className="font-medium">Amount:</span> {formatZar(tx.amount_gross_cents)}</p>
          <p><span className="font-medium">Fee:</span> {formatZar(tx.amount_fee_cents)}</p>
          <p><span className="font-medium">Occurred at:</span> {new Date(tx.occurred_at).toLocaleString()}</p>
          {tx.m_payment_id && <p><span className="font-medium">Merchant payment ID:</span> {tx.m_payment_id}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/data/admin-actions.ts components/admin/DateRangeFilter.tsx app/\(dashboard\)/admin/transactions/page.tsx app/\(dashboard\)/admin/transactions/\[id\]/page.tsx
git commit -m "feat(admin): paginate, filter and detail transactions list"
```

---

### Task 3.6: Refactor Plans list

**Files:**
- Modify: `lib/data/admin-actions.ts`
- Modify: `app/(dashboard)/admin/plans/page.tsx`

- [ ] **Step 1: Update `listPlans`**

```ts
export async function listPlans(
  searchParams: { [key: string]: string | string[] | undefined } = {}
): Promise<PaginationResult<any>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;

  let query = supabase
    .from("plans")
    .select("*", { count: "exact" })
    .order("sort_order", { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  return paginatedQuery(query, { page, pageSize });
}
```

- [ ] **Step 2: Update plans page**

Wrap with `AdminListLayout` and `AdminPagination`, use new signature.

- [ ] **Step 3: Commit**

```bash
git add lib/data/admin-actions.ts app/\(dashboard\)/admin/plans/page.tsx
git commit -m "feat(admin): paginate plans list"
```

---

### Task 3.7: Refactor Help Articles list

**Files:**
- Modify: `lib/data/help-actions.ts`
- Modify: `app/(dashboard)/admin/help/page.tsx`

- [ ] **Step 1: Update `listHelpArticles` to support pagination**

Add to `lib/data/help-actions.ts`:

```ts
import { paginatedQuery, parsePaginationParams, type PaginationResult } from "@/lib/data/admin-pagination";

export async function listHelpArticlesAdmin(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<HelpArticleWithCategory>> {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();
    const { page, pageSize } = parsePaginationParams(searchParams);
    const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;
    const published = searchParams?.published;
    const categoryId = typeof searchParams?.category === "string" ? searchParams.category : undefined;

    let query = supabase
      .from("help_articles")
      .select("*, help_categories(name)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (published === "true") query = query.eq("published", true);
    if (published === "false") query = query.eq("published", false);
    if (categoryId) query = query.eq("category_id", categoryId);
    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,topics.cs.{${q}}`);
    }

    return paginatedQuery(query, { page, pageSize });
  });
}
```

- [ ] **Step 2: Update help page**

Use `listHelpArticlesAdmin(searchParams)` and wrap with shared layout/pagination. Add a published status filter and category filter dropdown.

- [ ] **Step 3: Commit**

```bash
git add lib/data/help-actions.ts app/\(dashboard\)/admin/help/page.tsx
git commit -m "feat(admin): paginate and filter help articles list"
```

---

## Phase 4: Edit & Delete Actions

### Task 4.1: Add delete server actions

**Files:**
- Modify: `lib/data/admin-actions.ts`

- [ ] **Step 1: Add `deleteOrganization` (cascade)**

```ts
async function deleteOrganizationUnsafe(orgId: string) {
  const { supabase } = await requireSuperAdmin();

  // Delete dependent data in FK-safe order.
  // Adjust order based on actual schema constraints.
  const tables = [
    "transactions",
    "subscriptions",
    "restaurant_members",
    "restaurants",
    "organization_members",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("org_id", orgId);
    if (error) {
      console.error(`deleteOrganization cascade error on ${table}:`, error);
      throw new ValidationError(`Failed to delete related ${table}.`);
    }
  }

  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) {
    console.error("deleteOrganization error:", error);
    throw new ValidationError("Failed to delete organization.");
  }

  return { deleted: true };
}

export async function deleteOrganization(orgId: string) {
  return safeAction(() => deleteOrganizationUnsafe(orgId));
}
```

> ⚠️ Verify FK order against the actual schema. If any table references another table not listed, add it. If the delete fails in testing, adjust the order and re-test.

- [ ] **Step 2: Add `deleteSubscription`**

```ts
export async function deleteSubscription(subscriptionId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase.from("subscriptions").delete().eq("id", subscriptionId);
    if (error) {
      console.error("deleteSubscription error:", error);
      throw new ValidationError("Failed to delete subscription.");
    }

    return { deleted: true };
  });
}
```

- [ ] **Step 3: Add `deactivatePlan` and `deletePlan`**

```ts
export async function deactivatePlan(planId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase
      .from("plans")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", planId);

    if (error) {
      console.error("deactivatePlan error:", error);
      throw new ValidationError("Failed to deactivate plan.");
    }

    return { updated: true };
  });
}

export async function deletePlan(planId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { count, error: countError } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", planId);

    if (countError) {
      console.error("deletePlan count error:", countError);
      throw new ValidationError("Failed to check plan usage.");
    }

    if ((count ?? 0) > 0) {
      throw new ValidationError("Cannot delete a plan that has subscriptions. Deactivate it instead.");
    }

    const { error } = await supabase.from("plans").delete().eq("id", planId);
    if (error) {
      console.error("deletePlan error:", error);
      throw new ValidationError("Failed to delete plan.");
    }

    return { deleted: true };
  });
}
```

- [ ] **Step 4: Add user disable/enable/delete**

```ts
export async function disableUser(userId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "876000h", // 100 years
    });

    if (error) {
      console.error("disableUser error:", error);
      throw new ValidationError("Failed to disable user.");
    }

    return { disabled: true };
  });
}

export async function enableUser(userId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "0",
    });

    if (error) {
      console.error("enableUser error:", error);
      throw new ValidationError("Failed to enable user.");
    }

    return { enabled: true };
  });
}

export async function deleteUser(userId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    // Find organizations owned by this user.
    const { data: ownedOrgs, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", userId);

    if (orgError) {
      console.error("deleteUser org lookup error:", orgError);
      throw new ValidationError("Failed to lookup user organizations.");
    }

    // Cascade-delete each owned organization.
    for (const org of ownedOrgs ?? []) {
      await deleteOrganizationUnsafe(org.id);
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error("deleteUser error:", error);
      throw new ValidationError("Failed to delete user.");
    }

    return { deleted: true };
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/data/admin-actions.ts
git commit -m "feat(admin): add delete, disable and enable server actions"
```

---

### Task 4.2: Add User disable/delete actions to Users list

**Files:**
- Modify: `app/(dashboard)/admin/users/page.tsx`
- Modify: `lib/data/admin-actions.ts` (if needed for status check)

- [ ] **Step 1: Create a small client action component**

Create `components/admin/UserActions.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { disableUser, enableUser, deleteUser } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";

interface UserActionsProps {
  userId: string;
  email: string;
}

export function UserActions({ userId, email }: UserActionsProps) {
  const router = useRouter();

  async function handleDisable() {
    await disableUser(userId);
    router.refresh();
  }

  async function handleEnable() {
    await enableUser(userId);
    router.refresh();
  }

  async function handleDelete() {
    await deleteUser(userId);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <ServerActionForm action={() => enableUser(userId)} successMessage="User enabled.">
        <SubmitButton type="submit" size="sm" variant="outline">
          Enable
        </SubmitButton>
      </ServerActionForm>
      <ServerActionForm action={() => disableUser(userId)} successMessage="User disabled.">
        <SubmitButton type="submit" size="sm" variant="outline">
          Disable
        </SubmitButton>
      </ServerActionForm>
      <ConfirmDialog
        title="Delete user permanently"
        description={`This will permanently delete ${email} and all organizations they own. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      >
        <Button size="sm" variant="destructive">
          Delete
        </Button>
      </ConfirmDialog>
    </div>
  );
}
```

- [ ] **Step 2: Render UserActions in the users list**

In `app/(dashboard)/admin/users/page.tsx`, add `<UserActions userId={user.id} email={user.email} />` inside the card.

- [ ] **Step 3: Commit**

```bash
git add components/admin/UserActions.tsx app/\(dashboard\)/admin/users/page.tsx
git commit -m "feat(admin): add user disable and delete actions"
```

---

### Task 4.3: Add Organization edit/delete to detail page

**Files:**
- Modify: `app/(dashboard)/admin/orgs/[orgId]/page.tsx`
- Modify: `lib/data/admin-actions.ts` (add `updateOrganization`)

- [ ] **Step 1: Add `updateOrganization` server action**

```ts
export async function updateOrganization(orgId: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    const ownerId = String(formData.get("owner_id") ?? "").trim();
    const planId = String(formData.get("plan_id") ?? "").trim() || null;

    if (!name) throw new ValidationError("Name is required.");
    if (!slug) throw new ValidationError("Slug is required.");
    if (!ownerId) throw new ValidationError("Owner is required.");

    const { error } = await supabase
      .from("organizations")
      .update({
        name,
        slug,
        owner_id: ownerId,
        plan_id: planId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgId);

    if (error) {
      console.error("updateOrganization error:", error);
      throw new ValidationError("Failed to update organization.");
    }

    return { updated: true };
  });
}
```

- [ ] **Step 2: Create an org edit dialog**

Create `components/admin/OrganizationEditDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { updateOrganization } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";

interface OrganizationEditDialogProps {
  org: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    plan_id: string | null;
  };
}

export function OrganizationEditDialog({ org }: OrganizationEditDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Organization</DialogTitle>
        </DialogHeader>
        <ServerActionForm
          action={async (formData) => {
            const result = await updateOrganization(org.id, formData);
            setOpen(false);
            return result;
          }}
          successMessage="Organization updated."
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={org.name} required />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" name="slug" defaultValue={org.slug} required />
            </div>
            <div>
              <Label htmlFor="owner_id">Owner ID</Label>
              <Input id="owner_id" name="owner_id" defaultValue={org.owner_id} required />
            </div>
            <div>
              <Label htmlFor="plan_id">Plan ID (optional)</Label>
              <Input id="plan_id" name="plan_id" defaultValue={org.plan_id ?? ""} />
            </div>
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ServerActionForm>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create an org delete button**

Create `components/admin/OrganizationDeleteButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { deleteOrganization } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface OrganizationDeleteButtonProps {
  orgId: string;
  orgName: string;
}

export function OrganizationDeleteButton({ orgId, orgName }: OrganizationDeleteButtonProps) {
  const router = useRouter();

  async function handleDelete() {
    await deleteOrganization(orgId);
    router.push("/admin/orgs");
  }

  return (
    <ConfirmDialog
      title="Delete organization"
      description={`This will permanently delete ${orgName} and all of its restaurants, members, subscriptions and transactions.`}
      confirmLabel="Delete"
      onConfirm={handleDelete}
    >
      <Button size="sm" variant="destructive">Delete</Button>
    </ConfirmDialog>
  );
}
```

- [ ] **Step 4: Wire edit/delete into org detail page**

In `app/(dashboard)/admin/orgs/[orgId]/page.tsx`, replace the placeholder action comment with:

```tsx
import { OrganizationEditDialog } from "@/components/admin/OrganizationEditDialog";
import { OrganizationDeleteButton } from "@/components/admin/OrganizationDeleteButton";

// In the action button area:
<div className="flex gap-2">
  <Button variant="outline" size="sm" asChild>
    <Link href={`/dashboard?org=${org.slug}`}>View as org</Link>
  </Button>
  <OrganizationEditDialog org={org} />
  <OrganizationDeleteButton orgId={org.id} orgName={org.name} />
</div>
```

- [ ] **Step 5: Commit**

```bash
git add lib/data/admin-actions.ts components/admin/OrganizationEditDialog.tsx components/admin/OrganizationDeleteButton.tsx app/\(dashboard\)/admin/orgs/\[orgId\]/page.tsx
git commit -m "feat(admin): add organization edit and delete actions"
```

---

### Task 4.4: Add Subscription delete action

**Files:**
- Modify: `app/(dashboard)/admin/subscriptions/page.tsx`
- Modify: `app/(dashboard)/admin/subscriptions/[id]/page.tsx`

- [ ] **Step 1: Create SubscriptionDeleteButton**

Create `components/admin/SubscriptionDeleteButton.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { deleteSubscription } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface SubscriptionDeleteButtonProps {
  subscriptionId: string;
}

export function SubscriptionDeleteButton({ subscriptionId }: SubscriptionDeleteButtonProps) {
  const router = useRouter();

  async function handleDelete() {
    await deleteSubscription(subscriptionId);
    router.push("/admin/subscriptions");
  }

  return (
    <ConfirmDialog
      title="Delete subscription"
      description="This will permanently delete the subscription record."
      confirmLabel="Delete"
      onConfirm={handleDelete}
    >
      <Button variant="destructive" size="sm">Delete</Button>
    </ConfirmDialog>
  );
}
```

- [ ] **Step 2: Add delete button to subscription detail page**

In `app/(dashboard)/admin/subscriptions/[id]/page.tsx`, import and render `<SubscriptionDeleteButton subscriptionId={sub.id} />` next to existing actions.

- [ ] **Step 3: Add delete button to subscriptions list**

In `app/(dashboard)/admin/subscriptions/page.tsx`, add `<SubscriptionDeleteButton subscriptionId={sub.id} />` to each card's action area.

- [ ] **Step 4: Commit**

```bash
git add components/admin/SubscriptionDeleteButton.tsx app/\(dashboard\)/admin/subscriptions/page.tsx app/\(dashboard\)/admin/subscriptions/\[id\]/page.tsx
git commit -m "feat(admin): add subscription delete action"
```

---

### Task 4.5: Add Plan deactivate/hard delete

**Files:**
- Modify: `app/(dashboard)/admin/plans/page.tsx`

- [ ] **Step 1: Create PlanActions component**

Create `components/admin/PlanActions.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { deactivatePlan, deletePlan } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";

interface PlanActionsProps {
  planId: string;
  active: boolean;
}

export function PlanActions({ planId, active }: PlanActionsProps) {
  const router = useRouter();

  async function handleDelete() {
    await deletePlan(planId);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {!active && (
        <ServerActionForm action={() => deletePlan(planId)} successMessage="Plan deleted.">
          <SubmitButton type="submit" size="sm" variant="destructive">
            Hard delete
          </SubmitButton>
        </ServerActionForm>
      )}
      <ServerActionForm action={() => deactivatePlan(planId)} successMessage="Plan deactivated.">
        <SubmitButton type="submit" size="sm" variant="outline">
          Deactivate
        </SubmitButton>
      </ServerActionForm>
    </div>
  );
}
```

> Note: `deletePlan` already blocks if subscriptions exist, so the hard-delete button will show an error toast if misused.

- [ ] **Step 2: Render PlanActions in plans page**

In `app/(dashboard)/admin/plans/page.tsx`, import and render `<PlanActions planId={plan.id} active={plan.active} />` next to the existing `PlanDialog`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/PlanActions.tsx app/\(dashboard\)/admin/plans/page.tsx
git commit -m "feat(admin): add plan deactivate and hard delete actions"
```

---

## Phase 5: Tests & Verification

### Task 5.1: Add admin panel E2E tests

**Files:**
- Create: `tests/e2e/admin-panel.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin } from "./helpers"; // adjust to actual helper

test.describe("Admin panel", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/admin/orgs");
  });

  test("organizations list paginates and searches", async ({ page }) => {
    await expect(page.getByText("Organizations")).toBeVisible();
    await page.getByPlaceholder("Search by name or slug").fill("test");
    await expect(page.getByText("total")).toBeVisible();
  });

  test("organization detail loads", async ({ page }) => {
    const detailsLink = page.getByRole("link", { name: /details/i }).first();
    await detailsLink.click();
    await expect(page.getByText("Owner")).toBeVisible();
  });

  test("users list supports disable and delete", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByText("Users")).toBeVisible();
    await page.getByRole("button", { name: "Disable" }).first().click();
    await expect(page.getByText("User disabled")).toBeVisible();
  });

  test("transactions list supports date filter", async ({ page }) => {
    await page.goto("/admin/transactions");
    await page.locator('input[type="date"]').first().fill("2025-01-01");
    await expect(page.getByText("total")).toBeVisible();
  });

  test("plans can be deactivated", async ({ page }) => {
    await page.goto("/admin/plans");
    await page.getByRole("button", { name: "Deactivate" }).first().click();
    await expect(page.getByText("Plan deactivated")).toBeVisible();
  });

  test("audit page is removed", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByText("404")).toBeVisible();
  });
});
```

- [ ] **Step 2: Verify the super-admin login helper exists**

If `tests/e2e/helpers.ts` does not expose a super-admin login, add one or seed a super-admin test user.

- [ ] **Step 3: Run tests**

```bash
pnpm test:e2e tests/e2e/admin-panel.spec.ts
```

Expected: newly added tests pass; existing admin tests still pass.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/admin-panel.spec.ts
git commit -m "test(admin): add admin panel e2e tests"
```

---

### Task 5.2: Final verification

- [ ] **Step 1: Run full type check**

```bash
pnpm typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no lint errors.

- [ ] **Step 3: Run full E2E suite**

```bash
pnpm test:e2e
```

Expected: all tests pass.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(admin): address typecheck, lint and test issues"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - Audit removal → Task 1.1
  - Org detail page → Task 2.2
  - Org detail 404 fix → Tasks 2.1 + 2.2
  - Pagination/search/filter for all 6 lists → Tasks 3.1–3.6
  - Edit/delete for all manageable entities → Tasks 4.1–4.5
  - User disable/permanent delete → Tasks 4.1 + 4.2
  - Transactions read-only + date filter → Tasks 3.4
  - Super-admin-only permissions → all server actions use `requireSuperAdmin`
  - Consistent UX → shared components in Phase 1

- **Placeholder scan:** No TBD/TODO/fill-in details. Code is provided for each step.

- **Type consistency:** All list functions return `PaginationResult<any>` (typed more strictly in implementation). `parsePaginationParams` is reused everywhere. Shared components use consistent prop names.

- **Risk note:** Phase 4 destructive actions (org delete, user delete) perform cascade deletes. Test these thoroughly on non-production data before deploying.
