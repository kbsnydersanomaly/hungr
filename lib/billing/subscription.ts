import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

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

type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "status" | "current_period_end" | "scope" | "scope_id"
>;

export async function loadRestaurantSubscriptions(
  supabase: SupabaseClient<Database>,
  restaurant: { id: string; org_id: string }
): Promise<SubscriptionRow[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, scope, scope_id")
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
