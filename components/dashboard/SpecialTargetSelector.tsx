"use client";

import { useState, useEffect, useMemo } from "react";
import { loadItemsAndCategoriesForRestaurant, loadSpecialTargets } from "@/lib/data/special-target-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

interface Item {
  id: string;
  name: string;
  category_id: string;
  menu_id: string;
  price_cents: number;
}

interface Category {
  id: string;
  name: string;
  menu_id: string;
}

interface SpecialTargetSelectorProps {
  restaurantId: string;
  specialId?: string | null;
  kind: "item_discount" | "category_discount" | "combo";
  /** When set, only items/categories belonging to this menu are listed. */
  menuId?: string | null;
  value: { item_id?: string; category_id?: string; combo_item_ids?: string[] }[];
  onChange: (targets: { item_id?: string; category_id?: string; combo_item_ids?: string[] }[]) => void;
}

function TargetSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}

export function SpecialTargetSelector({
  restaurantId,
  specialId,
  kind,
  menuId,
  value,
  onChange,
}: SpecialTargetSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");

  // `onChange` is intentionally omitted from deps: it's a parent callback that
  // is recreated each render and would re-trigger an infinite reload loop.
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await loadItemsAndCategoriesForRestaurant(restaurantId);
        setItems(data.items);
        setCategories(data.categories);

        // If editing an existing special, load its targets
        if (specialId) {
          const targets = await loadSpecialTargets(specialId);
          onChange(
            targets.map((t) => ({
              item_id: t.item_id ?? undefined,
              category_id: t.category_id ?? undefined,
              combo_item_ids: t.combo_item_ids ?? undefined,
            }))
          );
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, specialId]);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleItems = useMemo(
    () =>
      items.filter((item) => {
        if (menuId && item.menu_id !== menuId) return false;
        if (normalizedQuery && !item.name.toLowerCase().includes(normalizedQuery))
          return false;
        return true;
      }),
    [items, menuId, normalizedQuery]
  );

  const visibleCategories = useMemo(
    () =>
      categories.filter((cat) => {
        if (menuId && cat.menu_id !== menuId) return false;
        if (normalizedQuery && !cat.name.toLowerCase().includes(normalizedQuery))
          return false;
        return true;
      }),
    [categories, menuId, normalizedQuery]
  );

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (kind === "item_discount") {
    const selectedItemIds = value.map((t) => t.item_id).filter(Boolean) as string[];

    function toggleItem(itemId: string) {
      if (selectedItemIds.includes(itemId)) {
        onChange(value.filter((t) => t.item_id !== itemId));
      } else {
        onChange([...value, { item_id: itemId }]);
      }
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Target items</Label>
          {selectedItemIds.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedItemIds.length} selected
            </span>
          )}
        </div>
        <TargetSearch value={query} onChange={setQuery} placeholder="Search items…" />
        <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
          {visibleItems.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">No items found.</p>
          )}
          {visibleItems.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox
                checked={selectedItemIds.includes(item.id)}
                onCheckedChange={() => toggleItem(item.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  R {(item.price_cents / 100).toFixed(2)}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "category_discount") {
    const selectedCategoryIds = value.map((t) => t.category_id).filter(Boolean) as string[];

    function toggleCategory(categoryId: string) {
      if (selectedCategoryIds.includes(categoryId)) {
        onChange(value.filter((t) => t.category_id !== categoryId));
      } else {
        onChange([...value, { category_id: categoryId }]);
      }
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Target categories</Label>
          {selectedCategoryIds.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {selectedCategoryIds.length} selected
            </span>
          )}
        </div>
        <TargetSearch
          value={query}
          onChange={setQuery}
          placeholder="Search categories…"
        />
        <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
          {visibleCategories.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">No categories found.</p>
          )}
          {visibleCategories.map((cat) => (
            <label
              key={cat.id}
              className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox
                checked={selectedCategoryIds.includes(cat.id)}
                onCheckedChange={() => toggleCategory(cat.id)}
              />
              <span className="text-sm font-medium">{cat.name}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  // combo
  const comboItemIds = value[0]?.combo_item_ids ?? [];

  function toggleComboItem(itemId: string) {
    if (comboItemIds.includes(itemId)) {
      onChange([{ combo_item_ids: comboItemIds.filter((id) => id !== itemId) }]);
    } else {
      onChange([{ combo_item_ids: [...comboItemIds, itemId] }]);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Combo items</Label>
          {comboItemIds.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {comboItemIds.length} selected
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Select the items that make up this combo deal.
        </p>
        <TargetSearch value={query} onChange={setQuery} placeholder="Search items…" />
        <div className="rounded-lg border divide-y max-h-64 overflow-y-auto">
          {visibleItems.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">No items found.</p>
          )}
          {visibleItems.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox
                checked={comboItemIds.includes(item.id)}
                onCheckedChange={() => toggleComboItem(item.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  R {(item.price_cents / 100).toFixed(2)}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
