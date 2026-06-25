import { notFound, redirect } from "next/navigation";
import { getSubscription, updateSubscription, listTransactionsForSubscription } from "@/lib/data/admin-actions";
import { PageHeader } from "@/components/PageHeader";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatZar } from "@/lib/utils/money";
import {
  Building2,
  CreditCard,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { rel, type OrgRef, type PlanRef } from "@/lib/types/relations";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let sub;
  try {
    sub = await getSubscription(id);
  } catch {
    notFound();
  }

  const transactions = await listTransactionsForSubscription(id);

  const org = rel<OrgRef>(sub.organizations);
  const plan = rel<PlanRef>(sub.plans);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/subscriptions">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader
        title={plan?.name ?? "Subscription"}
        description={`${org?.name ?? "Unknown org"} · ${sub.scope} scope`}
      />

      {/* Status bar */}
      <div className="flex items-center gap-3">
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
          className="text-sm px-3 py-1"
        >
          {sub.status === "active" && <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
          {sub.status === "failed" && <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
          {sub.status === "cancelled" && <XCircle className="h-3.5 w-3.5 mr-1" />}
          {sub.status === "paused" && <Clock className="h-3.5 w-3.5 mr-1" />}
          {sub.status}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Created {new Date(sub.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Edit subscription</CardTitle>
            <CardDescription>
              Override subscription fields. Use with caution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServerActionForm
              action={async (formData: FormData) => {
                "use server";
                const result = await updateSubscription(id, formData);
                if (result.ok) redirect(`/admin/subscriptions/${id}`);
                return result;
              }}
              successMessage="Subscription updated."
            >
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      name="status"
                      defaultValue={sub.status}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="failed">Failed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount_cents">Amount (cents)</Label>
                    <Input
                      id="amount_cents"
                      name="amount_cents"
                      type="number"
                      defaultValue={sub.amount_cents}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="billing_period">Billing period</Label>
                    <select
                      id="billing_period"
                      name="billing_period"
                      defaultValue={sub.billing_period}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="next_billing_date">Next billing date</Label>
                    <Input
                      id="next_billing_date"
                      name="next_billing_date"
                      type="date"
                      defaultValue={
                        sub.next_billing_date
                          ? new Date(sub.next_billing_date).toISOString().split("T")[0]
                          : ""
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current_period_end">Current period end</Label>
                    <Input
                      id="current_period_end"
                      name="current_period_end"
                      type="date"
                      defaultValue={
                        sub.current_period_end
                          ? new Date(sub.current_period_end).toISOString().split("T")[0]
                          : ""
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payfast_token">PayFast token</Label>
                    <Input
                      id="payfast_token"
                      name="payfast_token"
                      defaultValue={sub.payfast_token ?? ""}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payfast_subscription_id">PayFast subscription ID</Label>
                    <Input
                      id="payfast_subscription_id"
                      name="payfast_subscription_id"
                      defaultValue={sub.payfast_subscription_id ?? ""}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <SubmitButton>Save changes</SubmitButton>
                </div>
              </div>
            </ServerActionForm>
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Details</CardTitle>
            <CardDescription>Read-only reference data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {org?.name ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plan</span>
                <span className="text-sm font-medium">{plan?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Scope</span>
                <Badge variant="outline" className="text-xs">{sub.scope}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatZar(sub.amount_cents)} / {sub.billing_period}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Next billing</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {sub.next_billing_date
                    ? new Date(sub.next_billing_date).toLocaleDateString()
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Started</span>
                <span className="text-sm font-medium">
                  {sub.started_at
                    ? new Date(sub.started_at).toLocaleDateString()
                    : "—"}
                </span>
              </div>
              {sub.cancelled_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Cancelled</span>
                  <span className="text-sm font-medium text-red-500">
                    {new Date(sub.cancelled_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              {sub.paused_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Paused</span>
                  <span className="text-sm font-medium text-amber-500">
                    {new Date(sub.paused_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Transaction history</CardTitle>
          <CardDescription>{transactions.length} transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="divide-y">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {tx.payment_status === "COMPLETE" ? (
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          Payment received
                        </span>
                      ) : tx.payment_status === "FAILED" ? (
                        <span className="flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Payment failed
                        </span>
                      ) : (
                        tx.payment_status
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {tx.payfast_payment_id ?? tx.m_payment_id ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatZar(tx.amount_gross_cents)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.occurred_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No transactions yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
