import { createServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default async function PricingPage() {
  const supabase = await createServerClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .eq("is_public", true)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-5xl mx-auto py-24 px-6">
      <h1 className="text-3xl font-bold text-center font-heading">Pricing</h1>
      <p className="mt-2 text-center text-muted-foreground">
        Simple plans for every restaurant size.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans && plans.length > 0 ? (
          plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="font-heading">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="mb-4">
                  {plan.contact_only ? (
                    <p className="text-2xl font-bold">Contact us</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">
                        R {(plan.base_price_cents / 100).toLocaleString("en-ZA")}/mo
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {plan.pricing_model === "per_restaurant" && "Per restaurant"}
                        {plan.pricing_model === "flat_includes_n" && `Up to ${plan.included_restaurants} restaurants`}
                        {plan.pricing_model === "custom" && "Custom pricing"}
                      </p>
                    </>
                  )}
                </div>

                {plan.features && (
                  <ul className="space-y-2 text-sm mb-6 flex-1">
                    {Object.entries(plan.features as Record<string, unknown>).map(([key, value]) => (
                      <li key={key} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-accent shrink-0" />
                        <span className="capitalize">{key.replace(/_/g, " ")}</span>
                        {typeof value === "string" && (
                          <span className="text-muted-foreground">— {value}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                <Button className="w-full" variant={plan.contact_only ? "outline" : "default"} asChild>
                  <a href={plan.contact_only ? "/contact-sales" : "/sign-up"}>
                    {plan.contact_only ? "Contact sales" : "Get started"}
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center text-muted-foreground">
            No plans available.
          </div>
        )}
      </div>
    </div>
  );
}
