import { requireOrgAccess, requireRestaurantAccess } from "@/lib/auth/role";
import { ValidationError } from "@/lib/errors";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

export interface TransactionFilters {
  page: number;
  pageSize: number;
  /** Free-text match on PayFast payment id / merchant payment id. */
  q?: string;
  /** Exact payment_status filter (e.g. COMPLETE, FAILED). */
  status?: string;
  /** ISO date (yyyy-mm-dd) lower bound on occurred_at. */
  from?: string;
  /** ISO date (yyyy-mm-dd) upper bound on occurred_at. */
  to?: string;
}

export interface TransactionWithInvoice extends TransactionRow {
  invoice: { id: string; number: string } | null;
}

export interface TransactionsPage {
  transactions: TransactionWithInvoice[];
  total: number;
}

export function parseTransactionFilters(sp: {
  [key: string]: string | string[] | undefined;
}): TransactionFilters {
  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v.trim() ? v.trim() : undefined;
  const page = Math.max(1, parseInt(str(sp.page) ?? "1", 10) || 1);
  return {
    page,
    pageSize: 10,
    q: str(sp.q),
    status: str(sp.status),
    from: str(sp.from),
    to: str(sp.to),
  };
}

function escapeForOr(value: string): string {
  // Commas/parens would break PostgREST's .or() syntax; ilike wildcards are fine.
  return value.replace(/[(),]/g, " ").trim();
}

async function loadPage(
  supabase: SupabaseClient<Database>,
  scope: { column: "restaurant_id" | "org_id"; id: string },
  filters: TransactionFilters
): Promise<TransactionsPage> {
  const fromIdx = (filters.page - 1) * filters.pageSize;

  let query = supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq(scope.column, scope.id);

  if (filters.status) query = query.eq("payment_status", filters.status);
  if (filters.from) query = query.gte("occurred_at", filters.from);
  if (filters.to) query = query.lte("occurred_at", `${filters.to}T23:59:59.999Z`);
  if (filters.q) {
    const q = escapeForOr(filters.q);
    if (q) {
      query = query.or(
        `payfast_payment_id.ilike.%${q}%,m_payment_id.ilike.%${q}%`
      );
    }
  }

  const { data, count, error } = await query
    .order("occurred_at", { ascending: false })
    .range(fromIdx, fromIdx + filters.pageSize - 1);

  if (error) {
    console.error("loadTransactionsPage error:", error);
    throw new ValidationError("Failed to load transactions.");
  }

  const transactions = data ?? [];

  // Attach the invoice generated for each payment (matched by subscription
  // and billing period — invoices have no direct transaction reference).
  const subscriptionIds = [
    ...new Set(transactions.map((t) => t.subscription_id).filter(Boolean)),
  ] as string[];

  let invoices: {
    id: string;
    number: string;
    subscription_id: string;
    period_start: string;
    period_end: string;
  }[] = [];

  if (subscriptionIds.length > 0) {
    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id, number, subscription_id, period_start, period_end")
      .in("subscription_id", subscriptionIds);
    invoices = invoiceRows ?? [];
  }

  const withInvoices: TransactionWithInvoice[] = transactions.map((tx) => {
    const occurred = new Date(tx.occurred_at).getTime();
    const invoice =
      invoices.find(
        (inv) =>
          inv.subscription_id === tx.subscription_id &&
          occurred >= new Date(inv.period_start).getTime() &&
          occurred <= new Date(inv.period_end).getTime()
      ) ?? null;
    return {
      ...tx,
      invoice: invoice ? { id: invoice.id, number: invoice.number } : null,
    };
  });

  return { transactions: withInvoices, total: count ?? 0 };
}

export async function loadTransactionsPageForRestaurant(
  restaurantId: string,
  filters: TransactionFilters
): Promise<TransactionsPage> {
  const { supabase } = await requireRestaurantAccess(restaurantId, "staff");
  return loadPage(supabase, { column: "restaurant_id", id: restaurantId }, filters);
}

export async function loadTransactionsPageForOrg(
  orgId: string,
  filters: TransactionFilters
): Promise<TransactionsPage> {
  const { supabase } = await requireOrgAccess(orgId, "admin");
  return loadPage(supabase, { column: "org_id", id: orgId }, filters);
}
