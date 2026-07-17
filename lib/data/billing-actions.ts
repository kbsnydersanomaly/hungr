"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NotFoundError, ValidationError, actionError, safeAction } from "@/lib/errors";
import { requireOrgAccess, requireRestaurantAccess } from "@/lib/auth/role";
import { requireSession } from "@/lib/auth/session";
import {
  pauseSubscription as payfastPause,
  cancelSubscription as payfastCancel,
  unpauseSubscription as payfastUnpause,
  nextBillingDate,
  buildPayFastCheckout,
  getCardUpdateUrl,
  buildReplacementMPaymentId,
} from "@/lib/billing/payfast";
import { finalizeReplacementSubscription } from "@/lib/billing/replacement";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/utils/audit";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type SubscriptionRow = {
  id: string;
  scope: "restaurant" | "org";
  scope_id: string;
  org_id: string;
  plan_id: string;
  status: string;
  amount_cents: number;
  billing_period: string;
  payfast_token: string | null;
  m_payment_id: string | null;
  started_at: string | null;
  current_period_end: string | null;
  next_billing_date: string | null;
  paused_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

async function getSubscriptionContext(
  supabase: SupabaseClient<Database>,
  sub: SubscriptionRow
) {
  const baseUrl = env.NEXT_PUBLIC_APP_URL;

  if (sub.scope === "restaurant") {
    const { data } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", sub.scope_id)
      .maybeSingle();

    return {
      name: data?.name ?? "Restaurant",
      billingUrl: `${baseUrl}/restaurants/${sub.scope_id}/billing`,
    };
  }

  const { data } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", sub.org_id)
    .maybeSingle();

  return {
    name: data?.name ?? "Organization",
    billingUrl: `${baseUrl}/settings/billing`,
  };
}

async function notifySubscriptionEvent(
  sub: SubscriptionRow,
  action: "paused" | "cancelled" | "resumed",
  actorUserId: string
) {
  const admin = createAdminClient();
  const h = await headers();

  const auditPromise = admin.from("audit_logs").insert({
    org_id: sub.org_id,
    restaurant_id: sub.scope === "restaurant" ? sub.scope_id : null,
    actor_user_id: actorUserId,
    action: `subscription:${action}`,
    target_table: "subscriptions",
    target_id: sub.id,
    diff: { status: action },
    ip: h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? null,
    user_agent: h.get("user-agent") ?? null,
  });

  const { data: recipients } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("org_id", sub.org_id)
    .in("role", ["owner", "admin"]);

  const notificationType = `subscription_${action}` as const;
  const notificationPayload = {
    subscription_id: sub.id,
    scope: sub.scope,
    scope_id: sub.scope_id,
    status: action,
    message: `A subscription was ${action}.`,
  };

  const notificationPromises = (recipients ?? [])
    .filter((r) => r.user_id)
    .map((r) =>
      admin.from("notifications").insert({
        user_id: r.user_id,
        type: notificationType,
        payload: notificationPayload,
      })
    );

  await Promise.all([auditPromise, ...notificationPromises]);
}

export async function loadSubscriptionForRestaurant(restaurantId: string) {
  const { supabase } = await requireRestaurantAccess(restaurantId, "staff");

  // A restaurant can accumulate more than one subscription row over its
  // lifetime (e.g. cancel then re-subscribe). Take the most recent, but skip
  // pending `replace:` rows — an abandoned update-payment-method checkout must
  // not shadow the still-active subscription on the billing page.
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plans(*)")
    .eq("scope", "restaurant")
    .eq("scope_id", restaurantId)
    .in("status", ["pending", "active", "paused", "cancelled", "superseded"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("loadSubscriptionForRestaurant error:", error);
    throw actionError("Failed to load subscription", error);
  }

  return (
    (data ?? []).find(
      (sub) => !(sub.status === "pending" && sub.m_payment_id?.startsWith("replace:"))
    ) ?? null
  );
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
    throw actionError("Failed to load transactions", error);
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
        .in("status", ["pending", "active", "paused", "failed", "cancelled", "superseded"])
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

/**
 * Load a subscription and authorize the current user against its scope
 * (restaurant manager or org admin). Shared by the pause/cancel/resume/retry
 * actions so the fetch + scope-branching auth lives in one place.
 */
async function loadAuthorizedSubscription(subscriptionId: string) {
  const { user } = await requireSession();
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
    await requireOrgAccess(sub.org_id, "admin");
  }

  return { user, supabase, sub };
}

function revalidateBilling(sub: { scope: string; scope_id: string }) {
  if (sub.scope === "restaurant") {
    revalidatePath(`/restaurants/${sub.scope_id}/billing`);
  }
  revalidatePath("/settings/billing");
}

export async function pauseSubscriptionAction(subscriptionId: string) {
  return safeAction(async () => {
    const { user, supabase, sub } = await loadAuthorizedSubscription(subscriptionId);

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
      throw actionError("Failed to pause subscription", error);
    }

    const context = await getSubscriptionContext(supabase, sub as SubscriptionRow);
    try {
      await sendMail("subscription-paused", user.email!, {
        restaurant_name: context.name,
        billing_url: context.billingUrl,
      });
    } catch (err) {
      console.error("Failed to send subscription-paused email:", err);
    }

    await notifySubscriptionEvent(sub as SubscriptionRow, "paused", user.id);

    revalidateBilling(sub);
    return { paused: true };
  });
}

