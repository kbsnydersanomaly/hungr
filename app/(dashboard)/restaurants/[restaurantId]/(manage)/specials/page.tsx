import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { listSpecialsForRestaurant } from "@/lib/data/special-actions";
import { PageHeader } from "@/components/PageHeader";
import { SpecialsList } from "@/components/dashboard/SpecialsList";
import { SpecialEditor } from "@/components/dashboard/SpecialEditor";

export default async function SpecialsPage({
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

  const supabase = await createServerClient();

  const [{ data: menus }, specials] = await Promise.all([
    supabase
      .from("menus")
      .select("id, name")
      .eq("restaurant_id", restaurantId)
      .order("sort_order", { ascending: true }),
    listSpecialsForRestaurant(restaurantId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Specials"
        description={`Manage specials and promotions for ${restaurant.name}`}
        action={
          <SpecialEditor
            restaurantId={restaurantId}
            menus={menus ?? []}
          />
        }
      />
      <SpecialsList
        restaurantId={restaurantId}
        menus={menus ?? []}
        specials={specials}
      />
    </div>
  );
}
