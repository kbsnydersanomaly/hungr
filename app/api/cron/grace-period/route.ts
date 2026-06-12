import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";

/**
 * Grace period cron job.
 * Runs once daily to unpublish restaurants whose subscriptions
 * have been in "failed" status for more than 7 days.
 *
 * Expected to be called by Vercel Cron with a secret token.
 */
export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("Authorization");
  const expected = `Bearer ${env.CRON_SECRET ?? ""}`;
  if (!env.CRON_SECRET || authHeader !== expected) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffIso = cutoff.toISOString();

  // Find failed subscriptions older than 7 days
  const { data: failedSubs, error } = await supabase
    .from("subscriptions")
    .select("id, scope, scope_id, org_id, updated_at")
    .eq("status", "failed")
    .lt("updated_at", cutoffIso);

  if (error) {
    console.error("Grace period cron: failed to query subscriptions:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results: Array<{
    subscriptionId: string;
    scope: string;
    scopeId: string;
    action: string;
    success: boolean;
  }> = [];

  for (const sub of failedSubs ?? []) {
    try {
      if (sub.scope === "restaurant") {
        // Unpublish the specific restaurant
        const { error: updateError } = await supabase
          .from("restaurants")
          .update({ status: "unpublished", updated_at: new Date().toISOString() })
          .eq("id", sub.scope_id);

        if (updateError) throw updateError;

        // Notify org owner
        await notifyOrgOwner(supabase, sub.org_id, sub.scope_id);

        results.push({
          subscriptionId: sub.id,
          scope: sub.scope,
          scopeId: sub.scope_id,
          action: "unpublished_restaurant",
          success: true,
        });
      } else if (sub.scope === "org") {
        // Unpublish all restaurants in the org
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id")
          .eq("org_id", sub.scope_id);

        for (const r of restaurants ?? []) {
          await supabase
            .from("restaurants")
            .update({ status: "unpublished", updated_at: new Date().toISOString() })
            .eq("id", r.id);
        }

        // Notify org owner
        await notifyOrgOwner(supabase, sub.org_id, null);

        results.push({
          subscriptionId: sub.id,
          scope: sub.scope,
          scopeId: sub.scope_id,
          action: "unpublished_all_restaurants",
          success: true,
        });
      }
    } catch (err) {
      console.error(`Grace period cron: failed for subscription ${sub.id}:`, err);
      results.push({
        subscriptionId: sub.id,
        scope: sub.scope,
        scopeId: sub.scope_id,
        action: "error",
        success: false,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}

async function notifyOrgOwner(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  restaurantId: string | null
) {
  try {
    // Find the org owner
    type OwnerRow = {
      user_id: string;
      profiles: { email: string | null; display_name: string | null } | null;
    };
    const { data: owner } = await supabase
      .from("organization_members")
      .select("user_id, profiles(email, display_name)")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .returns<OwnerRow[]>()
      .maybeSingle();

    if (!owner) return;

    const email = owner.profiles?.email;
    const name = owner.profiles?.display_name ?? "Restaurant owner";

    if (!email) return;

    let restaurantName: string | undefined;
    if (restaurantId) {
      const { data: r } = await supabase
        .from("restaurants")
        .select("name")
        .eq("id", restaurantId)
        .maybeSingle();
      restaurantName = r?.name;
    }

    await sendMail("payment-failed", email, {
      name,
      billing_url: `${env.NEXT_PUBLIC_APP_URL}/settings/billing`,
      restaurant_name: restaurantName,
    });
  } catch (err) {
    console.error("Failed to notify org owner:", err);
  }
}