export async function cancelSubscriptionAction(subscriptionId: string) {
  return safeAction(async () => {
    const { user, supabase, sub } = await loadAuthorizedSubscription(subscriptionId);

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
      throw actionError("Failed to cancel subscription", error);
    }

    const context = await getSubscriptionContext(supabase, sub as SubscriptionRow);
    try {
      await sendMail("subscription-cancelled", user.email!, {
        restaurant_name: context.name,
        billing_url: context.billingUrl,
      });
    } catch (err) {
      console.error("Failed to send subscription-cancelled email:", err);
    }

    await notifySubscriptionEvent(sub as SubscriptionRow, "cancelled", user.id);

    revalidateBilling(sub);
    return { cancelled: true };
  });
}

export async function resumeSubscriptionAction(subscriptionId: string) {
  return safeAction(async () => {
    const { user, supabase, sub } = await loadAuthorizedSubscription(subscriptionId);

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
      throw actionError("Failed to resume subscription", error);
    }

    await notifySubscriptionEvent(sub as SubscriptionRow, "resumed", user.id);

    revalidateBilling(sub);
    return { resumed: true };
  });
}

/**
 * Re-launch PayFast checkout for a subscription stuck in `pending` (the user
 * abandoned or failed the initial checkout). Rebuilds the checkout URL from the
 * existing subscription and redirects the browser to PayFast.
 */
export async function retrySubscriptionCheckout(subscriptionId: string) {
  return safeAction(async () => {
    const { supabase, sub } = await loadAuthorizedSubscription(subscriptionId);

    if (sub.status !== "pending") {
      throw new ValidationError("This subscription is not awaiting payment.");
    }

    const isRestaurant = sub.scope === "restaurant";
    const baseUrl = env.NEXT_PUBLIC_APP_URL;
    const context = await getSubscriptionContext(supabase, sub as SubscriptionRow);

    // Reuse the original m_payment_id so the webhook/return page can reconcile;
    // generate one only if it was never set.
    let mPaymentId = sub.m_payment_id;
    if (!mPaymentId) {
      mPaymentId = `${sub.org_id}-${sub.scope}-${Date.now()}`;
      await supabase
        .from("subscriptions")
        .update({ m_payment_id: mPaymentId })
        .eq("id", sub.id);
    }

    const returnBase = isRestaurant
      ? `${baseUrl}/restaurants/${sub.scope_id}/billing`
      : `${baseUrl}/settings/billing`;

    const checkoutUrl = buildPayFastCheckout({
      m_payment_id: mPaymentId,
      amount_cents: sub.amount_cents,
      item_name: isRestaurant
        ? `Hungr — ${context.name}`
        : `Hungr — ${context.name} Plan`,
      subscription_type: 1,
      frequency: 3,
      cycles: 0,
      return_url: `${returnBase}/return?m_payment_id=${encodeURIComponent(mPaymentId)}`,
      cancel_url: `${returnBase}?status=cancel`,
      notify_url: `${baseUrl}/api/webhooks/payfast`,
      custom_str1: isRestaurant ? sub.scope_id : sub.org_id,
      custom_str2: isRestaurant ? sub.org_id : "org",
    });

    redirect(checkoutUrl);
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
      throw actionError("Failed to generate invoice link", error);
    }

    return { url: data.signedUrl };
  });
}

