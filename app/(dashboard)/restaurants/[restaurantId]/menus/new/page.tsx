import Link from "next/link";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { requireRestaurantManagement } from "@/lib/billing/management-guard";
import { PageHeader } from "@/components/PageHeader";
import { CreateMenuForm } from "@/components/menu/CreateMenuForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default async function NewMenuPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await loadRestaurantById(restaurantId);
  await requireRestaurantManagement(restaurant);

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
          <CreateMenuForm restaurantId={restaurantId} />
        </CardContent>
      </Card>
    </div>
  );
}
