import { notFound } from "next/navigation";
import { listTransactions } from "@/lib/data/admin-actions";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatZar } from "@/lib/utils/money";
import { ArrowLeft, Building2, Calendar, CreditCard } from "lucide-react";
import Link from "next/link";
import { rel, type OrgRef, type RestaurantRef } from "@/lib/types/relations";

export const dynamic = "force-dynamic";

export default async function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: txs } = await listTransactions({ search: id, pageSize: "1" });
  const tx = txs[0];

  if (!tx) {
    notFound();
  }

  const org = rel<OrgRef>(tx.organizations);
  const restaurant = rel<RestaurantRef>(tx.restaurants);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/transactions">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
      </div>

      <PageHeader title="Transaction details" description={`ID: ${tx.id}`} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge
              variant={
                tx.payment_status === "COMPLETE"
                  ? "default"
                  : tx.payment_status === "FAILED"
                  ? "destructive"
                  : "outline"
              }
            >
              {tx.payment_status}
            </Badge>
            <div className="text-sm text-muted-foreground">
              Occurred on {new Date(tx.occurred_at).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Amounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross</span>
              <span className="font-medium">{formatZar(tx.amount_gross_cents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fee</span>
              <span className="font-medium">{formatZar(tx.amount_fee_cents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Net</span>
              <span className="font-medium">{formatZar(tx.amount_net_cents)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment IDs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">PayFast payment ID:</span>
              <span className="font-mono">{tx.payfast_payment_id}</span>
            </div>
            {tx.m_payment_id && (
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Merchant payment ID:</span>
                <span className="font-mono">{tx.m_payment_id}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Associated records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Organization:</span>
              <span>{org?.name ?? "Unknown org"}</span>
            </div>
            {restaurant?.name && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Restaurant:</span>
                <span>{restaurant.name}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
