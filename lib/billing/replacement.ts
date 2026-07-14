import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  cancelSubscription as payfastCancel,
  isReplacementMPaymentId,
  parseReplacementMPaymentId,
} from "@/lib/billing/payfast";
import { writeAudit } from "@/lib/utils/audit";

/**
 * When a replacement checkout completes, cancel the old PayFast token and mark
 * the previous subscription row as superseded so it is not left active.
 *
 * Deliberately NOT in a "use server" module: every export of an action module
 * is a publicly invocable RPC endpoint, and this helper cancels a PayFast
 * token taken from its arguments with no auth of its own. It must only be
 * reachable from the ITN webhook and server-side return handling, both of
 * which verify the subscription first.
 *
 * Idempotent: PayFast delivers a COMPLETE ITN for every recurring charge of
 * the replacement subscription (its m_payment_id keeps the `replace:` prefix),
 * and the return page can race the webhook on first activation. The old row is
 * atomically claimed — flipped to `superseded` only if it isn't already
 * superseded/cancelled — and only the caller that wins the claim cancels the
 * token and writes the audit entry.
 */
export async function finalizeReplacementSubscription(
  supabase: SupabaseClient<Database>,
  newSub: {
    id: string;
    org_id: string;
    scope: string;
    scope_id: string;
    m_payment_id: string | null;
  }
) {
  if (!newSub.m_payment_id || !isReplacementMPaymentId(newSub.m_payment_id)) {
    return;
  }

  const parsed = parseReplacementMPaymentId(newSub.m_payment_id);
  if (!parsed) return;

  const { oldSubId, oldToken } = parsed;

  const { data: claimed, error } = await supabase
    .from("subscriptions")
    .update({
      status: "superseded",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", oldSubId)
    .not("status", "in", "(superseded,cancelled)")
    .select("id");

  if (error) {
    console.error("Failed to mark replaced subscription as superseded:", error);
    return;
  }
  // Someone else (an earlier ITN or the return page) already finalized.
  if (!claimed || claimed.length === 0) return;

  let oldTokenCancelled = false;
  try {
    await payfastCancel(oldToken);
    oldTokenCancelled = true;
  } catch (err) {
    console.error("Failed to cancel replaced PayFast subscription:", err);
  }

  await writeAudit({
    org_id: newSub.org_id,
    restaurant_id: newSub.scope === "restaurant" ? newSub.scope_id : undefined,
    action: "subscription:replaced",
    target_table: "subscriptions",
    target_id: oldSubId,
    diff: {
      replaced_by_subscription_id: newSub.id,
      old_token_cancelled: oldTokenCancelled,
      new_m_payment_id: newSub.m_payment_id,
    },
  });
}
