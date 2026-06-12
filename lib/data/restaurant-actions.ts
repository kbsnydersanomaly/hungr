"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ValidationError,
  safeAction,
  BillingError,
  type ActionResult,
} from "@/lib/errors";
import { requireOrgAccess, requireRestaurantAccess } from "@/lib/auth/role";
import { requireSession } from "@/lib/auth/session";
import { ensureUniqueSlug } from "@/lib/utils/slug";
import {
  computeRestaurantPriceCents,
  loadActivePlanForOrg,
} from "@/lib/billing/pricing";
import { buildPayFastCheckout } from "@/lib/billing/payfast";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAudit } from "@/lib/utils/audit";

export async function createRestaurant(
  formData: FormData
): Promise<ActionResult<void>> {
  return safeAction(async () => {
    let orgId = String(formData.get("orgId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const street = String(formData.get("street") ?? "").trim() || null;
    const city = String(formData.get("city") ?? "").trim() || null;
    const province = String(formData.get("province") ?? "").trim() || null;

    if (!name) throw new ValidationError("Restaurant name is required.");

    const { user, supabase } = await requireSession();

    if (!orgId) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      orgId = membership?.org_id ?? "";
    }

    if (!orgId) throw new ValidationError("No organization found.");

    const { supabase: authed } = await requireOrgAccess(orgId, "admin");

    const slug = await ensureUniqueSlug(name, async (s) => {
      const { data } = await authed.from("restaurants").select("id").eq("slug", s).maybeSingle();
      return !!data;
    });

    const { data: restaurant, error } = await authed
      .from("restaurants")
      .insert({ org_id: orgId, name, slug, street, city, province })
      .select()
      .single();

    if (error || !restaurant) {
      if (error?.code === "23505") {
        throw new ValidationError(
          "Another restaurant in your organization already has this name."
        );
      }
      console.error("createRestaurant error:", error);
      throw new ValidationError("Failed to create restaurant.");
    }

    await authed.from("branding_drafts").insert({ restaurant_id: restaurant.id });

    await writeAudit({
      action: "restaurant.create",
      org_id: orgId,
      restaurant_id: restaurant.id,
      target_table: "restaurants",
      target_id: restaurant.id,
      diff: { name, slug, street, city, province },
    });

    revalidatePath("/restaurants");
    redirect(`/restaurants/${restaurant.id}`);
  });
}

export async function updateRestaurant(restaurantId: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const name = String(formData.get("name") ?? "").trim();
    const street = String(formData.get("street") ?? "").trim() || null;
    const city = String(formData.get("city") ?? "").trim() || null;
    const province = String(formData.get("province") ?? "").trim() || null;

    if (!name) throw new ValidationError("Restaurant name is required.");

    const { error } = await supabase
      .from("restaurants")
      .update({ name, street, city, province, updated_at: new Date().toISOString() })
      .eq("id", restaurantId);

    if (error) {
      console.error("updateRestaurant error:", error);
      throw new ValidationError("Failed to update restaurant.");
    }

    revalidatePath(`/restaurants/${restaurantId}`);
    return { updated: true };
  });
}

