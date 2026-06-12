"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { renderInvoicePdf } from "./invoice";

interface StoreInvoiceArgs {
  subscriptionId: string;
  orgId: string;
  restaurantId?: string | null;
  amountCents: number;
  periodStart: string;
  periodEnd: string;
  payfastPaymentId: string;
  paymentStatus: string;
}

export async function generateAndStoreInvoice(
  args: StoreInvoiceArgs
): Promise<{ invoiceId: string; pdfPath: string; number: string }> {
  const adminClient = createAdminClient();

  // 1. Get org details
  const { data: org } = await adminClient
    .from("organizations")
    .select("name, slug")
    .eq("id", args.orgId)
    .single();

  if (!org) {
    throw new Error(`Organization ${args.orgId} not found`);
  }

  // 2. Get plan name from subscription
  type SubWithPlan = {
    plan_id: string | null;
    scope: string;
    scope_id: string;
    plans: { name: string } | null;
  };
  const { data: sub } = await adminClient
    .from("subscriptions")
    .select("plan_id, scope, scope_id, plans(name)")
    .eq("id", args.subscriptionId)
    .returns<SubWithPlan[]>()
    .single();

  const planName = sub?.plans?.name ?? "Hungr";

  // 3. Get restaurant name if applicable
  let restaurantName: string | undefined;
  if (args.restaurantId) {
    const { data: restaurant } = await adminClient
      .from("restaurants")
      .select("name")
      .eq("id", args.restaurantId)
      .maybeSingle();
    restaurantName = restaurant?.name ?? undefined;
  }

  // 4. Generate invoice number (atomic counter via RPC)
  const year = new Date().getFullYear();

  const { data: seq, error: rpcError } = await adminClient.rpc(
    "increment_invoice_counter",
    { p_org_id: args.orgId }
  );

  if (rpcError || !seq) {
    console.error("increment_invoice_counter RPC failed:", rpcError);
    throw new Error("Failed to generate invoice number.");
  }

  const number = `${org.slug.toUpperCase()}-${year}-${String(seq).padStart(4, "0")}`;

  // 5. Render PDF
  const pdfBlob = await renderInvoicePdf({
    number,
    orgName: org.name,
    orgSlug: org.slug,
    restaurantName,
    planName,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    amountCents: args.amountCents,
    paymentStatus: args.paymentStatus,
    payfastPaymentId: args.payfastPaymentId,
    paidAt: new Date().toISOString(),
  });

  // 6. Upload to storage
  const pdfPath = `${args.orgId}/${number}.pdf`;
  const arrayBuffer = await pdfBlob.arrayBuffer();

  const { error: uploadError } = await adminClient.storage
    .from("invoices")
    .upload(pdfPath, new Uint8Array(arrayBuffer), {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Failed to upload invoice PDF:", uploadError);
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // 7. Insert invoice row
  const { data: invoice, error: insertError } = await adminClient
    .from("invoices")
    .insert({
      number,
      org_id: args.orgId,
      restaurant_id: args.restaurantId ?? null,
      subscription_id: args.subscriptionId,
      period_start: args.periodStart,
      period_end: args.periodEnd,
      subtotal_cents: args.amountCents,
      total_cents: args.amountCents,
      status: "paid",
      pdf_path: pdfPath,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError || !invoice) {
    console.error("Failed to insert invoice:", insertError);
    throw new Error(`Invoice insert failed: ${insertError?.message}`);
  }

  return { invoiceId: invoice.id, pdfPath, number };
}
