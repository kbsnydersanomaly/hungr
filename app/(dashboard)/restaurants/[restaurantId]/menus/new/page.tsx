import Link from "next/link";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { createMenu } from "@/lib/data/menu-actions";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default async function NewMenuPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await loadRestaurantById(restaurantId);

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="New menu"
        description={`Create a new menu for ${restaurant.name}`}
        action={
          <Button variant="ghost" asChild>
            <Link href={`/restaurants/${restaurantId}/menus`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              await createMenu(restaurantId, formData);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Menu name</Label>
              <Input id="name" name="name" placeholder="e.g. Lunch, Dinner, Brunch" required />
            </div>

            <Button type="submit" className="w-full">
              Create menu
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
