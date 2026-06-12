import { createServerClient } from "@/lib/supabase/server";
import { NotFoundError } from "@/lib/errors";

export type Plan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  pricing_model: "per_restaurant" | "flat_includes_n" | "custom";
  base_price_cents: number;
  additional_discount_pct: number;
  included_restaurants: number | null;
  max_restaurants: number | null;
  features: Record<string, unknown>;
  contact_only: boolean;
  is_public: boolean;
  active: boolean;
  sort_order: number;
};

export function computeRestaurantPriceCents(
  plan: Plan,
  restaurantIndex: number
): number {
  if (plan.pricing_model !== "per_restaurant") return plan.base_price_cents;
  if (restaurantIndex <= 1) return plan.base_price_cents;
  return Math.round(
    plan.base_price_cents * (1 - plan.additional_discount_pct / 100)
  );
}

export async function loadPlanBySlug(slug: string): Promise<Plan> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) throw new NotFoundError(`Plan "${slug}" not found`);
  return data as Plan;
}

export async function loadActivePlanForOrg(
  orgId: string
): Promise<Plan | null> {
  const supabase = await createServerClient();

  // Look for an active org-level subscription first
  const { data: orgSub } = await supabase
    .from("subscriptions")
    .select("plan_id")
    .eq("org_id", orgId)
    .eq("scope", "org")
    .in("status", ["pending", "active", "paused"])
    .maybeSingle();

  if (orgSub?.plan_id) {
    const { data: plan } = await supabase
      .from("plans")
      .select("*")
      .eq("id", orgSub.plan_id)
      .single();
    if (plan) return plan as Plan;
  }

  // Fall back to the org's denormalized plan_id
  const { data: org } = await supabase
    .from("organizations")
    .select("plan_id")
    .eq("id", orgId)
    .single();

  if (org?.plan_id) {
    const { data: plan } = await supabase
      .from("plans")
      .select("*")
      .eq("id", org.plan_id)
      .single();
    if (plan) return plan as Plan;
  }

  // Default to Starter
  return loadPlanBySlug("starter").catch(() => null);
}

/**
 * Describes what will happen, billing-wise, if the org adds another restaurant.
 * Mirrors the branching in `createRestaurantAndSubscribe` so the "Add restaurant"
 * page can explain the cost (or block) before the user fills in the form.
 */
export type RestaurantBillingContext =
  | { state: "no_plan" }
  | { state: "custom"; plan: Plan }
  | { state: "limit_reached"; plan: Plan; maxRestaurants: number }
  | { state: "included"; plan: Plan }
  | {
      state: "checkout";
      plan: Plan;
      priceCents: number;
      restaurantIndex: number;
      perRestaurant: boolean;
    };

export async function getRestaurantBillingContext(
  orgId: string
): Promise<RestaurantBillingContext> {
  const plan = await loadActivePlanForOrg(orgId);
  if (!plan) return { state: "no_plan" };

  const supabase = await createServerClient();

  const { count } = await supabase
    .from("restaurants")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  const restaurantIndex = (count ?? 0) + 1;

  if (plan.max_restaurants && restaurantIndex > plan.max_restaurants) {
    return { state: "limit_reached", plan, maxRestaurants: plan.max_restaurants };
  }

  if (plan.pricing_model === "custom") {
    return { state: "custom", plan };
  }

  if (plan.pricing_model === "flat_includes_n") {
    const { data: existingOrgSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("org_id", orgId)
      .eq("scope", "org")
      .in("status", ["pending", "active", "paused"])
      .maybeSingle();

    if (existingOrgSub) return { state: "included", plan };

    return {
      state: "checkout",
      plan,
      priceCents: plan.base_price_cents,
      restaurantIndex,
      perRestaurant: false,
    };
  }

  // per_restaurant
  return {
    state: "checkout",
    plan,
    priceCents: computeRestaurantPriceCents(plan, restaurantIndex),
    restaurantIndex,
    perRestaurant: true,
  };
}

export async function countActiveRestaurantSubscriptions(
  orgId: string
): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("scope", "restaurant")
    .in("status", ["pending", "active", "paused"]);

  if (error) {
    console.error("countActiveRestaurantSubscriptions error:", error);
    return 0;
  }

  return count ?? 0;
}
