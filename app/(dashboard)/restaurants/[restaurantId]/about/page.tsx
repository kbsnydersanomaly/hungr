import { notFound } from "next/navigation";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { requireRestaurantManagement } from "@/lib/billing/management-guard";
import { loadAboutPage } from "@/lib/data/about-actions";
import { PageHeader } from "@/components/PageHeader";
import { AboutEditor } from "@/components/dashboard/AboutEditor";

export default async function AboutPage({
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

  const about = await loadAboutPage(restaurantId);

  return (
    <div className="h-[calc(100vh-140px)] space-y-6">
      <PageHeader
        title="About Page"
        description={`Edit the about page for ${restaurant.name}`}
      />
      <AboutEditor
        restaurantId={restaurantId}
        restaurantSlug={restaurant.slug}
        about={about}
      />
    </div>
  );
}
