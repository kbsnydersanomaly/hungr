"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Check, X, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SortableItem } from "./SortableItem";
import { SortableSubcategory } from "./SortableSubcategory";
import { ItemEditSheet } from "./ItemEditSheet";
import { AddCategoryForm } from "./AddCategoryForm";
import type { CategoryNode } from "@/lib/types/menu";

interface Item {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category_id: string;
  image_url: string | null;
  image_urls?: string[];
  allergens: string[];
  labels: string[];
  preparations: { name: string; price_cents?: number }[];
  variations: { name: string; price_cents?: number }[];
  sides: { name: string; price_cents?: number }[];
  sauces: { name: string; price_cents?: number }[];
  pairing_ids?: string[];
}

interface SortableCategoryProps {
  category: CategoryNode;
  /** All items in the menu; this component partitions them by category. */
  items: Item[];
  /** All items in the menu, used to pick pairings. */
  menuItems: { id: string; name: string }[];
  menuId: string;
  restaurantId: string;
  onUpdateCategoryName: (id: string, name: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onUpdateSubcategoryName: (id: string, name: string) => Promise<void>;
  onDeleteSubcategory: (id: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export function SortableCategory({
  category,
  items,
  menuItems,
  menuId,
  restaurantId,
  onUpdateCategoryName,
  onDeleteCategory,
  onUpdateSubcategoryName,
  onDeleteSubcategory,
  onDeleteItem,
}: SortableCategoryProps) {
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameValue, setNameValue] = useState(category.name);
  const [showItemForm, setShowItemForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id, data: { type: "category" } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const directItems = items.filter((i) => i.category_id === category.id);
  const subcategories = category.children;
  const totalItemCount =
    directItems.length +
    subcategories.reduce((sum, s) => sum + items.filter((i) => i.category_id === s.id).length, 0);

  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="touch-none p-1 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {editingName ? (
            <form
              action={async () => {
                setSavingName(true);
                try {
                  await onUpdateCategoryName(category.id, nameValue);
                  setEditingName(false);
                } finally {
                  setSavingName(false);
                }
              }}
              className="flex items-center gap-2 flex-1"
            >
              <Input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                className="h-8 text-sm"
                autoFocus
                disabled={savingName}
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                disabled={savingName}
              >
                {savingName ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setNameValue(category.name);
                  setEditingName(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <>
              <h3 className="font-semibold text-base flex-1">{category.name}</h3>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setEditingName(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete “{category.name}”?</DialogTitle>
                <DialogDescription>
                  {totalItemCount > 0
                    ? `This will permanently delete the category, its ${subcategories.length} sub-categor${subcategories.length === 1 ? "y" : "ies"}, and ${totalItemCount} item${totalItemCount === 1 ? "" : "s"}. This cannot be undone.`
                    : "This will permanently delete the category. This cannot be undone."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await onDeleteCategory(category.id);
                    } finally {
                      setDeleting(false);
                      setConfirmDelete(false);
                    }
                  }}
                >
                  {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Delete category
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-3">
          {directItems.length > 0 && (
            <SortableContext items={directItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {directItems.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    menuItems={menuItems}
                    menuId={menuId}
                    restaurantId={restaurantId}
                    onDelete={onDeleteItem}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          {subcategories.length > 0 && (
            <SortableContext items={subcategories.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 pt-2">
                {subcategories.map((sub) => (
                  <SortableSubcategory
                    key={sub.id}
                    subcategory={sub}
                    parentId={category.id}
                    items={items.filter((i) => i.category_id === sub.id)}
                    menuItems={menuItems}
                    menuId={menuId}
                    restaurantId={restaurantId}
                    onUpdateName={onUpdateSubcategoryName}
                    onDelete={onDeleteSubcategory}
                    onDeleteItem={onDeleteItem}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          <div className="flex items-center justify-end gap-1">
            {directItems.length === 0 && subcategories.length === 0 && (
              <p className="mr-auto text-sm text-muted-foreground">No items yet</p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setShowItemForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add item
            </Button>
            <AddCategoryForm
              menuId={menuId}
              parentId={category.id}
              inline
              buttonLabel="Add sub-category"
              placeholder="Sub-category name"
              buttonClassName="text-muted-foreground"
            />
          </div>

          <ItemEditSheet
            open={showItemForm}
            onOpenChange={setShowItemForm}
            menuId={menuId}
            categoryId={category.id}
            restaurantId={restaurantId}
            item={null}
            menuItems={menuItems}
          />
        </CardContent>
      </Card>
    </div>
  );
}
