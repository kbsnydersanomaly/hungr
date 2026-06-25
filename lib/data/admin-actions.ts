"use server";

import { ValidationError, safeAction, NotFoundError } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/auth/role";
import type { Database, Json } from "@/lib/database.types";
import {
  paginatedQuery,
  parsePaginationParams,
  type PaginationResult,
} from "@/lib/data/admin-pagination";
import type { PostgrestFilterBuilder } from "@supabase/supabase-js";

type OrganizationListRow = Database["public"]["Tables"]["organizations"]["Row"] & {
  profiles: { email: string; display_name: string | null } | null;
};

type PlanInsert = Database["public"]["Tables"]["plans"]["Insert"];
type PlanUpdate = Database["public"]["Tables"]["plans"]["Update"];
type SubscriptionUpdate = Database["public"]["Tables"]["subscriptions"]["Update"];

function parsePlanForm(formData: FormData): Omit<PlanInsert, "slug"> & { slug?: string } {
  let features: Json = {};
  try {
    features = JSON.parse(String(formData.get("features") ?? "{}")) as Json;
  } catch {
    features = {};
  }

  return {
    slug: String(formData.get("slug") ?? "").trim() || undefined,
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    pricing_model: String(formData.get("pricing_model") ?? "") as PlanInsert["pricing_model"],
    base_price_cents: parseInt(String(formData.get("base_price_cents") ?? "0"), 10),
    additional_discount_pct: parseFloat(String(formData.get("additional_discount_pct") ?? "0")),
    included_restaurants: parseInt(String(formData.get("included_restaurants") ?? ""), 10) || null,
    max_restaurants: parseInt(String(formData.get("max_restaurants") ?? ""), 10) || null,
    features,
    contact_only: String(formData.get("contact_only")) === "on",
    is_public: String(formData.get("is_public")) !== "off",
    active: String(formData.get("active")) !== "off",
    sort_order: parseInt(String(formData.get("sort_order") ?? "0"), 10),
  };
}

export async function listOrganizations(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<OrganizationListRow>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;

  let query = supabase
    .from("organizations")
    .select("*, profiles!organizations_owner_id_fkey(email, display_name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  const typedQuery = query as unknown as PostgrestFilterBuilder<
    never,
    never,
    OrganizationListRow,
    OrganizationListRow[],
    unknown
  >;

  return paginatedQuery(typedQuery, { page, pageSize });
}

export async function getOrganizationMetrics(orgId: string) {
  const { supabase } = await requireSuperAdmin();

  const [
    { count: restaurantCount },
    { count: memberCount },
    { count: subscriptionCount },
    { data: transactions },
  ] = await Promise.all([
    supabase
      .from("restaurants")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId),
    supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("status", "active"),
    supabase
      .from("transactions")
      .select("amount_gross_cents")
      .eq("org_id", orgId)
      .eq("payment_status", "COMPLETE"),
  ]);

  const lifetimeSpend =
    transactions?.reduce((sum, t) => sum + (t.amount_gross_cents ?? 0), 0) ?? 0;

  return {
    restaurantCount: restaurantCount ?? 0,
    memberCount: memberCount ?? 0,
    subscriptionCount: subscriptionCount ?? 0,
    lifetimeSpend,
  };
}

export async function listPlans(
  searchParams: { [key: string]: string | string[] | undefined } = {}
): Promise<PaginationResult<Database["public"]["Tables"]["plans"]["Row"]>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;

  let query = supabase
    .from("plans")
    .select("*", { count: "exact" })
    .order("sort_order", { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
  }

  return paginatedQuery(query as unknown as PostgrestFilterBuilder<never, never, Database["public"]["Tables"]["plans"]["Row"], Database["public"]["Tables"]["plans"]["Row"][], unknown>, { page, pageSize });
}

export async function createPlan(formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();
    const fields = parsePlanForm(formData);

    if (!fields.slug) throw new ValidationError("Slug is required.");
    if (!fields.name) throw new ValidationError("Name is required.");
    if (!fields.pricing_model) throw new ValidationError("Pricing model is required.");

    const { error } = await supabase.from("plans").insert(fields as PlanInsert);

    if (error) {
      console.error("createPlan error:", error);
      throw new ValidationError("Failed to create plan.");
    }

    return { created: true };
  });
}

export async function updatePlan(planId: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();
    const fields = parsePlanForm(formData);

    if (!fields.name) throw new ValidationError("Name is required.");

    // Slug is immutable on update — drop it.
    const { slug, ...rest } = fields;
    void slug;
    const updates: PlanUpdate = {
      ...rest,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("plans").update(updates).eq("id", planId);

    if (error) {
      console.error("updatePlan error:", error);
      throw new ValidationError("Failed to update plan.");
    }

    return { updated: true };
  });
}

