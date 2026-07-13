import { getActiveOrg } from "@/lib/auth/active-org";
import { loadRestaurantsForOrg } from "@/lib/data/restaurants";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/ui/link-button";
import { RestaurantCard } from "@/components/dashboard/RestaurantCard";
import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed, Plus } from "lucide-react";

export default async function RestaurantsPage() {
  const org = await getActiveOrg();
  const orgId = org?.orgId;
  const restaurants = orgId ? await loadRestaurantsForOrg(orgId) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurants"
        description="Manage your restaurant locations"
        action={
          <LinkButton href="/restaurants/new" icon={<Plus />}>
            Add restaurant
          </LinkButton>
        }
      />

      {restaurants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No restaurants yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first restaurant to get started.
            </p>
            <LinkButton href="/restaurants/new" icon={<Plus />} className="mt-4">
              Add restaurant
            </LinkButton>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      )}
    </div>
  );
}