export async function createRestaurantAndSubscribe(
  formData: FormData
): Promise<ActionResult<void>> {
  return safeAction(async () => {
    let orgId = String(formData.get("orgId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const street = String(formData.get("street") ?? "").trim() || null;
    const city = String(formData.get("city") ?? "").trim() || null;
    const province = String(formData.get("province") ?? "").trim() || null;

    if (!name) throw new ValidationError("Restaurant name is required.");

    const { user, supabase } = await requireSession();

    if (!orgId) {
      const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      orgId = membership?.org_id ?? "";
    }

    if (!orgId) throw new ValidationError("No organization found.");

    const { supabase: authed } = await requireOrgAccess(orgId, "admin");

    // 1. Load active plan
    const plan = await loadActivePlanForOrg(orgId);
    if (!plan) throw new BillingError("No active plan found. Please contact support.");

    // 2. Count existing restaurants for cap + discount
    const { count: existingCount, error: countError } = await authed
      .from("restaurants")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId);

    if (countError) {
      console.error("count restaurants error:", countError);
      throw new ValidationError("Failed to check restaurant limit.");
    }

    const restaurantIndex = (existingCount ?? 0) + 1;

    // 3. Enforce plan caps
    if (plan.max_restaurants && restaurantIndex > plan.max_restaurants) {
      throw new BillingError(
        `Plan limit reached. Your plan supports up to ${plan.max_restaurants} restaurant(s).`
      );
    }

    // 4. Create restaurant
    const slug = await ensureUniqueSlug(name, async (s) => {
      const { data } = await authed.from("restaurants").select("id").eq("slug", s).maybeSingle();
      return !!data;
    });

    const { data: restaurant, error } = await authed
      .from("restaurants")
      .insert({ org_id: orgId, name, slug, street, city, province })
      .select()
      .single();

    if (error || !restaurant) {
      if (error?.code === "23505") {
        throw new ValidationError(
          "Another restaurant in your organization already has this name."
        );
      }
      console.error("createRestaurant error:", error);
      throw new ValidationError("Failed to create restaurant.");
    }

    await authed.from("branding_drafts").insert({ restaurant_id: restaurant.id });

    // 5. Handle billing based on plan model
    if (plan.pricing_model === "custom") {
      throw new BillingError("Enterprise plans must be set up by support.");
    }

    if (plan.pricing_model === "flat_includes_n") {
      // Ensure org-level subscription exists (or create if first restaurant)
      const { data: existingOrgSub } = await authed
        .from("subscriptions")
        .select("id")
        .eq("org_id", orgId)
        .eq("scope", "org")
        .in("status", ["pending", "active", "paused"])
        .maybeSingle();

      if (!existingOrgSub) {
        // Need to start an org-level subscription
        const mPaymentId = `${orgId}-org-${Date.now()}`;
        await createAdminClient().from("subscriptions").insert({
          scope: "org",
          scope_id: orgId,
          org_id: orgId,
          plan_id: plan.id,
          status: "pending",
          amount_cents: plan.base_price_cents,
          m_payment_id: mPaymentId,
        });

        const checkoutUrl = buildPayFastCheckout({
          m_payment_id: mPaymentId,
          amount_cents: plan.base_price_cents,
          item_name: `Hungr — ${plan.name} Plan`,
          subscription_type: 1,
          frequency: 3,
          cycles: 0,
          return_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing/return?m_payment_id=${encodeURIComponent(mPaymentId)}`,
          cancel_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing?status=cancel`,
          notify_url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/payfast`,
          custom_str1: orgId,
          custom_str2: "org",
        });

        revalidatePath("/restaurants");
        redirect(checkoutUrl);
      }

      // Already covered by org plan — just redirect to restaurant
      revalidatePath("/restaurants");
      redirect(`/restaurants/${restaurant.id}`);
    }

    // per_restaurant (Starter default)
    const amount = computeRestaurantPriceCents(plan, restaurantIndex);

    // Ensure org has a payfast_customer_ref
    const { data: orgData } = await authed
      .from("organizations")
      .select("payfast_customer_ref")
      .eq("id", orgId)
      .single();

    let customerRef = orgData?.payfast_customer_ref;
    if (!customerRef) {
      customerRef = `hgr-${orgId.slice(0, 8)}`;
      await authed
        .from("organizations")
        .update({ payfast_customer_ref: customerRef })
        .eq("id", orgId);
    }

    const mPaymentId = `${customerRef}-${restaurant.id}-${Date.now()}`;

    await createAdminClient().from("subscriptions").insert({
      scope: "restaurant",
      scope_id: restaurant.id,
      org_id: orgId,
      plan_id: plan.id,
      status: "pending",
      amount_cents: amount,
      m_payment_id: mPaymentId,
    });

    const checkoutUrl = buildPayFastCheckout({
      m_payment_id: mPaymentId,
      amount_cents: amount,
      item_name: `Hungr — ${restaurant.name}`,
      subscription_type: 1,
      frequency: 3,
      cycles: 0,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/restaurants/${restaurant.id}/billing/return?m_payment_id=${encodeURIComponent(mPaymentId)}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/restaurants/${restaurant.id}/billing?status=cancel`,
      notify_url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/payfast`,
      custom_str1: restaurant.id,
      custom_str2: orgId,
    });

    revalidatePath("/restaurants");
    redirect(checkoutUrl);
  });
}
