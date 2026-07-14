import { NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  validateWithPayFast,
  nextBillingDate,
} from "@/lib/billing/payfast";
import { finalizeReplacementSubscription } from "@/lib/data/billing-actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";
import { formatZar } from "@/lib/utils/money";
import { generateAndStoreInvoice } from "@/lib/billing/invoice-store";

export async function POST(req: Request) {
  const text = await req.text();

  // 1. Verify signature
  const { valid, params } = verifyWebhookSignature(text, env.PAYFAST_PASSPHRASE);
  if (!valid) {
    return new NextResponse("bad signature", { status: 400 });
  }

  // 2. Validate with PayFast
  const isValid = await validateWithPayFast(text);
  if (!isValid) {
    return new NextResponse("invalid", { status: 400 });
  }

  const supabase = createAdminClient();

  // 3. Idempotency
  const { data: existing } = await supabase
    .from("transactions")
    .select("id")
    .eq("payfast_payment_id", params.pf_payment_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  // 4. Resolve subscription by m_payment_id
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("m_payment_id", params.m_payment_id)
    .single();

  // 5. Insert transaction
  const grossCents = Math.round(parseFloat(params.amount_gross || "0") * 100);
  const feeCents = Math.round(parseFloat(params.amount_fee || "0") * 100);
  const netCents = Math.round(parseFloat(params.amount_net || "0") * 100);

  await supabase.from("transactions").insert({
    subscription_id: sub?.id ?? null,
    org_id: sub?.org_id ?? null,
    restaurant_id: sub?.scope === "restaurant" ? sub.scope_id : null,
    payfast_payment_id: params.pf_payment_id,
    m_payment_id: params.m_payment_id,
    amount_gross_cents: grossCents,
    amount_fee_cents: feeCents,
    amount_net_cents: netCents,
    payment_status: params.payment_status,
    email_address: params.email_address,
    raw: params,
    occurred_at: new Date().toISOString(),
  });

  // 6. Update subscription state + send emails + generate invoice
  if (params.payment_status === "COMPLETE" && sub) {
    const nextBilling = nextBillingDate(sub);

    await supabase
      .from("subscriptions")
      .update({
        status: "active",
        payfast_token: params.token ?? sub.payfast_token,
        payfast_subscription_id: params.subscription_id ?? sub.payfast_subscription_id,
        started_at: sub.started_at ?? new Date().toISOString(),
        next_billing_date: nextBilling,
        current_period_end: nextBilling,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    // If this checkout was replacing an existing payment method, cancel the
    // old token and mark the previous subscription row as superseded.
    await finalizeReplacementSubscription(supabase, sub);

    // Generate and store invoice PDF
    try {
      const { number: invoiceNumber } = await generateAndStoreInvoice({
        subscriptionId: sub.id,
        orgId: sub.org_id,
        restaurantId:
          sub.scope === "restaurant" ? sub.scope_id : null,
        amountCents: grossCents,
        periodStart: sub.started_at ?? new Date().toISOString(),
        periodEnd: nextBilling,
        payfastPaymentId: params.pf_payment_id,
        paymentStatus: params.payment_status,
      });

      // Send payment receipt email with invoice number
      if (params.email_address) {
        await sendMail("payment-receipt", params.email_address, {
          invoice_number: invoiceNumber,
          amount: formatZar(grossCents),
          period: new Date().toLocaleDateString("en-ZA", {
            month: "long",
            year: "numeric",
          }),
        });
      }
    } catch (err) {
      console.error("Invoice generation failed:", err);
      // Don't fail the webhook over invoice generation — still send basic receipt
      if (params.email_address) {
        await sendMail("payment-receipt", params.email_address, {
          invoice_number: params.m_payment_id,
          amount: formatZar(grossCents),
          period: new Date().toLocaleDateString("en-ZA", {
            month: "long",
            year: "numeric",
          }),
        });
      }
    }
  } else if (params.payment_status === "FAILED" && sub) {
    await supabase
      .from("subscriptions")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    // Send payment failed email
    if (params.email_address) {
      const billingPath =
        sub.scope === "restaurant"
          ? `/restaurants/${sub.scope_id}/billing`
          : `/settings/billing`;
      await sendMail("payment-failed", params.email_address, {
        billing_url: `${env.NEXT_PUBLIC_APP_URL}${billingPath}`,
      });
    }
  } else if (params.payment_status === "CANCELLED" && sub) {
    await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
  }

  // 7. Audit log
  if (sub?.org_id) {
    await supabase.from("audit_logs").insert({
      org_id: sub.org_id,
      restaurant_id: sub.scope === "restaurant" ? sub.scope_id : null,
      action: `payfast.${params.payment_status.toLowerCase()}`,
      target_table: "subscriptions",
      target_id: sub.id,
      diff: { pf_payment_id: params.pf_payment_id, amount_gross_cents: grossCents },
    });
  }

  return NextResponse.json({ ok: true });
}
