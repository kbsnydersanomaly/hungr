"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Pencil, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemEditSheet } from "./ItemEditSheet";

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
}

interface SortableItemProps {
  item: Item;
  menuId: string;
  restaurantId: string;
  onDelete: (id: string) => Promise<void>;
}

export function SortableItem({ item, menuId, restaurantId, onDelete }: SortableItemProps) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { type: "item", categoryId: item.category_id } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className="flex items-center gap-2 p-3 rounded-lg border bg-background group"
      >
        <button
          {...attributes}
          {...listeners}
          className="touch-none p-1 rounded hover:bg-muted text-muted-foreground cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{item.name}</p>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
          )}
        </div>

        <p className="text-sm font-medium tabular-nums">
          R {(item.price_cents / 100).toFixed(2)}
        </p>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <form
            action={async () => {
              setDeleting(true);
              try {
                await onDelete(item.id);
              } finally {
                setDeleting(false);
              }
            }}
          >
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        </div>
      </div>

      <ItemEditSheet
        open={editing}
        onOpenChange={setEditing}
        menuId={menuId}
        categoryId={item.category_id}
        restaurantId={restaurantId}
        item={item}
      />
    </>
  );
}
