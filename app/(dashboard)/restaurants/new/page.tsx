import Link from "next/link";
import { getActiveOrg } from "@/lib/auth/active-org";
import { getRestaurantBillingContext } from "@/lib/billing/pricing";
import { formatZar } from "@/lib/utils/money";
import { PageHeader } from "@/components/PageHeader";
import { NewRestaurantForm } from "@/components/forms/NewRestaurantForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CreditCard, Info } from "lucide-react";

// Plan names in the DB are inconsistent ("Starter", "Starterplan") — normalize
// to "<Name> Plan" for display.
function planDisplayName(name: string) {
  return `${name.replace(/\s*plan\s*$/i, "").trim()} Plan`;
}

export default async function NewRestaurantPage() {
  const org = await getActiveOrg();
  const orgId = org?.orgId;

  const billing = orgId ? await getRestaurantBillingContext(orgId) : null;

  return (
    <div className="space-y-6 max-w-xl">
      <PageHeader
        title="Add restaurant"
        description="Create a new restaurant location"
        action={
          <Button variant="ghost" asChild>
            <Link href="/restaurants">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        }
      />

      {/* States where the user can't create a restaurant yet — guide them
          instead of letting the form fail with a raw billing error. */}
      {(!billing || billing.state === "no_plan") && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-medium">Choose a plan to get started</h3>
                <p className="text-sm text-muted-foreground">
                  Each restaurant on Hungr runs on a monthly subscription. Pick a
                  plan first, then you can add your restaurant and activate it
                  through secure checkout.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/settings/billing">Manage billing</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {billing?.state === "custom" && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-medium">Enterprise plans are set up by our team</h3>
                <p className="text-sm text-muted-foreground">
                  Your organisation is on the {planDisplayName(billing.plan.name)}.
                  To add a restaurant, get in touch and we&apos;ll provision it
                  for you.
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <a href="mailto:hello@hungr.app?subject=Enterprise%20plan%20enquiry">
                Contact sales
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {billing?.state === "limit_reached" && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-medium">Plan limit reached</h3>
                <p className="text-sm text-muted-foreground">
                  Your {planDisplayName(billing.plan.name)} supports up to{" "}
                  {billing.maxRestaurants} restaurant
                  {billing.maxRestaurants === 1 ? "" : "s"}. Upgrade your plan to
                  add more.
                </p>
              </div>
            </div>
            <Button asChild>
              <Link href="/settings/billing">Manage billing</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {(billing?.state === "checkout" || billing?.state === "included") && (
        <>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  {billing.state === "included" ? (
                    <>
                      <p className="font-medium">
                        Covered by your {planDisplayName(billing.plan.name)}
                      </p>
                      <p className="text-muted-foreground">
                        This restaurant is included in your current subscription —
                        no extra charge.
                      </p>
                    </>
                  ) : billing.perRestaurant ? (
                    <>
                      <p className="font-medium">
                        A subscription is required for each restaurant
                      </p>
                      <p className="text-muted-foreground">
                        This restaurant is billed at{" "}
                        <span className="font-medium text-foreground">
                          {formatZar(billing.priceCents)}/month
                        </span>{" "}
                        on the {planDisplayName(billing.plan.name)}. After you
                        create it, you&apos;ll be taken to PayFast&apos;s secure
                        checkout to activate the subscription.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">
                        Start your {planDisplayName(billing.plan.name)} subscription
                      </p>
                      <p className="text-muted-foreground">
                        Your plan covers multiple restaurants for{" "}
                        <span className="font-medium text-foreground">
                          {formatZar(billing.priceCents)}/month
                        </span>
                        . After you create this restaurant, you&apos;ll be taken
                        to PayFast&apos;s secure checkout to activate the
                        subscription.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <NewRestaurantForm
                orgId={orgId}
                submitLabel={
                  billing.state === "included"
                    ? "Create restaurant"
                    : "Create & continue to checkout"
                }
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
