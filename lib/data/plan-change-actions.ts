"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOrgAccess } from "@/lib/auth/role";
import { safeAction } from "@/lib/errors";
import { loadPlanBySlug } from "@/lib/billing/pricing";
import {
  cancelSubscription as payfastCancel,
  buildPayFastCheckout,
} from "@/lib/billing/payfast";
import { env } from "@/lib/env";

/**
 * Upgrade an org from Starter (per-restaurant) to Pro (flat org-level).
 * 1. Cancel all active per-restaurant subscriptions via PayFast API
 * 2. Mark them cancelled in DB
 * 3. Create an org-level Pro subscription
 * 4. Redirect to PayFast checkout
 */
export async function upgradeToProPlan(orgId: string) {
  return safeAction(async () => {
    const { supabase } = await requireOrgAccess(orgId, "owner");

    // Load Pro plan
    const proPlan = await loadPlanBySlug("pro");

    // Find all active per-restaurant subscriptions
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("org_id", orgId)
      .eq("scope", "restaurant")
      .in("status", ["active", "paused"]);

    // Cancel each via PayFast API
    for (const sub of subs ?? []) {
      if (sub.payfast_token) {
        try {
          await payfastCancel(sub.payfast_token);
        } catch (err) {
          console.error(`Failed to cancel PayFast sub ${sub.id}:`, err);
          // Continue — we'll still mark it cancelled locally
        }
      }

      await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);
    }

    // Create org-level Pro subscription
    const mPaymentId = `${orgId}-org-pro-${Date.now()}`;

    await createAdminClient().from("subscriptions").insert({
      scope: "org",
      scope_id: orgId,
      org_id: orgId,
      plan_id: proPlan.id,
      status: "pending",
      amount_cents: proPlan.base_price_cents,
      m_payment_id: mPaymentId,
    });

    // Update org plan_id
    await supabase
      .from("organizations")
      .update({ plan_id: proPlan.id, updated_at: new Date().toISOString() })
      .eq("id", orgId);

    const checkoutUrl = buildPayFastCheckout({
      m_payment_id: mPaymentId,
      amount_cents: proPlan.base_price_cents,
      item_name: `Hungr — Pro Plan`,
      subscription_type: 1,
      frequency: 3,
      cycles: 0,
      return_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing/return?m_payment_id=${encodeURIComponent(mPaymentId)}`,
      cancel_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing?status=cancel`,
      notify_url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/payfast`,
      custom_str1: orgId,
      custom_str2: "org",
    });

    revalidatePath("/settings/billing");
    redirect(checkoutUrl);
  });
}
