import { notFound } from "next/navigation";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { requireRestaurantManagement } from "@/lib/billing/management-guard";
import { loadBranding, loadBrandingDraft } from "@/lib/data/branding";
import { BrandingEditor } from "@/components/branding/BrandingEditor";
import { PageHeader } from "@/components/PageHeader";

export default async function BrandingPage({
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

  const [live, draft] = await Promise.all([
    loadBranding(restaurantId),
    loadBrandingDraft(restaurantId),
  ]);

  return (
    <div className="h-[calc(100vh-140px)]">
      <BrandingEditor
        restaurantId={restaurantId}
        restaurantSlug={restaurant.slug}
        live={live}
        draft={draft}
      >
        <PageHeader title="Branding" description="Customize your menu appearance" />
      </BrandingEditor>
    </div>
  );
}
