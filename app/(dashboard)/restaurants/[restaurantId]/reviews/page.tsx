import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { PageHeader } from "@/components/PageHeader";
import { ReviewTable } from "./review-table";

export const dynamic = "force-dynamic";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  await requireRestaurantAccess(restaurantId, "manager");

  const supabase = await createServerClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .single();

  if (!restaurant) notFound();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*, menu_items(name)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description={`Moderate customer reviews for ${restaurant.name}`}
      />
      <ReviewTable reviews={reviews ?? []} restaurantId={restaurantId} />
    </div>
  );
}
