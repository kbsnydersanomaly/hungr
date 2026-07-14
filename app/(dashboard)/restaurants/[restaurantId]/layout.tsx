import { notFound } from "next/navigation";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { ForbiddenError } from "@/lib/errors";
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

  // Authenticated but not assigned (e.g. restaurant-scoped staff opening a
  // different restaurant by URL) gets a 404 rather than a 500 error boundary.
  try {
    await requireRestaurantAccess(restaurantId, "staff");
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    throw err;
  }

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
