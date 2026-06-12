import Link from "next/link";
import { getActiveOrg } from "@/lib/auth/active-org";
import { loadRestaurantsForOrg } from "@/lib/data/restaurants";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Plus, MapPin } from "lucide-react";

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
          <Button asChild>
            <Link href="/restaurants/new">
              <Plus className="h-4 w-4 mr-2" />
              Add restaurant
            </Link>
          </Button>
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
            <Button asChild className="mt-4">
              <Link href="/restaurants/new">
                <Plus className="h-4 w-4 mr-2" />
                Add restaurant
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((r) => (
            <Link key={r.id} href={`/restaurants/${r.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base font-semibold">{r.name}</CardTitle>
                    <Badge variant={r.status === "active" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {(r.city || r.street) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[r.street, r.city, r.province].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Slug: /m/{r.slug}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
