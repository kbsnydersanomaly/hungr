import { redirect } from "next/navigation";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";
import { createServerClient } from "@/lib/supabase/server";
import { ForbiddenError } from "@/lib/errors";

export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

export type SubscriptionCheckRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "status" | "current_period_end"
>;

type InactiveSubscriptionStatus = Exclude<SubscriptionStatus, "active">;

export type SubscriptionValidity =
  | { valid: true }
  | {
      valid: false;
      reason: InactiveSubscriptionStatus | "no_active_subscription" | "expired";
    };

export function isRestaurantSubscriptionValid(
  subscriptions: SubscriptionCheckRow[],
  now: Date = new Date()
): SubscriptionValidity {
  let hasExpired = false;
  let inactiveReason: SubscriptionStatus | null = null;
  // Inactive status precedence: paused > cancelled > failed > pending
  const precedence: SubscriptionStatus[] = ["paused", "cancelled", "failed", "pending"];

  const precedenceIndex = (status: SubscriptionStatus): number =>
    precedence.indexOf(status);

  for (const sub of subscriptions) {
    if (sub.status === "active") {
      if (
        sub.current_period_end === null ||
        new Date(sub.current_period_end) > now
      ) {
        return { valid: true };
      }
      hasExpired = true;
    } else {
      const index = precedenceIndex(sub.status);
      if (
        index !== -1 &&
        (inactiveReason === null || index < precedenceIndex(inactiveReason))
      ) {
        inactiveReason = sub.status;
      }
    }
  }

  if (hasExpired) {
    return { valid: false, reason: "expired" };
  }

  if (inactiveReason) {
    return { valid: false, reason: inactiveReason as InactiveSubscriptionStatus };
  }

  return { valid: false, reason: "no_active_subscription" };
}

export function isRestaurantManagementAllowed(
  subscriptions: SubscriptionCheckRow[],
  now: Date = new Date()
): boolean {
  const validity = isRestaurantSubscriptionValid(subscriptions, now);
  if (validity.valid) return true;
  return validity.reason === "pending";
}

export type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "id" | "status" | "current_period_end" | "scope" | "scope_id"
>;

export async function loadRestaurantSubscriptions(
  supabase: SupabaseClient<Database>,
  restaurant: { id: string; org_id: string }
): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end, scope, scope_id")
    .eq("org_id", restaurant.org_id)
    .in("status", ["active", "pending", "paused", "cancelled", "failed"]);

  if (error) {
    console.error("Failed to load restaurant subscriptions", error);
    return [];
  }

  return (data ?? []).filter((row) => {
    return (
      (row.scope === "restaurant" && row.scope_id === restaurant.id) ||
      (row.scope === "org" && row.scope_id === restaurant.org_id)
    );
  });
}

export function findPendingSubscription(
  subscriptions: SubscriptionRow[]
): SubscriptionRow | null {
  const restaurantPending = subscriptions.find(
    (s) => s.status === "pending" && s.scope === "restaurant"
  );
  if (restaurantPending) return restaurantPending;
  return (
    subscriptions.find((s) => s.status === "pending" && s.scope === "org") ??
    null
  );
}

export async function assertRestaurantManagementAllowed(
  restaurantId: string
): Promise<void> {
  const supabase = await createServerClient();
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id, org_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (!restaurant) throw new ForbiddenError();

  const subscriptions = await loadRestaurantSubscriptions(supabase, {
    id: restaurantId,
    org_id: restaurant.org_id,
  });

  if (!isRestaurantManagementAllowed(subscriptions)) {
    throw new ForbiddenError("Subscription required for this action.");
  }
}

export async function requireRestaurantManagementOrRedirect(
  restaurantId: string,
  orgId: string
): Promise<void> {
  const supabase = await createServerClient();
  const subscriptions = await loadRestaurantSubscriptions(supabase, {
    id: restaurantId,
    org_id: orgId,
  });

  if (!isRestaurantManagementAllowed(subscriptions)) {
    redirect(
      `/restaurants/${restaurantId}/billing?reason=subscription_required`
    );
  }
}
