"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Check, X, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SortableItem } from "./SortableItem";
import { ItemEditSheet } from "./ItemEditSheet";

interface Subcategory {
  id: string;
  name: string;
}

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

interface SortableSubcategoryProps {
  subcategory: Subcategory;
  parentId: string;
  items: Item[];
  menuItems: { id: string; name: string }[];
  menuId: string;
  restaurantId: string;
  onUpdateName: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

export function SortableSubcategory({
  subcategory,
  parentId,
  items,
  menuItems,
  menuId,
  restaurantId,
  onUpdateName,
  onDelete,
  onDeleteItem,
}: SortableSubcategoryProps) {
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameValue, setNameValue] = useState(subcategory.name);
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
  } = useSortable({
    id: subcategory.id,
    data: { type: "subcategory", parentId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border bg-muted/30">
      <div className="flex flex-row items-center gap-2 px-3 py-2">
        <button
          {...attributes}
          {...listeners}
          className="touch-none p-1 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {editingName ? (
          <form
            action={async () => {
              setSavingName(true);
              try {
                await onUpdateName(subcategory.id, nameValue);
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
              className="h-7 text-sm"
              autoFocus
              disabled={savingName}
            />
            <Button type="submit" size="icon" variant="ghost" className="h-7 w-7" disabled={savingName}>
              {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setNameValue(subcategory.name);
                setEditingName(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <>
            <h4 className="font-medium text-sm flex-1">{subcategory.name}</h4>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingName(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete “{subcategory.name}”?</DialogTitle>
              <DialogDescription>
                {items.length > 0
                  ? `This will permanently delete the sub-category and its ${items.length} item${items.length === 1 ? "" : "s"}. This cannot be undone.`
                  : "This will permanently delete the sub-category. This cannot be undone."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete(subcategory.id);
                  } finally {
                    setDeleting(false);
                    setConfirmDelete(false);
                  }
                }}
              >
                {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Delete sub-category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2 px-3 pb-3">
        {items.length > 0 && (
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableItem
                key={item.id}
                item={item}
                menuItems={menuItems}
                menuId={menuId}
                restaurantId={restaurantId}
                onDelete={onDeleteItem}
              />
            ))}
          </SortableContext>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto flex text-muted-foreground"
          onClick={() => setShowItemForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add item
        </Button>

        <ItemEditSheet
          open={showItemForm}
          onOpenChange={setShowItemForm}
          menuId={menuId}
          categoryId={subcategory.id}
          restaurantId={restaurantId}
          item={null}
          menuItems={menuItems}
        />
      </div>
    </div>
  );
}
