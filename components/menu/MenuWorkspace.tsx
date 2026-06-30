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
import type { CategoryNode } from "@/lib/types/menu";
import { toast } from "sonner";

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
  pairing_ids?: string[];
}

interface MenuWorkspaceProps {
  menuId: string;
  restaurantId: string;
  initialCategories: CategoryNode[];
  initialItems: Item[];
}

/** Apply `fn` to the node with `id` anywhere in a one-level-deep tree. */
function mapNode(
  nodes: CategoryNode[],
  id: string,
  fn: (n: CategoryNode) => CategoryNode
): CategoryNode[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n);
    if (n.children.length) {
      return { ...n, children: n.children.map((c) => (c.id === id ? fn(c) : c)) };
    }
    return n;
  });
}

export function MenuWorkspace({
  menuId,
  restaurantId,
  initialCategories,
  initialItems,
}: MenuWorkspaceProps) {
  const [categories, setCategories] = useState<CategoryNode[]>(initialCategories);
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

      // Top-level categories
      if (activeType === "category" && overType === "category") {
        const oldIndex = categories.findIndex((c) => c.id === active.id);
        const newIndex = categories.findIndex((c) => c.id === over.id);
        const newOrder = arrayMove(categories, oldIndex, newIndex);
        setCategories(newOrder);

        try {
          await reorderCategories(menuId, newOrder.map((c) => c.id));
          toast.success("Categories reordered");
        } catch {
          toast.error("Failed to reorder categories");
          setCategories(initialCategories);
        }
        return;
      }

      // Sub-categories (reorder within their shared parent)
      if (activeType === "subcategory" && overType === "subcategory") {
        const parentId = active.data.current?.parentId;
        if (parentId !== over.data.current?.parentId) return;
        const parent = categories.find((c) => c.id === parentId);
        if (!parent) return;

        const oldIndex = parent.children.findIndex((s) => s.id === active.id);
        const newIndex = parent.children.findIndex((s) => s.id === over.id);
        const newChildren = arrayMove(parent.children, oldIndex, newIndex);
        setCategories((prev) =>
          prev.map((c) => (c.id === parentId ? { ...c, children: newChildren } : c))
        );

        try {
          await reorderCategories(menuId, newChildren.map((s) => s.id));
          toast.success("Sub-categories reordered");
        } catch {
          toast.error("Failed to reorder sub-categories");
          setCategories(initialCategories);
        }
        return;
      }

      // Items (reorder within their category)
      if (activeType === "item" && overType === "item") {
        const activeItem = items.find((i) => i.id === active.id);
        const overItem = items.find((i) => i.id === over.id);
        if (!activeItem || !overItem) return;
        if (activeItem.category_id !== overItem.category_id) return;

        const catId = activeItem.category_id;
        const catItems = items.filter((i) => i.category_id === catId);
        const oldIndex = catItems.findIndex((i) => i.id === active.id);
        const newIndex = catItems.findIndex((i) => i.id === over.id);
        const newCatItems = arrayMove(catItems, oldIndex, newIndex);

        const otherItems = items.filter((i) => i.category_id !== catId);
        setItems([...otherItems, ...newCatItems]);

        try {
          await reorderItems(menuId, catId, newCatItems.map((i) => i.id));
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
      // Collect descendant ids so we can drop their items optimistically too.
      const node = categories.find((c) => c.id === categoryId);
      const descendantIds = node
        ? [categoryId, ...node.children.map((c) => c.id)]
        : [categoryId];

      setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      setItems((prev) => prev.filter((i) => !descendantIds.includes(i.category_id)));
      try {
        await deleteCategory(categoryId);
        toast.success("Category deleted");
      } catch {
        toast.error("Failed to delete category");
        setCategories(initialCategories);
        setItems(initialItems);
      }
    },
    [categories, initialCategories, initialItems]
  );

  const handleDeleteSubcategory = useCallback(
    async (subcategoryId: string) => {
      setCategories((prev) =>
        prev.map((c) => ({
          ...c,
          children: c.children.filter((s) => s.id !== subcategoryId),
        }))
      );
      setItems((prev) => prev.filter((i) => i.category_id !== subcategoryId));
      try {
        await deleteCategory(subcategoryId);
        toast.success("Sub-category deleted");
      } catch {
        toast.error("Failed to delete sub-category");
        setCategories(initialCategories);
        setItems(initialItems);
      }
    },
    [initialCategories, initialItems]
  );

  const handleUpdateName = useCallback(
    async (id: string, name: string) => {
      setCategories((prev) => mapNode(prev, id, (n) => ({ ...n, name })));
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
              items={items}
              menuItems={items.map((i) => ({ id: i.id, name: i.name }))}
              menuId={menuId}
              restaurantId={restaurantId}
              onUpdateCategoryName={handleUpdateName}
              onDeleteCategory={handleDeleteCategory}
              onUpdateSubcategoryName={handleUpdateName}
              onDeleteSubcategory={handleDeleteSubcategory}
              onDeleteItem={handleDeleteItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
