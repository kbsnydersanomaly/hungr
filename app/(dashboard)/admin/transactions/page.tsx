import { listTransactions } from "@/lib/data/admin-actions";
import { AdminListLayout } from "@/components/admin/AdminListLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { StatusFilter } from "@/components/admin/StatusFilter";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatZar } from "@/lib/utils/money";
import { Building2, Calendar, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { rel, type OrgRef, type RestaurantRef } from "@/lib/types/relations";

const STATUS_OPTIONS = [
  { value: "COMPLETE", label: "Complete" },
  { value: "FAILED", label: "Failed" },
  { value: "PENDING", label: "Pending" },
];

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const { data: txs, total, page, pageSize, totalPages } = await listTransactions(sp);

  return (
    <AdminListLayout
      title="Transactions"
      total={total}
      searchPlaceholder="Search by payment ID or org..."
      extraFilters={
        <>
          <StatusFilter options={STATUS_OPTIONS} placeholder="Filter by status" />
          <DateRangeFilter />
        </>
      }
    >
      {txs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No transactions found.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {txs.map((tx) => {
              const org = rel<OrgRef>(tx.organizations);
              const restaurant = rel<RestaurantRef>(tx.restaurants);

              return (
                <Link key={tx.id} href={`/admin/transactions/${tx.id}`} className="block">
                  <Card>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {tx.payment_status === "COMPLETE" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : tx.payment_status === "FAILED" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : null}
                            <h3 className="font-semibold text-sm">
                              {tx.payment_status === "COMPLETE"
                                ? "Payment received"
                                : tx.payment_status}
                            </h3>
                            <Badge variant="outline" className="text-xs font-mono">
                              {tx.payfast_payment_id}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap gap-3 mt-2">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="h-3 w-3" />
                              {org?.name ?? "Unknown org"}
                              {restaurant?.name && ` · ${restaurant.name}`}
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {new Date(tx.occurred_at).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium">
                            {formatZar(tx.amount_gross_cents)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Fee: {formatZar(tx.amount_fee_cents)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
          <AdminPagination page={page} pageSize={pageSize} totalPages={totalPages} total={total} />
        </>
      )}
    </AdminListLayout>
  );
}
