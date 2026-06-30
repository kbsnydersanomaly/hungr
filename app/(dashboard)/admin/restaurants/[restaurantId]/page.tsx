import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getRestaurant,
  getRestaurantStorageUsageAdmin,
} from "@/lib/data/admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Building2 } from "lucide-react";
import { formatBytes } from "@/lib/utils/bytes";
import { rel, type OrgRef } from "@/lib/types/relations";
import { RestaurantStorageEditDialog } from "@/components/admin/RestaurantStorageEditDialog";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantDetailPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;

  let restaurant;
  let usage;
  try {
    restaurant = await getRestaurant(restaurantId);
    usage = await getRestaurantStorageUsageAdmin(restaurantId);
  } catch {
    notFound();
  }

  const org = rel<OrgRef>(restaurant.organizations);
  const usagePct =
    usage.limitBytes > 0
      ? Math.min((usage.usedBytes / usage.limitBytes) * 100, 100)
      : 0;
  const remaining = Math.max(usage.limitBytes - usage.usedBytes, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/restaurants">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading">{restaurant.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{restaurant.slug}</Badge>
            {org && (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {org.name}
              </span>
            )}
          </div>
        </div>
        <RestaurantStorageEditDialog
          restaurantId={restaurant.id}
          storageLimitMb={restaurant.storage_limit_mb}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Media storage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatBytes(usage.usedBytes)} of {formatBytes(usage.limitBytes)} used
            </span>
            <span className="text-muted-foreground">{formatBytes(remaining)} left</span>
          </div>
          <Progress value={usagePct} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Limit: {restaurant.storage_limit_mb} MB
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
