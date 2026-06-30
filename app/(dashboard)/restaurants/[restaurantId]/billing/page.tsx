import { notFound, redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth/active-org";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { loadSubscriptionForRestaurant } from "@/lib/data/billing-actions";
import {
  loadTransactionsPageForRestaurant,
  parseTransactionFilters,
} from "@/lib/data/transactions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZar } from "@/lib/utils/money";
import { CreditCard, Calendar, Lock } from "lucide-react";
import { SubscriptionActions } from "@/components/dashboard/SubscriptionActions";
import { PaymentStatusBanner } from "@/components/dashboard/PaymentStatusBanner";
import { TransactionHistoryCard } from "@/components/dashboard/TransactionHistoryCard";

export const dynamic = "force-dynamic";

export default async function RestaurantBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { restaurantId } = await params;

  // Billing is owner/admin only.
  const activeOrg = await getActiveOrg();
  const canManage =
    activeOrg?.role === "owner" || activeOrg?.role === "admin";
  if (!canManage) {
    redirect(`/restaurants/${restaurantId}`);
  }

  const sp = await searchParams;
  const status = sp?.status;
  const blocked = sp?.blocked === "1";
  const filters = parseTransactionFilters(sp);

  let restaurant;
  try {
    restaurant = await loadRestaurantById(restaurantId);
  } catch {
    notFound();
  }

  const [subscription, transactionsPage] = await Promise.all([
    loadSubscriptionForRestaurant(restaurantId).catch(() => null),
    loadTransactionsPageForRestaurant(restaurantId, filters).catch(() => ({
      transactions: [],
      total: 0,
    })),
  ]);

  const plan = subscription?.plans as {
    name: string;
    slug: string;
    pricing_model: string;
  } | null;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Billing"
        description={`Manage subscription for ${restaurant.name}`}
      />

      <PaymentStatusBanner
        status={status}
        cancelMessage="Payment was cancelled. You can try again below."
      />

      {blocked && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Menu and content management is locked until this restaurant has an
              active subscription. Complete or resume payment below to unlock it.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="font-heading">Subscription</CardTitle>
              <CardDescription>
                {plan?.name ?? "Starter"} plan
              </CardDescription>
            </div>
            <Badge
              variant={
                subscription?.status === "active"
                  ? "default"
                  : subscription?.status === "paused"
                  ? "secondary"
                  : subscription?.status === "pending"
                  ? "outline"
                  : "destructive"
              }
            >
              {subscription?.status ?? "No subscription"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Amount
                  </p>
                  <p className="text-lg font-semibold mt-1">
                    {formatZar(subscription.amount_cents)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {subscription.billing_period}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Next billing
                  </p>
                  <p className="text-sm font-medium mt-1 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    {subscription.next_billing_date
                      ? new Date(subscription.next_billing_date).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Started
                  </p>
                  <p className="text-sm font-medium mt-1">
                    {subscription.started_at
                      ? new Date(subscription.started_at).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>

              <SubscriptionActions
                subscriptionId={subscription.id}
                status={subscription.status}
                payfastToken={subscription.payfast_token}
              />
            </>
          ) : (
            <div className="text-center py-6">
              <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No active subscription for this restaurant.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <TransactionHistoryCard
        description="Payments for this restaurant"
        basePath={`/restaurants/${restaurantId}/billing`}
        filters={filters}
        transactions={transactionsPage.transactions}
        total={transactionsPage.total}
      />
    </div>
  );
}