export async function updatePaymentMethodAction(subscriptionId: string) {
  return safeAction(async () => {
    const { sub } = await loadAuthorizedSubscription(subscriptionId);

    if (!sub.payfast_token) {
      throw new ValidationError(
        "No PayFast token available for this subscription."
      );
    }

    if (!["active", "paused"].includes(sub.status)) {
      throw new ValidationError(
        "Subscription must be active or paused to update the payment method."
      );
    }

    const baseUrl = env.NEXT_PUBLIC_APP_URL;
    const returnBase =
      sub.scope === "restaurant"
        ? `${baseUrl}/restaurants/${sub.scope_id}/billing`
        : `${baseUrl}/settings/billing`;
    const cardUpdatedReturnUrl = `${returnBase}?status=card-updated`;

    // Production: PayFast hosts a card-update page for subscription tokens.
    if (!env.PAYFAST_SANDBOX) {
      const url = getCardUpdateUrl(sub.payfast_token, cardUpdatedReturnUrl);

      await writeAudit({
        org_id: sub.org_id,
        restaurant_id: sub.scope === "restaurant" ? sub.scope_id : undefined,
        action: "subscription:update_payment_method_initiated",
        target_table: "subscriptions",
        target_id: sub.id,
        diff: { method: "hosted_card_update", return_url: cardUpdatedReturnUrl },
      });

      return { url };
    }

    // Sandbox fallback: start a replacement checkout for the same plan.
    // The old token is cancelled only after the new checkout completes, so
    // service is not interrupted.
    const token = sub.payfast_token;
    const mPaymentId = buildReplacementMPaymentId({
      id: sub.id,
      payfast_token: token,
    });

    const admin = createAdminClient();

    // Remove replacement rows from earlier abandoned attempts for this
    // subscription so they don't accumulate as pending rows forever.
    await admin
      .from("subscriptions")
      .delete()
      .eq("status", "pending")
      .like("m_payment_id", `replace:${sub.id}:%`);

    const { error: insertError } = await admin
      .from("subscriptions")
      .insert({
        scope: sub.scope,
        scope_id: sub.scope_id,
        org_id: sub.org_id,
        plan_id: sub.plan_id,
        status: "pending",
        amount_cents: sub.amount_cents,
        billing_period: sub.billing_period,
        m_payment_id: mPaymentId,
      });

    if (insertError) {
      console.error("updatePaymentMethodAction insert error:", insertError);
      throw actionError("Failed to start payment method update", insertError);
    }

    await writeAudit({
      org_id: sub.org_id,
      restaurant_id: sub.scope === "restaurant" ? sub.scope_id : undefined,
      action: "subscription:update_payment_method_initiated",
      target_table: "subscriptions",
      target_id: sub.id,
      diff: { method: "replace_subscription", new_m_payment_id: mPaymentId },
    });

    const checkoutUrl = buildPayFastCheckout({
      m_payment_id: mPaymentId,
      amount_cents: sub.amount_cents,
      item_name: "Hungr — Update payment method",
      subscription_type: 1,
      frequency: 3,
      cycles: 0,
      return_url: `${returnBase}/return?m_payment_id=${encodeURIComponent(
        mPaymentId
      )}`,
      cancel_url: `${returnBase}?status=cancel`,
      notify_url: `${baseUrl}/api/webhooks/payfast`,
      custom_str1: sub.scope_id,
      custom_str2: sub.org_id,
      custom_str3: sub.id,
      custom_str4: token,
    });

    return { url: checkoutUrl };
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
      // Webhook arrived — update subscription.
      // Finalize the old subscription FIRST: the `subscriptions_one_active`
      // unique index forbids two active rows per scope, so activating the
      // replacement before superseding the old row would fail. The finalize
      // is claim-based and idempotent, so the webhook doing the same is safe.
      await finalizeReplacementSubscription(supabase, sub);

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
      // Supersede the old subscription before activating (see above — the
      // unique index forbids two active rows per scope).
      await finalizeReplacementSubscription(supabase, sub);

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
