import { notFound } from "next/navigation";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { requireRestaurantManagement } from "@/lib/billing/management-guard";
import { listMediaForRestaurant, getRestaurantStorageUsage } from "@/lib/data/media-actions";
import { PageHeader } from "@/components/PageHeader";
import { MediaLibrary } from "@/components/dashboard/MediaLibrary";
import { DesktopOnlyPage } from "@/components/dashboard/DesktopOnlyPage";

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
  await requireRestaurantManagement(restaurant);

  const [media, usage] = await Promise.all([
    listMediaForRestaurant(restaurantId),
    getRestaurantStorageUsage(restaurantId),
  ]);

  return (
    <DesktopOnlyPage
      title="Media Library"
      mobileExtra={
        <div className="mt-4 space-y-4">
          <MediaLibrary
            restaurantId={restaurantId}
            media={media}
            usedBytes={usage.usedBytes}
            limitBytes={usage.limitBytes}
            showUpload={false}
            readOnly
          />
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="Media Library"
          description={`Manage images for ${restaurant.name}`}
        />
        <MediaLibrary
          restaurantId={restaurantId}
          media={media}
          usedBytes={usage.usedBytes}
          limitBytes={usage.limitBytes}
        />
      </div>
    </DesktopOnlyPage>
  );
}
