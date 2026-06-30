"use client";

import { useMemo, useState, useTransition } from "react";
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
import { Settings2, Pencil, Trash2, Plus, Loader2 } from "lucide-react";

type HelpCategoryRow = Database["public"]["Tables"]["help_categories"]["Row"];

interface HelpCategoryManagerProps {
  categories: HelpCategoryRow[];
}

function buildCategoryFormData(values: {
  name: string;
  slug: string;
  sort_order: number;
}): FormData {
  const formData = new FormData();
  formData.append("name", values.name.trim());
  formData.append("slug", values.slug.trim());
  formData.append("sort_order", String(values.sort_order));
  return formData;
}

function parseSortOrder(value: string): number {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

export function HelpCategoryManager({ categories }: HelpCategoryManagerProps) {
  const router = useRouter();
  const [isCreatePending, startCreateTransition] = useTransition();
  const [isUpdatePending, startUpdateTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      }),
    [categories]
  );

  function resetCreateForm() {
    setNewName("");
    setNewSlug("");
    setNewSortOrder(0);
  }

  function startEditing(category: HelpCategoryRow) {
    setConfirmingId(null);
    setEditingId(category.id);
    setEditName(category.name);
    setEditSlug(category.slug ?? "");
    setEditSortOrder(category.sort_order ?? 0);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditName("");
    setEditSlug("");
    setEditSortOrder(0);
  }

  function startDeleting(category: HelpCategoryRow) {
    setEditingId(null);
    setConfirmingId(category.id);
  }

  function cancelDeleting() {
    setConfirmingId(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetCreateForm();
      setEditingId(null);
      setConfirmingId(null);
    }
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startCreateTransition(async () => {
      const result = await createHelpCategory(
        buildCategoryFormData({
          name: newName,
          slug: newSlug,
          sort_order: newSortOrder,
        })
      );

      if (!result.ok) {
        toast.error(result.message ?? "Failed to create category.");
        return;
      }

      toast.success("Category created.");
      resetCreateForm();
      router.refresh();
    });
  }

  function handleUpdate(categoryId: string) {
    startUpdateTransition(async () => {
      const result = await updateHelpCategory(
        categoryId,
        buildCategoryFormData({
          name: editName,
          slug: editSlug,
          sort_order: editSortOrder,
        })
      );

      if (!result.ok) {
        toast.error(result.message ?? "Failed to update category.");
        return;
      }

      toast.success("Category updated.");
      setEditingId(null);
      router.refresh();
    });
  }

  function handleUpdateForm(
    categoryId: string,
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    handleUpdate(categoryId);
  }

  function handleDelete(categoryId: string, categoryName: string) {
    startDeleteTransition(async () => {
      const result = await deleteHelpCategory(categoryId);

      if (!result.ok) {
        toast.error(result.message ?? "Failed to delete category.");
        return;
      }

      const affected = result.data?.affectedArticles ?? 0;
      toast.success(
        affected > 0
          ? `Category "${categoryName}" deleted. ${affected} articles affected.`
          : `Category "${categoryName}" deleted.`
      );
      setConfirmingId(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Settings2 className="h-4 w-4" />
            Manage categories
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help categories</DialogTitle>
          <DialogDescription>
            Create, edit, and delete categories used to organize help articles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="font-medium text-sm">New category</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category-name">Name</Label>
                <Input
                  id="category-name"
                  name="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Category name"
                  disabled={isCreatePending}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-slug">Slug</Label>
                <Input
                  id="category-slug"
                  name="slug"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="auto-generated"
                  disabled={isCreatePending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-sort-order">Sort order</Label>
                <Input
                  id="category-sort-order"
                  name="sort_order"
                  type="number"
                  min="0"
                  value={newSortOrder}
                  onChange={(e) =>
                    setNewSortOrder(parseSortOrder(e.target.value))
                  }
                  disabled={isCreatePending}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCreatePending || !newName.trim()}
                >
                  {isCreatePending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add category
                </Button>
              </div>
            </div>
          </form>

          <div className="space-y-3">
            <div className="font-medium text-sm">Existing categories</div>
            {sortedCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedCategories.map((category) => {
                  const isEditing = editingId === category.id;
                  const isConfirming = confirmingId === category.id;

                  return (
                    <li
                      key={category.id}
                      className="rounded-lg border bg-card p-3"
                    >
                      {isConfirming ? (
                        <div className="space-y-3">
                          <p className="text-sm">
                            Delete <strong>{category.name}</strong>? Articles
                            in this category will become uncategorized.
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={cancelDeleting}
                              disabled={isDeletePending}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                handleDelete(category.id, category.name)
                              }
                              disabled={isDeletePending}
                            >
                              {isDeletePending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Delete"
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : isEditing ? (
                        <form
                          onSubmit={(e) => handleUpdateForm(category.id, e)}
                          className="space-y-3"
                        >
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1.5">
                              <Label htmlFor={`edit-name-${category.id}`}>
                                Name
                              </Label>
                              <Input
                                id={`edit-name-${category.id}`}
                                name="name"
                                value={editName}
                                onChange={(e) =>
                                  setEditName(e.target.value)
                                }
                                disabled={isUpdatePending}
                                required
                                autoFocus
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`edit-slug-${category.id}`}>
                                Slug
                              </Label>
                              <Input
                                id={`edit-slug-${category.id}`}
                                name="slug"
                                value={editSlug}
                                onChange={(e) =>
                                  setEditSlug(e.target.value)
                                }
                                placeholder="auto-generated"
                                disabled={isUpdatePending}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label
                                htmlFor={`edit-sort-order-${category.id}`}
                              >
                                Sort order
                              </Label>
                              <Input
                                id={`edit-sort-order-${category.id}`}
                                name="sort_order"
                                type="number"
                                min="0"
                                value={editSortOrder}
                                onChange={(e) =>
                                  setEditSortOrder(
                                    parseSortOrder(e.target.value)
                                  )
                                }
                                disabled={isUpdatePending}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                              disabled={isUpdatePending}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              disabled={isUpdatePending || !editName.trim()}
                            >
                              {isUpdatePending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">
                              {category.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {category.slug} · order {category.sort_order}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Edit ${category.name}`}
                              onClick={() => startEditing(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Delete ${category.name}`}
                              onClick={() => startDeleting(category)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
