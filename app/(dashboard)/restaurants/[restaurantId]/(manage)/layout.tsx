import { loadRestaurantById } from "@/lib/data/restaurants";
import { requireRestaurantManagementOrRedirect } from "@/lib/billing/subscription";

export default async function RestaurantManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await loadRestaurantById(restaurantId);

  await requireRestaurantManagementOrRedirect(restaurantId, restaurant.org_id);

  return children;
}