// ── Users ────────────────────────────────────────────────────────────────

export async function listUsers(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<Database["public"]["Tables"]["profiles"]["Row"]>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
  }

  return paginatedQuery(query as unknown as PostgrestFilterBuilder<never, never, Database["public"]["Tables"]["profiles"]["Row"], Database["public"]["Tables"]["profiles"]["Row"][], unknown>, { page, pageSize });
}

type SubscriptionListRow = Database["public"]["Tables"]["subscriptions"]["Row"] & {
  plans: Database["public"]["Tables"]["plans"]["Row"] | null;
  organizations: { name: string | null; slug: string | null } | null;
};

// ── Subscriptions ────────────────────────────────────────────────────────

export async function listSubscriptions(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<SubscriptionListRow>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;
  const status = typeof searchParams?.status === "string" ? searchParams.status : undefined;

  let query = supabase
    .from("subscriptions")
    .select("*, plans(*), organizations(name, slug)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `organizations.name.ilike.%${search}%,plans.name.ilike.%${search}%`
    );
  }

  if (status) {
    query = query.eq("status", status as Database["public"]["Enums"]["subscription_status"]);
  }

  return paginatedQuery(query as unknown as PostgrestFilterBuilder<never, never, SubscriptionListRow, SubscriptionListRow[], unknown>, { page, pageSize });
}

// ── Subscription overrides ───────────────────────────────────────────────

function applyStatusTimestamps(
  updates: SubscriptionUpdate,
  status: SubscriptionUpdate["status"]
): SubscriptionUpdate {
  if (status === "cancelled") {
    updates.cancelled_at = new Date().toISOString();
  } else if (status === "paused") {
    updates.paused_at = new Date().toISOString();
  } else if (status === "active") {
    updates.paused_at = null;
    updates.cancelled_at = null;
  }
  return updates;
}

export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: "active" | "paused" | "cancelled" | "failed"
) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const updates = applyStatusTimestamps(
      { status, updated_at: new Date().toISOString() },
      status
    );

    const { error } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("id", subscriptionId);

    if (error) {
      console.error("updateSubscriptionStatus error:", error);
      throw new ValidationError("Failed to update subscription.");
    }

    return { updated: true };
  });
}

export async function getSubscription(subscriptionId: string) {
  const { supabase } = await requireSuperAdmin();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(*), organizations(name, slug, owner_id)")
    .eq("id", subscriptionId)
    .single();

  if (error) {
    console.error("getSubscription error:", error);
    throw new NotFoundError("Subscription not found.");
  }

  return data;
}

export async function updateSubscription(subscriptionId: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const status = String(formData.get("status") ?? "").trim() as
      | "active"
      | "paused"
      | "cancelled"
      | "failed"
      | "pending";

    if (!status) throw new ValidationError("Status is required.");

    const updates = applyStatusTimestamps(
      {
        status,
        amount_cents: parseInt(String(formData.get("amount_cents") ?? "0"), 10),
        billing_period: String(formData.get("billing_period") ?? "monthly").trim(),
        next_billing_date: String(formData.get("next_billing_date") ?? "").trim() || null,
        payfast_token: String(formData.get("payfast_token") ?? "").trim() || null,
        payfast_subscription_id:
          String(formData.get("payfast_subscription_id") ?? "").trim() || null,
        current_period_end: String(formData.get("current_period_end") ?? "").trim() || null,
        updated_at: new Date().toISOString(),
      },
      status
    );

    const { error } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("id", subscriptionId);

    if (error) {
      console.error("updateSubscription error:", error);
      throw new ValidationError("Failed to update subscription.");
    }

    return { updated: true };
  });
}

export async function listTransactionsForSubscription(subscriptionId: string, limit = 50) {
  const { supabase } = await requireSuperAdmin();

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("listTransactionsForSubscription error:", error);
    throw new ValidationError("Failed to load transactions.");
  }

  return data ?? [];
}

type TransactionListRow = Database["public"]["Tables"]["transactions"]["Row"] & {
  organizations: { name: string | null; slug: string | null } | null;
  restaurants: { name: string | null } | null;
};

// ── Transactions ─────────────────────────────────────────────────────────

