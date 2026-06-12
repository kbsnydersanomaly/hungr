"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableCategory } from "./SortableCategory";
import {
  reorderCategories,
  reorderItems,
  deleteItem,
  deleteCategory,
  updateCategoryName,
} from "@/lib/data/menu-actions";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface Item {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  category_id: string;
  sort_order: number;
  image_url: string | null;
  image_urls?: string[];
  allergens: string[];
  labels: string[];
  preparations: { name: string; price_cents?: number }[];
  variations: { name: string; price_cents?: number }[];
  sides: { name: string; price_cents?: number }[];
  sauces: { name: string; price_cents?: number }[];
}

interface MenuWorkspaceProps {
  menuId: string;
  restaurantId: string;
  initialCategories: Category[];
  initialItems: Item[];
}

export function MenuWorkspace({
  menuId,
  restaurantId,
  initialCategories,
  initialItems,
}: MenuWorkspaceProps) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [prevInitialCategories, setPrevInitialCategories] = useState(initialCategories);
  const [prevInitialItems, setPrevInitialItems] = useState(initialItems);

  // Sync local state when the server-provided initial data changes (e.g.,
  // after a revalidatePath). This is the recommended "state derived from
  // props" pattern: setState during render avoids the cascading-render
  // warning that useEffect + setState would produce.
  if (initialCategories !== prevInitialCategories) {
    setPrevInitialCategories(initialCategories);
    setCategories(initialCategories);
  }
  if (initialItems !== prevInitialItems) {
    setPrevInitialItems(initialItems);
    setItems(initialItems);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeType = active.data.current?.type;
      const overType = over.data.current?.type;

      if (activeType === "category" && overType === "category") {
        const oldIndex = categories.findIndex((c) => c.id === active.id);
        const newIndex = categories.findIndex((c) => c.id === over.id);
        const newOrder = arrayMove(categories, oldIndex, newIndex);
        setCategories(newOrder);

        try {
          await reorderCategories(
            menuId,
            newOrder.map((c) => c.id)
          );
          toast.success("Categories reordered");
        } catch {
          toast.error("Failed to reorder categories");
          setCategories(initialCategories);
        }
      }

      if (activeType === "item" && overType === "item") {
        const activeItem = items.find((i) => i.id === active.id);
        const overItem = items.find((i) => i.id === over.id);
        if (!activeItem || !overItem) return;

        const catId = activeItem.category_id;
        const catItems = items.filter((i) => i.category_id === catId);
        const oldIndex = catItems.findIndex((i) => i.id === active.id);
        const newIndex = catItems.findIndex((i) => i.id === over.id);
        const newCatItems = arrayMove(catItems, oldIndex, newIndex);

        const otherItems = items.filter((i) => i.category_id !== catId);
        setItems([...otherItems, ...newCatItems]);

        try {
          await reorderItems(
            menuId,
            catId,
            newCatItems.map((i) => i.id)
          );
          toast.success("Items reordered");
        } catch {
          toast.error("Failed to reorder items");
          setItems(initialItems);
        }
      }
    },
    [categories, items, menuId, initialCategories, initialItems]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      try {
        await deleteItem(itemId);
        toast.success("Item deleted");
      } catch {
        toast.error("Failed to delete item");
        setItems(initialItems);
      }
    },
    [initialItems]
  );

  const handleDeleteCategory = useCallback(
    async (categoryId: string) => {
      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      setItems((prev) => prev.filter((i) => i.category_id !== categoryId));
      try {
        await deleteCategory(categoryId);
        toast.success("Category deleted");
      } catch {
        toast.error("Failed to delete category");
        setCategories(initialCategories);
        setItems(initialItems);
      }
    },
    [initialCategories, initialItems]
  );

  const handleUpdateCategoryName = useCallback(
    async (id: string, name: string) => {
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name } : c))
      );
      try {
        await updateCategoryName(id, name);
        toast.success("Category updated");
      } catch {
        toast.error("Failed to update category");
        setCategories(initialCategories);
      }
    },
    [initialCategories]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={categories.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-4">
          {categories.map((cat) => (
            <SortableCategory
              key={cat.id}
              category={cat}
              items={items.filter((i) => i.category_id === cat.id)}
              menuId={menuId}
              restaurantId={restaurantId}
              onUpdateCategoryName={handleUpdateCategoryName}
              onDeleteCategory={handleDeleteCategory}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
