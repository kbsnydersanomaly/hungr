import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MenuCard } from "@/components/menu/MenuCard";
import { Plus, UtensilsCrossed } from "lucide-react";

export default async function MenusPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await loadRestaurantById(restaurantId);

  const supabase = await createServerClient();
  const { data: menus } = await supabase
    .from("menus")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menus"
        description={`Menus for ${restaurant.name}`}
        action={
          <Button asChild>
            <Link href={`/restaurants/${restaurantId}/menus/new`}>
              <Plus className="h-4 w-4 mr-2" />
              New menu
            </Link>
          </Button>
        }
      />

      {menus && menus.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menus.map((menu) => (
            <MenuCard key={menu.id} menu={menu} restaurantId={restaurantId} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No menus yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first menu for this restaurant.
            </p>
            <Button asChild className="mt-4">
              <Link href={`/restaurants/${restaurantId}/menus/new`}>
                <Plus className="h-4 w-4 mr-2" />
                New menu
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
