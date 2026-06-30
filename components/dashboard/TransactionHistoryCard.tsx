import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatZar } from "@/lib/utils/money";
import { TransactionFilters } from "./TransactionFilters";
import { InvoiceDownloadButton } from "./InvoiceDownloadButton";
import type {
  TransactionFilters as Filters,
  TransactionWithInvoice,
} from "@/lib/data/transactions";
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight } from "lucide-react";

interface TransactionHistoryCardProps {
  description: string;
  basePath: string;
  filters: Filters;
  transactions: TransactionWithInvoice[];
  total: number;
}

function StatusCell({ status }: { status: string }) {
  if (status === "COMPLETE") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        Completed
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <XCircle className="h-3.5 w-3.5 text-red-500" />
        Failed
      </span>
    );
  }
  return <span className="text-sm font-medium capitalize">{status.toLowerCase()}</span>;
}

export function TransactionHistoryCard({
  description,
  basePath,
  filters,
  transactions,
  total,
}: TransactionHistoryCardProps) {
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const hasFilters = !!(filters.q || filters.status || filters.from || filters.to);

  function pageHref(page: number): string {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Transaction history</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TransactionFilters />

        {transactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment ID</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(tx.occurred_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>
                    <StatusCell status={tx.payment_status} />
                  </TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs text-muted-foreground">
                    {tx.payfast_payment_id ?? tx.m_payment_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    {tx.invoice ? (
                      <InvoiceDownloadButton
                        invoiceId={tx.invoice.id}
                        invoiceNumber={tx.invoice.number}
                        variant="link"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatZar(tx.amount_gross_cents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {hasFilters
              ? "No transactions match your filters."
              : "No transactions yet."}
          </p>
        )}

        {total > filters.pageSize && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              Page {filters.page} of {totalPages} · {total} transaction
              {total === 1 ? "" : "s"}
            </span>
            <div className="flex gap-1">
              {filters.page > 1 ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(filters.page - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
              )}
              {filters.page < totalPages ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(filters.page + 1)}>
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button variant="outline" size="sm" disabled>
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
