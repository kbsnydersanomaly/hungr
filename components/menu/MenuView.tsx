"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Header } from "./Header";
import { SearchBar } from "./SearchBar";
import { CategoryFilter } from "./CategoryFilter";
import { SpecialsSlider } from "./SpecialsSlider";
import { MenuBanner } from "./MenuBanner";
import { MenuItemsGrid } from "./MenuItemsGrid";
import { MenuSwitcher } from "./MenuSwitcher";
import { trackEvent } from "@/lib/analytics/track";
import { isSpecialActiveNow } from "@/lib/specials/filter";
import {
  getItemDiscount,
  findCategoryDiscount,
  formatDiscountLabel,
} from "@/lib/specials/discounts";
import type { CategoryNode } from "@/lib/types/menu";

/** Find a category's display name anywhere in a one-level-deep tree. */
function findCategoryName(categories: CategoryNode[], id: string): string | undefined {
  for (const cat of categories) {
    if (cat.id === id) return cat.name;
    const child = cat.children.find((s) => s.id === id);
    if (child) return child.name;
  }
  return undefined;
}

/** Collect a category id and all of its descendant ids (one level deep). */
function collectCategoryAndDescendantIds(
  categories: CategoryNode[],
  id: string
): Set<string> {
  const node = categories.find((c) => c.id === id);
  if (node) {
    return new Set([node.id, ...node.children.map((c) => c.id)]);
  }
  // `id` may itself be a sub-category — match it directly.
  return new Set([id]);
}

interface MenuViewProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
  menu: {
    id: string;
    name: string;
    slug: string;
  };
  categories: CategoryNode[];
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    image_url: string | null;
    image_urls: string[];
    labels: string[];
    category_id: string;
    allergens: string[];
  }>;
  specials: Array<{
    id: string;
    title: string;
    description: string | null;
    custom_promotional_text?: string | null;
    image_url: string | null;
    discount_pct: number | null;
    discount_amount_cents: number | null;
    discount_type: string | null;
    combo_price_cents: number | null;
    kind: string;
    active: boolean;
    menu_id: string | null;
    date_from: string | null;
    date_to: string | null;
    time_from: string | null;
    time_to: string | null;
    selected_days: string[] | null;
    time_windows?: unknown;
    special_targets: Array<{
      item_id: string | null;
      category_id: string | null;
      combo_item_ids?: string[] | null;
      menu_items?: { name: string } | null;
      categories?: { name: string } | null;
    }> | null;
  }>;
  menus?: Array<{ id: string; name: string; slug: string; is_default?: boolean | null }>;
  logoUrl?: string | null;
  bannerImageUrls?: string[];
  /** Initial category filter (e.g. from a `?category=` query param). */
  initialCategoryId?: string | null;
}

export function MenuView({
  restaurant,
  menu,
  categories,
  items,
  specials,
  menus = [],
  logoUrl,
  bannerImageUrls = [],
  initialCategoryId = null,
}: MenuViewProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategoryId);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track page view
  useEffect(() => {
    trackEvent({ menuId: menu.id, eventType: "view" });
  }, [menu.id]);

  // Track search with debounce
  useEffect(() => {
    if (!search.trim()) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      trackEvent({ menuId: menu.id, eventType: "search", metadata: { term: search.trim() } });
    }, 1000);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search, menu.id]);

  // Track category filter
  const handleCategorySelect = (id: string | null) => {
    setActiveCategory(id);
    if (id) {
      const name = findCategoryName(categories, id);
      trackEvent({
        menuId: menu.id,
        eventType: "filter",
        metadata: { category_id: id, category_name: name },
      });
    }
  };

  const activeSpecials = useMemo(
    () => specials.filter((s) => isSpecialActiveNow(s, { menuId: menu.id })),
    [specials, menu.id]
  );

  const bannerSpecials = useMemo(
    () =>
      activeSpecials
        .filter((s) => s.image_url)
        .map((s) => ({ ...s, image_url: s.image_url as string })),
    [activeSpecials]
  );

  const sliderSpecials = useMemo(
    () => activeSpecials.filter((s) => !s.image_url),
    [activeSpecials]
  );

  const itemsWithDiscounts = useMemo(
    () =>
      items.map((item) => {
        const discount = getItemDiscount(item, activeSpecials, { menuId: menu.id });
        return { ...item, ...discount };
      }),
    [items, activeSpecials, menu.id]
  );

  const filteredItems = useMemo(() => {
    let result = itemsWithDiscounts;

    if (activeCategory) {
      const ids = collectCategoryAndDescendantIds(categories, activeCategory);
      result = result.filter((item) => ids.has(item.category_id));
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          (item.description?.toLowerCase().includes(term) ?? false)
      );
    }

    return result;
  }, [itemsWithDiscounts, categories, activeCategory, search]);

  const categoriesWithDiscounts = useMemo(
    () =>
      categories.map((category) => {
        const discount = findCategoryDiscount(category.id, activeSpecials, { menuId: menu.id });
        return { ...category, discount_label: discount ? formatDiscountLabel(discount) : null };
      }),
    [categories, activeSpecials, menu.id]
  );

  return (
    <div className="flex flex-col flex-1">
      <Header
        restaurantName={restaurant.name}
        logoUrl={logoUrl}
        restaurantSlug={restaurant.slug}
        currentMenuSlug={menu.slug}
        menus={menus}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        onCategorySelect={handleCategorySelect}
      >
        <MenuSwitcher
          restaurantSlug={restaurant.slug}
          currentMenuSlug={menu.slug}
          menus={menus}
        />
      </Header>

      {bannerSpecials.length > 0 || bannerImageUrls.length > 0 ? (
        <MenuBanner
          bannerImageUrls={bannerImageUrls}
          specials={bannerSpecials}
          restaurantSlug={restaurant.slug}
          menuSlug={menu.slug}
          items={items}
        />
      ) : null}

      <SearchBar value={search} onChange={setSearch} />

      {categoriesWithDiscounts.length > 0 && (
        <CategoryFilter
          categories={categoriesWithDiscounts}
          activeId={activeCategory}
          onSelect={handleCategorySelect}
        />
      )}

      {sliderSpecials.length > 0 && (
        <SpecialsSlider
          specials={sliderSpecials}
          restaurantSlug={restaurant.slug}
          menuSlug={menu.slug}
          items={items}
        />
      )}

      <div className="flex-1 px-4 py-4">
        {filteredItems.length > 0 ? (
          <MenuItemsGrid
            items={filteredItems}
            restaurantSlug={restaurant.slug}
            menuSlug={menu.slug}
            menuId={menu.id}
            specials={specials}
          />
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            {search ? "No items match your search" : "No items in this menu yet"}
          </div>
        )}
      </div>
    </div>
  );
}
