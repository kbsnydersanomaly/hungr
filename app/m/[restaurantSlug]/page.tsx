import { loadRestaurantBySlug } from "@/lib/data/restaurants";
import { loadDefaultMenuForRestaurant, loadCategoriesForMenu, loadMenuItemsForMenu } from "@/lib/data/menus";
import { loadActiveSpecialsForRestaurant } from "@/lib/data/specials";
import { loadPublishedMenusForRestaurant } from "@/lib/data/menu-switcher-actions";
import { loadBranding } from "@/lib/data/branding";
import { MenuView } from "@/components/menu/MenuView";
import { EmptyState } from "@/components/EmptyState";
import { UtensilsCrossed } from "lucide-react";

export default async function DefaultMenuPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
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

  const [categories, items, specials, menus, branding] = await Promise.all([
    loadCategoriesForMenu(menu.id),
    loadMenuItemsForMenu(menu.id),
    loadActiveSpecialsForRestaurant(restaurant.id),
    loadPublishedMenusForRestaurant(restaurant.id),
    loadBranding(restaurant.id),
  ]);

  return (
    <MenuView
      restaurant={restaurant}
      menu={menu}
      categories={categories}
      items={items}
      specials={specials}
      menus={menus}
      logoUrl={branding?.logo_url}
      bannerImageUrls={branding?.banner_image_urls}
    />
  );
}
