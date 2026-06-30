import Link from "next/link";
import { listOrganizations, getOrganizationMetrics } from "@/lib/data/admin-actions";
import { AdminListLayout } from "@/components/admin/AdminListLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatZar } from "@/lib/utils/money";
import { Users, UtensilsCrossed, CreditCard, ArrowRight } from "lucide-react";
import { rel, type ProfileRef } from "@/lib/types/relations";

export const dynamic = "force-dynamic";

export default async function AdminOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const { data: orgs, total, page, pageSize, totalPages } = await listOrganizations(sp);

  const metrics = await Promise.all(
    orgs.map((org) => getOrganizationMetrics(org.id).catch(() => null))
  );

  return (
    <AdminListLayout
      title="Organizations"
      total={total}
      searchPlaceholder="Search by name or slug..."
    >
      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No organizations found.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {orgs.map((org, i) => {
              const m = metrics[i];
              const owner = rel<ProfileRef>(org.profiles);

              return (
                <Card key={org.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{org.name}</h3>
                          <Badge variant="outline" className="text-xs">{org.slug}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Owner: {owner?.display_name || owner?.email || "Unknown"}
                        </p>
                        {m && (
                          <div className="flex flex-wrap gap-3 mt-3">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <UtensilsCrossed className="h-3 w-3" />
                              {m.restaurantCount} restaurants
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Users className="h-3 w-3" />
                              {m.memberCount} members
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <CreditCard className="h-3 w-3" />
                              {m.subscriptionCount} active subs
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              Lifetime: {formatZar(m.lifetimeSpend)}
                            </span>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="link" asChild>
                        <Link href={`/admin/orgs/${org.id}`}>
                          Details
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <AdminPagination page={page} pageSize={pageSize} totalPages={totalPages} total={total} />
        </>
      )}
    </AdminListLayout>
  );
}
