import { listPlans } from "@/lib/data/admin-actions";
import { PlanDialog } from "@/components/dashboard/PlanDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZar } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const plans = await listPlans();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-heading">Plans</h2>
        <PlanDialog />
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No plans found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm">{plan.name}</h3>
                      <Badge variant={plan.active ? "default" : "secondary"}>
                        {plan.active ? "Active" : "Inactive"}
                      </Badge>
                      {plan.is_public && (
                        <Badge variant="outline">Public</Badge>
                      )}
                      {plan.contact_only && (
                        <Badge variant="outline">Contact only</Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.slug} · {plan.pricing_model}
                    </p>

                    {plan.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {plan.description}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3 mt-3">
                      <span className="text-xs font-medium">
                        {formatZar(plan.base_price_cents)} / month
                      </span>
                      {plan.additional_discount_pct > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {plan.additional_discount_pct}% discount on additional
                        </span>
                      )}
                      {plan.max_restaurants && (
                        <span className="text-xs text-muted-foreground">
                          Max {plan.max_restaurants} restaurants
                        </span>
                      )}
                    </div>
                  </div>

                  <PlanDialog plan={plan} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
