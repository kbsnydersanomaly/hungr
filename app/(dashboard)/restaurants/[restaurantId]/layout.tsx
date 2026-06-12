import { notFound } from "next/navigation";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { TrackActiveRestaurant } from "@/components/dashboard/TrackActiveRestaurant";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;

  await requireRestaurantAccess(restaurantId, "staff");

  try {
    await loadRestaurantById(restaurantId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <TrackActiveRestaurant restaurantId={restaurantId} />
      {children}
    </div>
  );
}
