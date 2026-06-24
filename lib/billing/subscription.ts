import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/lib/database.types";

export type SubscriptionStatus =
  | "pending"
  | "active"
  | "paused"
  | "cancelled"
  | "failed";

export type SubscriptionCheckRow = {
  status: SubscriptionStatus;
  current_period_end: string | null;
};

export type SubscriptionValidity =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "no_active_subscription"
        | "expired"
        | "paused"
        | "cancelled"
        | "failed"
        | "pending";
    };

export function isRestaurantSubscriptionValid(
  subscriptions: SubscriptionCheckRow[],
  now: Date = new Date()
): SubscriptionValidity {
  let hasExpired = false;
  let inactiveReason: Exclude<SubscriptionValidity["valid"] extends true ? never : SubscriptionValidity, { valid: true }>["reason"] | null = null;
  const precedence: SubscriptionStatus[] = ["paused", "cancelled", "failed", "pending"];

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
      const index = precedence.indexOf(sub.status);
      if (index !== -1) {
        if (
          inactiveReason === null ||
          precedence.indexOf(inactiveReason) === -1 ||
          index < precedence.indexOf(inactiveReason)
        ) {
          inactiveReason = sub.status;
        }
      }
    }
  }

  if (hasExpired) {
    return { valid: false, reason: "expired" };
  }

  if (inactiveReason) {
    return { valid: false, reason: inactiveReason };
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
