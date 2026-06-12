"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotFoundError, ValidationError, safeAction } from "@/lib/errors";
import { requireOrgAccess, requireRestaurantAccess } from "@/lib/auth/role";
import {
  pauseSubscription as payfastPause,
  cancelSubscription as payfastCancel,
  unpauseSubscription as payfastUnpause,
  nextBillingDate,
} from "@/lib/billing/payfast";
import { env } from "@/lib/env";

export async function loadSubscriptionForRestaurant(restaurantId: string) {
  const { supabase } = await requireRestaurantAccess(restaurantId, "staff");

  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("scope", "restaurant")
    .eq("scope_id", restaurantId)
    .in("status", ["pending", "active", "paused"])
    .maybeSingle();

  if (error) {
    console.error("loadSubscriptionForRestaurant error:", error);
    throw new ValidationError("Failed to load subscription.");
  }

  return data;
}

export async function loadTransactionsForRestaurant(restaurantId: string) {
  const { supabase } = await requireRestaurantAccess(restaurantId, "staff");

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("loadTransactionsForRestaurant error:", error);
    throw new ValidationError("Failed to load transactions.");
  }

  return data ?? [];
}

export async function loadOrgBillingSummary(orgId: string) {
  const { supabase } = await requireOrgAccess(orgId, "admin");

  const [{ data: subscriptions }, { data: transactions }, { data: org }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("*, plans(*)")
        .eq("org_id", orgId)
        .in("status", ["pending", "active", "paused", "failed"])
        .order("created_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("*")
        .eq("org_id", orgId)
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabase
        .from("organizations")
        .select("name, plan_id, payfast_customer_ref")
        .eq("id", orgId)
        .single(),
    ]);

  return {
    subscriptions: subscriptions ?? [],
    transactions: transactions ?? [],
    org,
  };
}

export async function pauseSubscriptionAction(subscriptionId: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .single();

    if (!sub) throw new NotFoundError("Subscription not found");

    if (sub.scope === "restaurant") {
      await requireRestaurantAccess(sub.scope_id, "manager");
    } else {
      await requireOrgAccess(sub.org_id, "owner");
    }

    if (!sub.payfast_token) {
      throw new ValidationError("No PayFast token available for this subscription.");
    }

    await payfastPause(sub.payfast_token);

    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "paused",
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (error) {
      console.error("pauseSubscriptionAction error:", error);
      throw new ValidationError("Failed to pause subscription.");
    }

    revalidatePath(`/restaurants/${sub.scope_id}/billing`);
    revalidatePath("/settings/billing");
    return { paused: true };
  });
}

export async function cancelSubscriptionAction(subscriptionId: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .single();

    if (!sub) throw new NotFoundError("Subscription not found");

    if (sub.scope === "restaurant") {
      await requireRestaurantAccess(sub.scope_id, "manager");
    } else {
      await requireOrgAccess(sub.org_id, "owner");
    }

    if (sub.payfast_token) {
      await payfastCancel(sub.payfast_token);
    }

    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (error) {
      console.error("cancelSubscriptionAction error:", error);
      throw new ValidationError("Failed to cancel subscription.");
    }

    revalidatePath(`/restaurants/${sub.scope_id}/billing`);
    revalidatePath("/settings/billing");
    return { cancelled: true };
  });
}

export async function resumeSubscriptionAction(subscriptionId: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .single();

    if (!sub) throw new NotFoundError("Subscription not found");

    if (sub.scope === "restaurant") {
      await requireRestaurantAccess(sub.scope_id, "manager");
    } else {
      await requireOrgAccess(sub.org_id, "owner");
    }

    if (!sub.payfast_token) {
      throw new ValidationError("No PayFast token available for this subscription.");
    }

    await payfastUnpause(sub.payfast_token);

    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        paused_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (error) {
      console.error("resumeSubscriptionAction error:", error);
      throw new ValidationError("Failed to resume subscription.");
    }

    revalidatePath(`/restaurants/${sub.scope_id}/billing`);
    revalidatePath("/settings/billing");
    return { resumed: true };
  });
}

// ── Invoices ──────────────────────────────────────────────────────────────

/**
 * Returns a short-lived signed URL for an invoice PDF in the private
 * `invoices` bucket (proof of payment for a transaction).
 */
export async function getInvoiceDownloadUrl(invoiceId: string) {
  return safeAction(async () => {
    const admin = createAdminClient();

    const { data: invoice } = await admin
      .from("invoices")
      .select("id, org_id, restaurant_id, pdf_path")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice?.pdf_path) throw new NotFoundError("Invoice not found");

    if (invoice.restaurant_id) {
      await requireRestaurantAccess(invoice.restaurant_id, "staff");
    } else {
      await requireOrgAccess(invoice.org_id, "admin");
    }

    const { data, error } = await admin.storage
      .from("invoices")
      .createSignedUrl(invoice.pdf_path, 300);

    if (error || !data?.signedUrl) {
      console.error("getInvoiceDownloadUrl error:", error);
      throw new ValidationError("Failed to generate invoice link.");
    }

    return { url: data.signedUrl };
  });
}

// ── Return-page completion (webhook fallback) ────────────────────────────

export async function completeSubscriptionOnReturn(mPaymentId: string) {
  return safeAction(async () => {
    // Use admin client to bypass RLS — the return page is already
    // authenticated via session, and we know the m_payment_id.
    const supabase = createAdminClient();

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("m_payment_id", mPaymentId)
      .maybeSingle();

    if (!sub) throw new NotFoundError("Subscription not found");

    // Already active — nothing to do
    if (sub.status === "active") {
      return { status: "active" };
    }

    // Check if webhook already processed a completed transaction
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("m_payment_id", mPaymentId)
      .eq("payment_status", "COMPLETE")
      .maybeSingle();

    const nextBill = nextBillingDate(sub);
    const now = new Date().toISOString();

    if (tx) {
      // Webhook arrived — update subscription
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          started_at: sub.started_at ?? now,
          next_billing_date: nextBill,
          current_period_end: nextBill,
          updated_at: now,
        })
        .eq("id", sub.id);

      // NOTE: no revalidatePath here — this runs during the return page's
      // render, which then redirects to the (dynamic) billing page.
      return { status: "active" };
    }

    // No transaction yet — in sandbox, auto-complete since payments always succeed
    if (env.PAYFAST_SANDBOX) {
      await supabase
        .from("subscriptions")
        .update({
          status: "active",
          started_at: now,
          next_billing_date: nextBill,
          current_period_end: nextBill,
          updated_at: now,
        })
        .eq("id", sub.id);

      // Create a sandbox transaction for consistency
      await supabase.from("transactions").insert({
        subscription_id: sub.id,
        org_id: sub.org_id,
        restaurant_id: sub.scope === "restaurant" ? sub.scope_id : null,
        payfast_payment_id: `sandbox-${Date.now()}`,
        m_payment_id: mPaymentId,
        amount_gross_cents: sub.amount_cents,
        amount_fee_cents: Math.round(sub.amount_cents * 0.035),
        amount_net_cents: sub.amount_cents - Math.round(sub.amount_cents * 0.035),
        payment_status: "COMPLETE",
        raw: { sandbox: true, source: "return_page" },
        occurred_at: now,
      });

      // NOTE: no revalidatePath here — see above.
      return { status: "active" };
    }

    // Production: still waiting for webhook
    return { status: "pending" };
  });
}
