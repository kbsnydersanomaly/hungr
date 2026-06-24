import { notFound } from "next/navigation";
import { loadRestaurantBySlug } from "@/lib/data/restaurants";
import { loadMenuBySlug, loadCategoriesForMenu, loadMenuItemsForMenu } from "@/lib/data/menus";
import { loadActiveSpecialsForRestaurant } from "@/lib/data/specials";
import { loadPublishedMenusForRestaurant } from "@/lib/data/menu-switcher-actions";
import { loadBranding } from "@/lib/data/branding";
import { MenuView } from "@/components/menu/MenuView";

export default async function SpecificMenuPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string; menuSlug: string }>;
}) {
  const { restaurantSlug, menuSlug } = await params;
  const restaurant = await loadRestaurantBySlug(restaurantSlug);

  let menu;
  try {
    menu = await loadMenuBySlug(restaurantSlug, menuSlug);
  } catch {
    notFound();
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
