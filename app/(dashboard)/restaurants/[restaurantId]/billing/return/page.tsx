import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { completeSubscriptionOnReturn } from "@/lib/data/billing-actions";
import { isReplacementMPaymentId } from "@/lib/billing/payfast";

export default async function BillingReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ restaurantId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { restaurantId } = await params;
  const sp = await searchParams;

  // The m_payment_id is embedded in the PayFast return URL at checkout time,
  // so this works even if the session cookie was stripped during the
  // cross-origin redirect.
  let mPaymentId =
    typeof sp?.m_payment_id === "string" ? sp.m_payment_id : null;

  if (!mPaymentId) {
    // Fallback for checkouts started before the return URL carried the id:
    // look up the most recent pending subscription for this restaurant.
    const supabase = createAdminClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("m_payment_id")
      .eq("scope", "restaurant")
      .eq("scope_id", restaurantId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    mPaymentId = sub?.m_payment_id ?? null;
  }

  if (mPaymentId) {
    await completeSubscriptionOnReturn(mPaymentId);
  }

  const status = mPaymentId && isReplacementMPaymentId(mPaymentId)
    ? "card-updated"
    : "complete";
  redirect(`/restaurants/${restaurantId}/billing?status=${status}`);
}
