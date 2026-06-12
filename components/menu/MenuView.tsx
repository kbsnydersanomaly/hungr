"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Header } from "./Header";
import { SearchBar } from "./SearchBar";
import { CategoryFilter } from "./CategoryFilter";
import { SpecialsSlider } from "./SpecialsSlider";
import { MenuItemsGrid } from "./MenuItemsGrid";
import { MenuSwitcher } from "./MenuSwitcher";
import { trackEvent } from "@/lib/analytics/track";

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
  categories: Array<{ id: string; name: string }>;
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
    image_url: string | null;
    discount_pct: number | null;
    discount_amount_cents: number | null;
    discount_type: string | null;
    combo_price_cents: number | null;
    kind: string;
  }>;
  menus?: Array<{ id: string; name: string; slug: string; is_default?: boolean | null }>;
  logoUrl?: string | null;
}

export function MenuView({ restaurant, menu, categories, items, specials, menus = [], logoUrl }: MenuViewProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
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
      const category = categories.find((c) => c.id === id);
      trackEvent({
        menuId: menu.id,
        eventType: "filter",
        metadata: { category_id: id, category_name: category?.name },
      });
    }
  };

  const filteredItems = useMemo(() => {
    let result = items;

    if (activeCategory) {
      result = result.filter((item) => item.category_id === activeCategory);
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
  }, [items, activeCategory, search]);

  return (
    <div className="flex flex-col flex-1">
      <Header
        restaurantName={restaurant.name}
        logoUrl={logoUrl}
        restaurantSlug={restaurant.slug}
        currentMenuSlug={menu.slug}
        menus={menus}
        categories={categories}
      >
        <MenuSwitcher
          restaurantSlug={restaurant.slug}
          currentMenuSlug={menu.slug}
          menus={menus}
        />
      </Header>

      <SearchBar value={search} onChange={setSearch} />

      {categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          activeId={activeCategory}
          onSelect={handleCategorySelect}
        />
      )}

      {specials.length > 0 && <SpecialsSlider specials={specials} />}

      <div className="flex-1 px-4 py-4">
        {filteredItems.length > 0 ? (
          <MenuItemsGrid
            items={filteredItems}
            restaurantSlug={restaurant.slug}
            menuSlug={menu.slug}
            menuId={menu.id}
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
