import { redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/auth/active-org";
import { loadOrgBillingSummary } from "@/lib/data/billing-actions";
import {
  loadTransactionsPageForOrg,
  parseTransactionFilters,
} from "@/lib/data/transactions";
import { TransactionHistoryCard } from "@/components/dashboard/TransactionHistoryCard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZar } from "@/lib/utils/money";
import { SubscriptionActions } from "@/components/dashboard/SubscriptionActions";
import { PaymentStatusBanner } from "@/components/dashboard/PaymentStatusBanner";
import { upgradeToProPlan } from "@/lib/data/plan-change-actions";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import {
  Building2,
  UtensilsCrossed,
  Calendar,
  ArrowUpRight,
  Lock,
} from "lucide-react";
import { rel, type PlanRef } from "@/lib/types/relations";

export const dynamic = "force-dynamic";

function SubscriptionRow({
  subscription,
  icon,
  label,
  showActions,
}: {
  subscription: {
    id: string;
    status: string;
    amount_cents: number;
    billing_period: string;
    next_billing_date: string | null;
    payfast_token: string | null;
  };
  icon: React.ReactNode;
  label: string;
  showActions: boolean;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{label}</span>
          <Badge
            variant={
              subscription.status === "active"
                ? "default"
                : subscription.status === "paused"
                ? "secondary"
                : subscription.status === "cancelled"
                ? "destructive"
                : "outline"
            }
          >
            {subscription.status}
          </Badge>
        </div>
        <span className="text-sm font-medium">
          {formatZar(subscription.amount_cents)} / {subscription.billing_period}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Next:{" "}
          {subscription.next_billing_date
            ? new Date(subscription.next_billing_date).toLocaleDateString()
            : "—"}
        </span>
      </div>
      {showActions && (
        <SubscriptionActions
          subscriptionId={subscription.id}
          status={subscription.status}
          payfastToken={subscription.payfast_token}
        />
      )}
    </div>
  );
}

export default async function OrgBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const activeOrg = await getActiveOrg();
  if (!activeOrg?.orgId) redirect("/dashboard");
  // Billing is owner/admin only.
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  const status = sp?.status;
  const reason = sp?.reason;
  const filters = parseTransactionFilters(sp);

  const isOwner = activeOrg.role === "owner";
  const canManage = isOwner || activeOrg.role === "admin";

  let summary;
  try {
    summary = await loadOrgBillingSummary(activeOrg.orgId);
  } catch {
    summary = { subscriptions: [], transactions: [], org: null };
  }

  const transactionsPage = await loadTransactionsPageForOrg(
    activeOrg.orgId,
    filters
  ).catch(() => ({ transactions: [], total: 0 }));

  const totalMonthly = summary.subscriptions.reduce(
    (sum, sub) => sum + (sub.status === "active" ? sub.amount_cents : 0),
    0
  );

  const orgSubscription = summary.subscriptions.find((s) => s.scope === "org");
  const restaurantSubscriptions = summary.subscriptions.filter(
    (s) => s.scope === "restaurant"
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Billing"
        description="Manage your organization plan and payments"
      />

      <PaymentStatusBanner status={status} />

      {reason === "subscription_required" && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Add restaurant is locked
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Your last payment failed. Retry checkout below before adding
                  another restaurant.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="font-heading">Plan summary</CardTitle>
              <CardDescription>
                {summary.org?.name ?? "Your organization"}
              </CardDescription>
            </div>
            <Badge variant="outline">
              {orgSubscription
                ? rel<PlanRef>(orgSubscription.plans)?.name ?? "Custom"
                : "Starter"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Total monthly bill
              </p>
              <p className="text-2xl font-bold mt-1">{formatZar(totalMonthly)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Active subscriptions
              </p>
              <p className="text-2xl font-bold mt-1">
                {summary.subscriptions.filter((s) => s.status === "active").length}
              </p>
            </div>
          </div>

          {/* Upgrade CTA */}
          {isOwner && !orgSubscription && restaurantSubscriptions.length > 0 && (
            <ServerActionForm
              action={async () => {
                "use server";
                return upgradeToProPlan(activeOrg.orgId);
              }}
              className="pt-2"
            >
              <div className="rounded-lg border border-dashed p-4 bg-muted/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Upgrade to Pro</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Flat fee for up to 10 restaurants. Cancel your per-restaurant
                      subscriptions and simplify billing.
                    </p>
                  </div>
                  <SubmitButton type="submit" size="sm">
                    <ArrowUpRight className="h-4 w-4 mr-2" />
                    Upgrade
                  </SubmitButton>
                </div>
              </div>
            </ServerActionForm>
          )}
        </CardContent>
      </Card>

      {/* Subscriptions */}
      {summary.subscriptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Subscriptions</CardTitle>
            <CardDescription>
              All recurring charges for your organization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orgSubscription && (
              <SubscriptionRow
                subscription={orgSubscription}
                icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
                label={rel<PlanRef>(orgSubscription.plans)?.name ?? "Org plan"}
                showActions={canManage}
              />
            )}

            {restaurantSubscriptions.map((sub) => (
              <SubscriptionRow
                key={sub.id}
                subscription={sub}
                icon={<UtensilsCrossed className="h-4 w-4 text-muted-foreground" />}
                label="Restaurant subscription"
                showActions={canManage}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <TransactionHistoryCard
        description="Payments across your organization"
        basePath="/settings/billing"
        filters={filters}
        transactions={transactionsPage.transactions}
        total={transactionsPage.total}
      />
    </div>
  );
}
