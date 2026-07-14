import { redirect } from "next/navigation";
import { completeSubscriptionOnReturn } from "@/lib/data/billing-actions";
import { isReplacementMPaymentId } from "@/lib/billing/payfast";

export default async function OrgBillingReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The m_payment_id is embedded in the PayFast return URL at checkout time,
  // so this works even if the session cookie was stripped during the
  // cross-origin redirect.
  const sp = await searchParams;
  const mPaymentId = typeof sp?.m_payment_id === "string" ? sp.m_payment_id : null;

  if (mPaymentId) {
    await completeSubscriptionOnReturn(mPaymentId);
  }

  const status = mPaymentId && isReplacementMPaymentId(mPaymentId)
    ? "card-updated"
    : "complete";
  redirect(`/settings/billing?status=${status}`);
}
