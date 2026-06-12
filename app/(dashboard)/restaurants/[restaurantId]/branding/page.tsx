import { notFound } from "next/navigation";
import { loadRestaurantById } from "@/lib/data/restaurants";
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

  const [live, draft] = await Promise.all([
    loadBranding(restaurantId),
    loadBrandingDraft(restaurantId),
  ]);

  return (
    <div className="space-y-4 h-[calc(100vh-140px)]">
      <PageHeader title="Branding" description="Customize your menu appearance" />
      <BrandingEditor
        restaurantId={restaurantId}
        restaurantSlug={restaurant.slug}
        live={live}
        draft={draft}
      />
    </div>
  );
}
