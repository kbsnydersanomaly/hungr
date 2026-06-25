import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrganization, getOrganizationMetrics } from "@/lib/data/admin-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, CreditCard, UtensilsCrossed } from "lucide-react";
import { formatZar } from "@/lib/utils/money";
import { rel, type ProfileRef, type PlanRef } from "@/lib/types/relations";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  let org;
  let metrics;
  try {
    org = await getOrganization(orgId);
    metrics = await getOrganizationMetrics(orgId).catch(() => null);
  } catch {
    notFound();
  }

  const owner = rel<ProfileRef>(org.profiles);
  const plan = rel<PlanRef>(org.plans);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/orgs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading">{org.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline">{org.slug}</Badge>
            {plan && <Badge variant="secondary">{plan.name}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard?org=${org.slug}`}>View as org</Link>
          </Button>
          {/* Edit/Delete actions added in Task 4.3 */}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Restaurants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <UtensilsCrossed className="h-5 w-5 text-muted-foreground" />
              {metrics?.restaurantCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Users className="h-5 w-5 text-muted-foreground" />
              {metrics?.memberCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              {metrics?.subscriptionCount ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lifetime Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatZar(metrics?.lifetimeSpend ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Owner</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{owner?.display_name || owner?.email || "Unknown"}</p>
          <p className="text-xs text-muted-foreground">{owner?.email}</p>
        </CardContent>
      </Card>
    </div>
  );
}
