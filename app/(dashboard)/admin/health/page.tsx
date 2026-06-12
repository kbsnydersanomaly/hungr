import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/PageHeader";
import { rel, type OrgRef } from "@/lib/types/relations";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Database,
  CreditCard,
  AlertTriangle,
  Activity,
  Webhook,
  Inbox,
  Clock,
  Server,
  GitBranch,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function loadHealth() {
  const supabase = createAdminClient();

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const dbStart = Date.now();
  const dbCheck = await supabase
    .from("organizations")
    .select("id", { count: "exact", head: true });
  const dbLatencyMs = Date.now() - dbStart;

  const [
    userStats,
    orgStats,
    restaurantStats,
    subscriptionStats,
    transactionStats,
    recentErrors,
    webhookStats,
    pendingReviews,
    staleFailedPayments,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("restaurants").select("*", { count: "exact", head: true }),
    supabase
      .from("subscriptions")
      .select("status")
      .in("status", ["active", "pending", "paused", "failed", "cancelled"]),
    supabase
      .from("transactions")
      .select("amount_gross_cents, payment_status")
      .gte("occurred_at", thirtyDaysAgo),
    supabase
      .from("transactions")
      .select("*, organizations(name)")
      .eq("payment_status", "FAILED")
      .order("occurred_at", { ascending: false })
      .limit(5),
    supabase
      .from("audit_logs")
      .select("action, created_at")
      .eq("action", "payfast_webhook")
      .gte("created_at", oneDayAgo),
    supabase
      .from("reviews")
      .select("*", { count: "exact", head: true })
      .is("moderated_at", null),
    supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "FAILED")
      .lt("occurred_at", sevenDaysAgo),
  ]);

  return {
    dbLatencyMs,
    dbHealthy: !dbCheck.error,
    userStats,
    orgStats,
    restaurantStats,
    subscriptionStats,
    transactionStats,
    recentErrors,
    webhookStats,
    pendingReviews,
    staleFailedPayments,
  };
}

export default async function HealthDashboardPage() {
  const {
    dbLatencyMs,
    dbHealthy,
    userStats,
    orgStats,
    restaurantStats,
    subscriptionStats,
    transactionStats,
    recentErrors,
    webhookStats,
    pendingReviews,
    staleFailedPayments,
  } = await loadHealth();

  const subsByStatus = (subscriptionStats.data ?? []).reduce(
    (acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const monthlyRevenue =
    (transactionStats.data ?? [])
      .filter((t) => t.payment_status === "COMPLETE")
      .reduce((sum, t) => sum + (t.amount_gross_cents ?? 0), 0) / 100;

  const monthlyFailures = (transactionStats.data ?? []).filter(
    (t) => t.payment_status === "FAILED"
  ).length;

  const webhookCount = webhookStats.data?.length ?? 0;
  const webhookHealthy = webhookCount > 0;

  const appVersion = process.env.npm_package_version ?? "0.1.0";
  const nodeVersion = process.version;
  const gitCommit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.GIT_COMMIT?.slice(0, 7) ?? "dev";

  return (
    <div className="space-y-6">
      <PageHeader title="Health" description="System health and operational metrics" />

      {/* System Status */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Database
                </p>
                <p className="text-lg font-semibold mt-1 flex items-center gap-1.5">
                  {dbHealthy ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Healthy
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      Error
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dbLatencyMs}ms latency
                </p>
              </div>
              <Database className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Webhooks
                </p>
                <p className="text-lg font-semibold mt-1 flex items-center gap-1.5">
                  {webhookHealthy ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Receiving
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Quiet
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {webhookCount} in 24h
                </p>
              </div>
              <Webhook className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Active subscriptions
                </p>
                <p className="text-2xl font-bold mt-1">
                  {subsByStatus["active"] ?? 0}
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Revenue (30d)
                </p>
                <p className="text-2xl font-bold mt-1">
                  R {monthlyRevenue.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Queue Depth */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Queue depth
            </CardTitle>
            <CardDescription>Items requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pending reviews</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {pendingReviews.count ?? 0}
                  </span>
                  {(pendingReviews.count ?? 0) > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Awaiting
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Stale failed payments</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${(staleFailedPayments.count ?? 0) > 0 ? "text-red-500" : ""}`}>
                    {staleFailedPayments.count ?? 0}
                  </span>
                  {(staleFailedPayments.count ?? 0) > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {">7 days"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Failed payments (30d)</span>
                <span className={`text-sm font-medium ${monthlyFailures > 0 ? "text-red-500" : ""}`}>
                  {monthlyFailures}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Subscriptions</CardTitle>
            <CardDescription>By status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(subsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        status === "active"
                          ? "default"
                          : status === "failed"
                          ? "destructive"
                          : "outline"
                      }
                    >
                      {status}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium">{count}</span>
                </div>
              ))}
              {Object.keys(subsByStatus).length === 0 && (
                <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Platform stats */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Platform</CardTitle>
            <CardDescription>High-level metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Organizations</span>
                <span className="text-sm font-medium">
                  {orgStats.count?.toLocaleString() ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Restaurants</span>
                <span className="text-sm font-medium">
                  {restaurantStats.count?.toLocaleString() ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Users</span>
                <span className="text-sm font-medium">
                  {userStats.count?.toLocaleString() ?? "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environment */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Server className="h-4 w-4" />
            Environment
          </CardTitle>
          <CardDescription>Runtime and deployment info</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">App version</p>
                <p className="text-sm font-medium font-mono">{appVersion}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Node.js</p>
                <p className="text-sm font-medium font-mono">{nodeVersion}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Commit</p>
                <p className="text-sm font-medium font-mono">{gitCommit}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent failures */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Recent failures</CardTitle>
          <CardDescription>Latest failed payment attempts</CardDescription>
        </CardHeader>
        <CardContent>
          {recentErrors.data && recentErrors.data.length > 0 ? (
            <div className="divide-y">
              {recentErrors.data.map((tx) => {
                const org = rel<OrgRef>(tx.organizations);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        {org?.name ?? "Unknown org"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {tx.payfast_payment_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        R {((tx.amount_gross_cents ?? 0) / 100).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.occurred_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No recent failures. 🎉</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
