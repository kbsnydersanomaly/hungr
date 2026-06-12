import Link from "next/link";
import { listOrganizations, getOrganizationMetrics } from "@/lib/data/admin-actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const search = typeof sp?.search === "string" ? sp.search : undefined;

  const orgs = await listOrganizations(search);

  // Load metrics for each org
  const metrics = await Promise.all(
    orgs.map((org) => getOrganizationMetrics(org.id).catch(() => null))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-heading">Organizations</h2>
        <p className="text-sm text-muted-foreground">{orgs.length} total</p>
      </div>

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No organizations found.
          </CardContent>
        </Card>
      ) : (
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
                        <Badge variant="outline" className="text-xs">
                          {org.slug}
                        </Badge>
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

                    <Link
                      href={`/admin/orgs/${org.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
                    >
                      Details
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
