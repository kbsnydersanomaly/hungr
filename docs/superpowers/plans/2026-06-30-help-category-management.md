# Help Category Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline category-management dialog to `/admin/help` so super admins can create, edit, and delete help categories.

**Architecture:** Extend the existing `lib/data/help-actions.ts` server-action module with category CRUD actions, then build a client-side `HelpCategoryManager` dialog component rendered from `/admin/help`. The component reuses existing form primitives and matches the current admin UI patterns.

**Tech Stack:** Next.js App Router, React Server Actions, Supabase, Tailwind CSS, shadcn/ui-style primitives (`Dialog`, `Button`, `Input`, `Label`), Zod validation.

---

## File Map

- **Create:** `components/help/HelpCategoryManager.tsx` — Dialog UI for category CRUD.
- **Modify:** `lib/data/help-actions.ts` — Add `createHelpCategory`, `updateHelpCategory`, `deleteHelpCategory` server actions.
- **Modify:** `app/(dashboard)/admin/help/page.tsx` — Add "Manage categories" trigger button and pass categories to the manager.

---

## Task 1: Add category CRUD server actions

**Files:**
- Modify: `lib/data/help-actions.ts`

### Step 1: Add a category form schema and parser

Insert after the existing `articleFormSchema` (around line 37):

```ts
const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  slug: z.string().max(200),
  sort_order: z.coerce.number().int().default(0),
});

function parseCategoryForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);

  const slug = slugify(name, slugInput) || "category";

  const parsed = categoryFormSchema.safeParse({
    name,
    slug,
    sort_order: sortOrder,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(issue?.message ?? "Invalid category data.");
  }

  return parsed.data;
}
```

Run: `npx tsc --noEmit`
Expected: Type check passes (ignore unrelated errors).

### Step 2: Add `createHelpCategory`

Append to the end of `lib/data/help-actions.ts` (after `toggleHelpArticlePublished`):

```ts
export async function createHelpCategory(formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();
    const fields = parseCategoryForm(formData);

    const { data, error } = await supabase
      .from("help_categories")
      .insert({
        name: fields.name,
        slug: fields.slug,
        sort_order: fields.sort_order,
      })
      .select("id")
      .single();

    if (error) {
      console.error("createHelpCategory error:", error);
      throw new ValidationError(
        error.code === "23505"
          ? "A category with that slug already exists."
          : "Failed to create category."
      );
    }

    return { id: data?.id };
  });
}
```

Run: `npx tsc --noEmit`
Expected: Type check passes.

### Step 3: Add `updateHelpCategory`

Append after `createHelpCategory`:

```ts
export async function updateHelpCategory(id: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();
    const fields = parseCategoryForm(formData);

    const { error } = await supabase
      .from("help_categories")
      .update({
        name: fields.name,
        slug: fields.slug,
        sort_order: fields.sort_order,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("updateHelpCategory error:", error);
      throw new ValidationError(
        error.code === "23505"
          ? "A category with that slug already exists."
          : "Failed to update category."
      );
    }

    return { updated: true };
  });
}
```

Run: `npx tsc --noEmit`
Expected: Type check passes.

### Step 4: Add `deleteHelpCategory`

Append after `updateHelpCategory`:

```ts
export async function deleteHelpCategory(id: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase
      .from("help_categories")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("deleteHelpCategory error:", error);
      throw new ValidationError("Failed to delete category.");
    }

    return { deleted: true };
  });
}
```

Run: `npx tsc --noEmit`
Expected: Type check passes.

### Step 5: Commit

```bash
git add lib/data/help-actions.ts
git commit -m "feat: add server actions for help category CRUD"
```

---

## Task 2: Create the HelpCategoryManager component

**Files:**
- Create: `components/help/HelpCategoryManager.tsx`

### Step 1: Create the component file

Create `components/help/HelpCategoryManager.tsx` with the following content:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createHelpCategory,
  updateHelpCategory,
  deleteHelpCategory,
} from "@/lib/data/help-actions";
import type { Database } from "@/lib/database.types";
import { Settings2, Pencil, Trash2, Plus } from "lucide-react";

type HelpCategoryRow = Database["public"]["Tables"]["help_categories"]["Row"];

interface HelpCategoryManagerProps {
  categories: HelpCategoryRow[];
}

