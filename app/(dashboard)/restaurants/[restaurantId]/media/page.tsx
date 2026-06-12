import { notFound } from "next/navigation";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { listMediaForRestaurant } from "@/lib/data/media-actions";
import { PageHeader } from "@/components/PageHeader";
import { MediaLibrary } from "@/components/dashboard/MediaLibrary";

export default async function MediaPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;

  let restaurant;
  try {
    restaurant = await loadRestaurantById(restaurantId);
  } catch {
    notFound();
  }

  const media = await listMediaForRestaurant(restaurantId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Library"
        description={`Manage images for ${restaurant.name}`}
      />
      <MediaLibrary
        restaurantId={restaurantId}
        media={media}
      />
    </div>
  );
}
