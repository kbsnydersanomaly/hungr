import Link from "next/link";
import { listRestaurants } from "@/lib/data/admin-actions";
import { AdminListLayout } from "@/components/admin/AdminListLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Building2, HardDrive } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const { data: restaurants, total, page, pageSize, totalPages } =
    await listRestaurants(sp);

  return (
    <AdminListLayout
      title="Restaurants"
      total={total}
      searchPlaceholder="Search by name or slug..."
    >
      {restaurants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No restaurants found.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {restaurants.map((restaurant) => (
              <Card key={restaurant.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{restaurant.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {restaurant.slug}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-3">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {restaurant.organizations?.name ?? "—"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <HardDrive className="h-3 w-3" />
                          {restaurant.storage_limit_mb} MB limit
                        </span>
                      </div>
                    </div>
                    <Button size="sm" variant="link" asChild>
                      <Link href={`/admin/restaurants/${restaurant.id}`}>
                        Details
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <AdminPagination
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            total={total}
          />
        </>
      )}
    </AdminListLayout>
  );
}