export async function listTransactions(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<TransactionListRow>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;
  const status = typeof searchParams?.status === "string" ? searchParams.status : undefined;
  const from = typeof searchParams?.from === "string" ? searchParams.from : undefined;
  const to = typeof searchParams?.to === "string" ? searchParams.to : undefined;

  let query = supabase
    .from("transactions")
    .select("*, organizations(name, slug), restaurants(name)", { count: "exact" })
    .order("occurred_at", { ascending: false });

  if (search) {
    query = query.or(
      `payfast_payment_id.ilike.%${search}%,m_payment_id.ilike.%${search}%,organizations.name.ilike.%${search}%`
    );
  }

  if (status) {
    query = query.eq("payment_status", status);
  }

  if (from) {
    query = query.gte("occurred_at", from);
  }

  if (to) {
    query = query.lte("occurred_at", to);
  }

  return paginatedQuery(query as unknown as PostgrestFilterBuilder<never, never, TransactionListRow, TransactionListRow[], unknown>, { page, pageSize });
}

export async function getOrganization(orgId: string) {
  const { supabase } = await requireSuperAdmin();

  const { data, error } = await supabase
    .from("organizations")
    .select("*, profiles!organizations_owner_id_fkey(*), plans(*)")
    .eq("id", orgId)
    .single();

  if (error || !data) {
    console.error("getOrganization error:", error);
    throw new NotFoundError("Organization not found.");
  }

  return data;
}

// ── Deletions ────────────────────────────────────────────────────────────

async function deleteOrganizationUnsafe(orgId: string) {
  const { supabase } = await requireSuperAdmin();

  // Delete dependent data in FK-safe order.
  // Adjust order based on actual schema constraints.
  const tables = [
    "transactions",
    "invoices",
    "subscriptions",
    "restaurants",
    "organization_members",
  ] as const;

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq("org_id", orgId);
    if (error) {
      console.error(`deleteOrganization cascade error on ${table}:`, error);
      throw new ValidationError(`Failed to delete related ${table}.`);
    }
  }

  const { error } = await supabase.from("organizations").delete().eq("id", orgId);
  if (error) {
    console.error("deleteOrganization error:", error);
    throw new ValidationError("Failed to delete organization.");
  }

  return { deleted: true };
}

export async function deleteOrganization(orgId: string) {
  return safeAction(() => deleteOrganizationUnsafe(orgId));
}

export async function deleteSubscription(subscriptionId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    // Delete dependent invoices first (FK without cascade).
    const { error: invoiceError } = await supabase
      .from("invoices")
      .delete()
      .eq("subscription_id", subscriptionId);

    if (invoiceError) {
      console.error("deleteSubscription invoices error:", invoiceError);
      throw new ValidationError("Failed to delete subscription invoices.");
    }

    const { error } = await supabase.from("subscriptions").delete().eq("id", subscriptionId);
    if (error) {
      console.error("deleteSubscription error:", error);
      throw new ValidationError("Failed to delete subscription.");
    }

    return { deleted: true };
  });
}

export async function deactivatePlan(planId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase
      .from("plans")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", planId);

    if (error) {
      console.error("deactivatePlan error:", error);
      throw new ValidationError("Failed to deactivate plan.");
    }

    return { updated: true };
  });
}

export async function deletePlan(planId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { count, error: countError } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", planId);

    if (countError) {
      console.error("deletePlan count error:", countError);
      throw new ValidationError("Failed to check plan usage.");
    }

    if ((count ?? 0) > 0) {
      throw new ValidationError("Cannot delete a plan that has subscriptions. Deactivate it instead.");
    }

    const { error } = await supabase.from("plans").delete().eq("id", planId);
    if (error) {
      console.error("deletePlan error:", error);
      throw new ValidationError("Failed to delete plan.");
    }

    return { deleted: true };
  });
}

export async function disableUser(userId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "876000h", // 100 years
    });

    if (error) {
      console.error("disableUser error:", error);
      throw new ValidationError("Failed to disable user.");
    }

    return { disabled: true };
  });
}

export async function enableUser(userId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: "0",
    });

    if (error) {
      console.error("enableUser error:", error);
      throw new ValidationError("Failed to enable user.");
    }

    return { enabled: true };
  });
}

export async function deleteUser(userId: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    // Find organizations owned by this user.
    const { data: ownedOrgs, error: orgError } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", userId);

    if (orgError) {
      console.error("deleteUser org lookup error:", orgError);
      throw new ValidationError("Failed to lookup user organizations.");
    }

    // Cascade-delete each owned organization.
    for (const org of ownedOrgs ?? []) {
      await deleteOrganizationUnsafe(org.id);
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error("deleteUser error:", error);
      throw new ValidationError("Failed to delete user.");
    }

    return { deleted: true };
  });
}
