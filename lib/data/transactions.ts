import { requireOrgAccess, requireRestaurantAccess } from "@/lib/auth/role";
import { actionError } from "@/lib/errors";
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
  // Whitelist real payment statuses — the billing page also uses ?status= for
  // checkout-return banners (complete / cancel / card-updated), which must not
  // leak into the transaction filter. The filter UI writes uppercase enum
  // values; the banner params are lowercase, so exact matching separates them.
  const status = str(sp.status);
  return {
    page,
    pageSize: 10,
    q: str(sp.q),
    status: ["COMPLETE", "FAILED", "PENDING", "CANCELLED"].includes(status ?? "")
      ? status
      : undefined,
    from: str(sp.from),
    to: str(sp.to),
  };
}

function escapeForOr(value: string): string {
  // Commas/parens would break PostgREST's .or() syntax; ilike wildcards are fine.
  return value.replace(/[(),]/g, " ").trim();
}

type InvoiceMatchRow = {
  id: string;
  number: string;
  // Null once delete_restaurant_cascade severs the invoice → subscription
  // link; such invoices can't be matched to a transaction and are skipped.
  subscription_id: string | null;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  created_at: string;
};

/** Match invoices to transactions (no direct FK — use period, then paid_at proximity). */
export function attachInvoicesToTransactions(
  transactions: TransactionRow[],
  invoices: InvoiceMatchRow[]
): TransactionWithInvoice[] {
  const invoicesBySub = new Map<string, InvoiceMatchRow[]>();
  for (const inv of invoices) {
    if (!inv.subscription_id) continue;
    const list = invoicesBySub.get(inv.subscription_id) ?? [];
    list.push(inv);
    invoicesBySub.set(inv.subscription_id, list);
  }

  const usedInvoiceIds = new Set<string>();

  return transactions.map((tx) => {
    if (!tx.subscription_id) return { ...tx, invoice: null };

    const candidates = (invoicesBySub.get(tx.subscription_id) ?? []).filter(
      (inv) => !usedInvoiceIds.has(inv.id)
    );
    if (candidates.length === 0) return { ...tx, invoice: null };

    const occurred = new Date(tx.occurred_at).getTime();

    const periodMatch = candidates.find(
      (inv) =>
        occurred >= new Date(inv.period_start).getTime() &&
        occurred <= new Date(inv.period_end).getTime()
    );
    if (periodMatch) {
      usedInvoiceIds.add(periodMatch.id);
      return {
        ...tx,
        invoice: { id: periodMatch.id, number: periodMatch.number },
      };
    }

    let best: InvoiceMatchRow | null = null;
    let bestDelta = Infinity;
    for (const inv of candidates) {
      const invTime = new Date(inv.paid_at ?? inv.created_at).getTime();
      const delta = Math.abs(invTime - occurred);
      if (delta < bestDelta && delta <= 48 * 60 * 60 * 1000) {
        bestDelta = delta;
        best = inv;
      }
    }

    if (best) {
      usedInvoiceIds.add(best.id);
      return { ...tx, invoice: { id: best.id, number: best.number } };
    }

    return { ...tx, invoice: null };
  });
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
    throw actionError("Failed to load transactions", error);
  }

  const transactions = data ?? [];

  // Attach the invoice generated for each payment (matched by subscription
  // and billing period — invoices have no direct transaction reference).
  const subscriptionIds = [
    ...new Set(transactions.map((t) => t.subscription_id).filter(Boolean)),
  ] as string[];

  let invoices: InvoiceMatchRow[] = [];

  if (subscriptionIds.length > 0) {
    const { data: invoiceRows } = await supabase
      .from("invoices")
      .select("id, number, subscription_id, period_start, period_end, paid_at, created_at")
      .in("subscription_id", subscriptionIds);
    invoices = invoiceRows ?? [];
  }

  return {
    transactions: attachInvoicesToTransactions(transactions, invoices),
    total: count ?? 0,
  };
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
