import { loadRestaurantBySlug } from "@/lib/data/restaurants";
import { loadDefaultMenuForRestaurant, loadCategoriesForMenu, loadSubcategoriesForMenu, loadMenuItemsForMenu, buildCategoryTree } from "@/lib/data/menus";
import { loadActiveSpecialsForRestaurant } from "@/lib/data/specials";
import { filterActiveSpecials, currentScheduleContext } from "@/lib/utils/specials";
import { loadPublishedMenusForRestaurant } from "@/lib/data/menu-switcher-actions";
import { loadBranding } from "@/lib/data/branding";
import { MenuView } from "@/components/menu/MenuView";
import { EmptyState } from "@/components/EmptyState";
import { UtensilsCrossed } from "lucide-react";

export default async function DefaultMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantSlug: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const { restaurantSlug } = await params;
  const categoryParam = await searchParams;
  const initialCategoryId = Array.isArray(categoryParam.category)
    ? categoryParam.category[0]
    : categoryParam.category;
  const restaurant = await loadRestaurantBySlug(restaurantSlug);

  let menu;
  try {
    menu = await loadDefaultMenuForRestaurant(restaurant.id);
  } catch {
    return (
      <div className="flex flex-col flex-1">
        <div className="flex-1 flex items-center justify-center p-6">
          <EmptyState
            icon={UtensilsCrossed}
            title="No menu yet"
            description={`${restaurant.name} hasn't published a menu yet.`}
          />
        </div>
      </div>
    );
  }

  const [topCategories, subCategories, items, specials, menus, branding] = await Promise.all([
    loadCategoriesForMenu(menu.id),
    loadSubcategoriesForMenu(menu.id),
    loadMenuItemsForMenu(menu.id),
    loadActiveSpecialsForRestaurant(restaurant.id),
    loadPublishedMenusForRestaurant(restaurant.id),
    loadBranding(restaurant.id),
  ]);
  const categories = buildCategoryTree(topCategories, subCategories);
  const activeSpecials = filterActiveSpecials(specials, currentScheduleContext());

  return (
    <MenuView
      restaurant={restaurant}
      menu={menu}
      categories={categories}
      items={items}
      specials={activeSpecials}
      menus={menus}
      logoUrl={branding?.logo_url}
      bannerImageUrls={branding?.banner_image_urls}
      initialCategoryId={initialCategoryId}
    />
  );
}
