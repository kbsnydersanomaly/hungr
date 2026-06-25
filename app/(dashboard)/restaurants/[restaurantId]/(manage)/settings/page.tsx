import { notFound, redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth/active-org";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { updateRestaurantSettings } from "@/lib/data/restaurant-settings-actions";
import { PageHeader } from "@/components/PageHeader";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;

  // Restaurant settings are owner/admin only.
  const activeOrg = await getActiveOrg();
  if (activeOrg?.role !== "owner" && activeOrg?.role !== "admin") {
    redirect(`/restaurants/${restaurantId}`);
  }

  let restaurant;
  try {
    restaurant = await loadRestaurantById(restaurantId);
  } catch {
    notFound();
  }

  const updateAction = updateRestaurantSettings.bind(null, restaurantId);

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader title="Settings" description="Restaurant settings" />
      <Card>
        <CardContent className="space-y-4">
          <ServerActionForm
            action={updateAction}
            successMessage="Restaurant settings updated."
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Restaurant name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={restaurant.name}
                  placeholder="e.g. Acme Cafe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Street address</Label>
                <Input
                  id="street"
                  name="street"
                  defaultValue={restaurant.street ?? ""}
                  placeholder="123 Main St"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={restaurant.city ?? ""}
                    placeholder="Cape Town"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">Province</Label>
                  <Input
                    id="province"
                    name="province"
                    defaultValue={restaurant.province ?? ""}
                    placeholder="Western Cape"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">Postal code</Label>
                <Input
                  id="zip"
                  name="zip"
                  defaultValue={restaurant.zip ?? ""}
                  placeholder="8001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table_count">Table count</Label>
                <Input
                  id="table_count"
                  name="table_count"
                  type="number"
                  min={0}
                  defaultValue={restaurant.table_count ?? 0}
                />
              </div>
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </ServerActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