export function HelpCategoryManager({ categories }: HelpCategoryManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createHelpCategory(formData);
      if (result.ok) {
        toast.success("Category created");
        router.refresh();
      } else {
        toast.error(result.message ?? "Failed to create category");
      }
    });
  }

  function handleUpdate(id: string, formData: FormData) {
    startTransition(async () => {
      const result = await updateHelpCategory(id, formData);
      if (result.ok) {
        toast.success("Category updated");
        setEditingId(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Failed to update category");
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteHelpCategory(id);
      if (result.ok) {
        toast.success("Category deleted");
        setDeletingId(null);
        router.refresh();
      } else {
        toast.error(result.message ?? "Failed to delete category");
      }
    });
  }

  const sortedCategories = [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings2 className="h-4 w-4 mr-2" />
          Manage categories
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Help categories</DialogTitle>
          <DialogDescription>
            Create, edit, and delete categories used by help articles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <form action={handleCreate} className="space-y-3 rounded-lg border p-3">
            <p className="font-medium text-sm">New category</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-category-name">Name</Label>
                <Input
                  id="new-category-name"
                  name="name"
                  placeholder="e.g. Billing"
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-category-slug">Slug</Label>
                <Input
                  id="new-category-slug"
                  name="slug"
                  placeholder="auto-generated"
                  disabled={isPending}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-category-sort">Sort order</Label>
              <Input
                id="new-category-sort"
                name="sort_order"
                type="number"
                defaultValue={0}
                disabled={isPending}
                className="w-24"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isPending}>
                <Plus className="h-4 w-4 mr-2" />
                Add category
              </Button>
            </div>
          </form>

          <div className="space-y-2">
            <p className="font-medium text-sm">Existing categories</p>
            {sortedCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories yet.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {sortedCategories.map((category) => (
                  <li key={category.id} className="p-3">
                    {editingId === category.id ? (
                      <form
                        action={(formData) => handleUpdate(category.id, formData)}
                        className="space-y-3"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`edit-name-${category.id}`}>Name</Label>
                            <Input
                              id={`edit-name-${category.id}`}
                              name="name"
                              defaultValue={category.name}
                              required
                              disabled={isPending}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`edit-slug-${category.id}`}>Slug</Label>
                            <Input
                              id={`edit-slug-${category.id}`}
                              name="slug"
                              defaultValue={category.slug}
                              disabled={isPending}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`edit-sort-${category.id}`}>Sort order</Label>
                          <Input
                            id={`edit-sort-${category.id}`}
                            name="sort_order"
                            type="number"
                            defaultValue={category.sort_order}
                            disabled={isPending}
                            className="w-24"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingId(null)}
                            disabled={isPending}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" size="sm" disabled={isPending}>
                            Save
                          </Button>
                        </div>
                      </form>
                    ) : deletingId === category.id ? (
                      <div className="space-y-3">
                        <p className="text-sm">
                          Delete <strong>{category.name}</strong>? Articles in this
                          category will become uncategorized.
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingId(null)}
                            disabled={isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(category.id)}
                            disabled={isPending}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {category.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            /help?category={category.slug} · order{" "}
                            {category.sort_order}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setEditingId(category.id)}
                            aria-label="Edit category"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeletingId(category.id)}
                            aria-label="Delete category"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Run: `npx tsc --noEmit`
Expected: Type check passes.

### Step 2: Commit

```bash
git add components/help/HelpCategoryManager.tsx
git commit -m "feat: add HelpCategoryManager dialog component"
```

---

## Task 3: Wire the manager into the admin help page

**Files:**
- Modify: `app/(dashboard)/admin/help/page.tsx`

### Step 1: Import and render the manager

Modify `app/(dashboard)/admin/help/page.tsx`:

1. Add import at the top:

```tsx
import { HelpCategoryManager } from "@/components/help/HelpCategoryManager";
```

2. Replace the header action buttons area (around lines 51-64):

From:

```tsx
      <div className="flex items-center justify-end gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/help/media">
            <ImageIcon className="h-4 w-4 mr-2" />
            Manage media
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/admin/help/new">
            <Plus className="h-4 w-4 mr-2" />
            New article
          </Link>
        </Button>
      </div>
```

To:

```tsx
      <div className="flex items-center justify-end gap-2">
        <HelpCategoryManager categories={categories} />
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/help/media">
            <ImageIcon className="h-4 w-4 mr-2" />
            Manage media
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/admin/help/new">
            <Plus className="h-4 w-4 mr-2" />
            New article
          </Link>
        </Button>
      </div>
```

Run: `npx tsc --noEmit`
Expected: Type check passes.

### Step 2: Commit

```bash
git add app/\(dashboard\)/admin/help/page.tsx
git commit -m "feat: add manage categories button to admin help page"
```

---

## Task 4: Manual verification

**Files:** none

### Step 1: Start the dev server

Run: `pnpm dev`
Expected: Server starts without errors.

### Step 2: Test category creation

1. Log in as a super admin and navigate to `/admin/help`.
2. Click **Manage categories**.
3. Enter a category name (e.g. "Billing"), leave slug blank, and click **Add category**.
4. Expected: The category appears in the "Existing categories" list; toast shows "Category created".

### Step 3: Test category editing

1. In the same dialog, click the pencil icon on the new category.
2. Change the name to "Billing & Payments" and sort order to `5`.
3. Click **Save**.
4. Expected: The list updates; toast shows "Category updated".

### Step 4: Test category deletion

1. Click the trash icon on the category.
2. Confirm deletion.
3. Expected: The category is removed; toast shows "Category deleted".

### Step 5: Verify article form and filters

1. Create a category named "Menus".
2. Click **New article**.
3. Expected: The Category dropdown includes "Menus".
4. Save an article with category "Menus".
5. Return to `/admin/help` and use the "Filter by category" dropdown.
6. Expected: "Menus" appears and filters the article list.

### Step 6: Commit

```bash
git commit --allow-empty -m "chore: verify help category management manually"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - Create category: Task 1 Step 2 + Task 2.
  - Edit category: Task 1 Step 3 + Task 2.
  - Delete category: Task 1 Step 4 + Task 2.
  - Inline dialog from `/admin/help`: Task 3.
  - Article form dropdown reflects changes: Task 4 Step 5 (uses existing `listHelpCategories`).
- **Placeholder scan:** No TBD/TODO placeholders; all code is complete.
- **Type consistency:** `HelpCategoryRow` type reused from `Database`; `safeAction` return shape consistent with existing actions.

