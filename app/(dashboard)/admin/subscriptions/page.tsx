import { listSubscriptions, updateSubscriptionStatus } from "@/lib/data/admin-actions";
import { PageHeader } from "@/components/PageHeader";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatZar } from "@/lib/utils/money";
import { Building2, CreditCard, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";
import { rel, type OrgRef, type PlanRef } from "@/lib/types/relations";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const search = typeof sp?.search === "string" ? sp.search : undefined;

  const subs = await listSubscriptions(search);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description={`${subs.length} total subscriptions`}
      />

      {subs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No subscriptions found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {subs.map((sub) => {
            const org = rel<OrgRef>(sub.organizations);
            const plan = rel<PlanRef>(sub.plans);

            return (
              <Card key={sub.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">
                          {plan?.name ?? "Unknown plan"}
                        </h3>
                        <Badge
                          variant={
                            sub.status === "active"
                              ? "default"
                              : sub.status === "paused"
                              ? "secondary"
                              : sub.status === "pending"
                              ? "outline"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {sub.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {sub.scope}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          {org?.name ?? "Unknown org"}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <CreditCard className="h-3 w-3" />
                          {formatZar(sub.amount_cents)} / {sub.billing_period}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Next:{" "}
                          {sub.next_billing_date
                            ? new Date(sub.next_billing_date).toLocaleDateString()
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/admin/subscriptions/${sub.id}`}>
                          Edit
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                      {sub.status !== "active" && (
                        <ServerActionForm
                          action={async () => {
                            "use server";
                            return updateSubscriptionStatus(sub.id, "active");
                          }}
                          successMessage="Subscription marked active."
                        >
                          {() => (
                            <SubmitButton type="submit" size="sm" variant="outline">
                              Force active
                            </SubmitButton>
                          )}
                        </ServerActionForm>
                      )}
                      {sub.status === "active" && (
                        <ServerActionForm
                          action={async () => {
                            "use server";
                            return updateSubscriptionStatus(sub.id, "paused");
                          }}
                          successMessage="Subscription paused."
                        >
                          {() => (
                            <SubmitButton type="submit" size="sm" variant="outline">
                              Force pause
                            </SubmitButton>
                          )}
                        </ServerActionForm>
                      )}
                    </div>
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
