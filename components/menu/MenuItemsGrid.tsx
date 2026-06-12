"use client";

import { ItemCard } from "./ItemCard";

interface MenuItemsGridProps {
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    image_url: string | null;
    image_urls: string[];
    labels: string[];
    category_id: string;
  }>;
  restaurantSlug: string;
  menuSlug: string;
  menuId: string;
  variant?: "default" | "small-grid" | "compact";
}

export function MenuItemsGrid({ items, restaurantSlug, menuSlug, menuId, variant = "default" }: MenuItemsGridProps) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No items found
      </div>
    );
  }

  const gridClass =
    variant === "small-grid"
      ? "grid grid-cols-2 sm:grid-cols-3 gap-3"
      : variant === "compact"
      ? "grid grid-cols-1 gap-2"
      : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4";

  return (
    <div className={gridClass}>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          restaurantSlug={restaurantSlug}
          menuSlug={menuSlug}
          menuId={menuId}
          compact={variant === "compact"}
        />
      ))}
    </div>
  );
}
