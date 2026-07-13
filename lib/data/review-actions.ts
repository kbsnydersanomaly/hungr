"use server";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeAction, ValidationError, actionError } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { ReviewSchema } from "@/lib/schemas/review";
import { sendMail } from "@/lib/mail";
import { env } from "@/lib/env";
import type { NotificationPrefs } from "@/lib/data/notification-actions";
import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

/**
 * Email org owners/admins/managers and restaurant managers about a new review.
 * Runs with the service-role client because the submitter is an anonymous diner
 * whose request-scoped client cannot read memberships or profiles past RLS.
 * A missing/null `notification_prefs.review_emails` means opt-in, matching the
 * defaultChecked behavior on /settings/notifications.
 *
 * Deliberately NOT exported: exports in a "use server" module become public RPC
 * endpoints, and this would let anyone spam managers with arbitrary content.
 */
async function notifyReviewRecipients(review: {
  restaurant_id: string;
  customer_name: string;
  message: string;
  rating: number;
}) {
  const admin = createAdminClient();

  // Report lookup errors instead of silently notifying nobody — a failed query
  // must still never throw to the diner, so log + capture and bail out.
  const reportLookupError = (context: string, error: unknown) => {
    console.error(`${context}:`, error);
    Sentry.captureException(error);
  };

  const { data: restaurant, error: restaurantError } = await admin
    .from("restaurants")
    .select("name, org_id")
    .eq("id", review.restaurant_id)
    .single();

  if (restaurantError) {
    reportLookupError("review notification: restaurant lookup failed", restaurantError);
    return;
  }
  if (!restaurant) return;

  const [{ data: orgMembers, error: orgError }, { data: restaurantManagers, error: rmError }] =
    await Promise.all([
      admin
        .from("organization_members")
        .select("user_id")
        .eq("org_id", restaurant.org_id)
        .in("role", ["owner", "admin", "manager"]),
      admin
        .from("restaurant_members")
        .select("user_id")
        .eq("restaurant_id", review.restaurant_id)
        .eq("role", "manager"),
    ]);

  if (orgError) reportLookupError("review notification: org member lookup failed", orgError);
  if (rmError) reportLookupError("review notification: restaurant manager lookup failed", rmError);

  const userIds = Array.from(
    new Set([
      ...(orgMembers ?? []).map((m) => m.user_id),
      ...(restaurantManagers ?? []).map((m) => m.user_id),
    ])
  );
  if (userIds.length === 0) return;

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("email, notification_prefs")
    .in("id", userIds);

  if (profilesError) {
    reportLookupError("review notification: profile lookup failed", profilesError);
    return;
  }

  const reviews_url = `${env.NEXT_PUBLIC_APP_URL}/restaurants/${review.restaurant_id}/reviews`;
  const message_excerpt =
    review.message.length > 200 ? `${review.message.slice(0, 200)}…` : review.message;

  const recipients = (profiles ?? []).filter(
    (p) =>
      p.email &&
      (p.notification_prefs as NotificationPrefs | null)?.review_emails !== false
  );

  await Promise.all(
    recipients.map((p) =>
      sendMail("review-pending", p.email, {
        restaurant_name: restaurant.name,
        rating: review.rating,
        reviewer_name: review.customer_name,
        message_excerpt,
        reviews_url,
      })
    )
  );
}

export async function submitReviewAction(input: {
  menu_item_id: string;
  restaurant_id: string;
  customer_name: string;
  message: string;
  rating: number;
}) {
  return safeAction(async () => {
    const parsed = ReviewSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0].message);
    }

    const supabase = await createServerClient();
    const { error } = await supabase.from("reviews").insert({
      menu_item_id: parsed.data.menu_item_id,
      restaurant_id: parsed.data.restaurant_id,
      customer_name: parsed.data.customer_name,
      message: parsed.data.message,
      rating: parsed.data.rating,
      status: "pending",
    });

    if (error) {
      console.error("submitReview error:", error);
      throw actionError("Failed to submit review", error);
    }

    // The review is saved — a notification failure must never fail the diner's
    // submission, so report and swallow anything that goes wrong here.
    try {
      await notifyReviewRecipients({
        restaurant_id: parsed.data.restaurant_id,
        customer_name: parsed.data.customer_name,
        message: parsed.data.message,
        rating: parsed.data.rating,
      });
    } catch (err) {
      console.error("review notification failed:", err);
      Sentry.captureException(err);
    }

    return { submitted: true };
  });
}

export async function moderateReview(reviewId: string, status: "approved" | "rejected") {
  return safeAction(async () => {
    const supabase = await createServerClient();
    const { data: review } = await supabase
      .from("reviews")
      .select("restaurant_id")
      .eq("id", reviewId)
      .single();

    if (!review) throw new ValidationError("Review not found.");
    await requireRestaurantAccess(review.restaurant_id, "manager");

    const { error } = await supabase
      .from("reviews")
      .update({ status, moderated_at: new Date().toISOString() })
      .eq("id", reviewId);

    if (error) throw actionError("Failed to update review", error);
    revalidatePath(`/restaurants/${review.restaurant_id}/reviews`);
    return { updated: true };
  });
}

export async function deleteReview(reviewId: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();
    const { data: review } = await supabase
      .from("reviews")
      .select("restaurant_id")
      .eq("id", reviewId)
      .single();

    if (!review) throw new ValidationError("Review not found.");
    await requireRestaurantAccess(review.restaurant_id, "manager");

    const { error } = await supabase.from("reviews").delete().eq("id", reviewId);
    if (error) throw actionError("Failed to delete review", error);
    revalidatePath(`/restaurants/${review.restaurant_id}/reviews`);
    return { deleted: true };
  });
}

export async function bulkModerateReviews(
  reviewIds: string[],
  status: "approved" | "rejected"
) {
  return safeAction(async () => {
    if (reviewIds.length === 0) throw new ValidationError("No reviews selected.");

    const supabase = await createServerClient();
    const { data: reviews } = await supabase
      .from("reviews")
      .select("restaurant_id")
      .in("id", reviewIds);

    if (!reviews || reviews.length === 0) throw new ValidationError("Reviews not found.");

    const restaurantIds = Array.from(new Set(reviews.map((r) => r.restaurant_id)));
    // Authorize each distinct restaurant — RLS enforces this server-side too,
    // but verifying here gives a clean error rather than a partial silent update.
    await Promise.all(
      restaurantIds.map((rid) => requireRestaurantAccess(rid, "manager"))
    );

    const { error } = await supabase
      .from("reviews")
      .update({ status, moderated_at: new Date().toISOString() })
      .in("id", reviewIds);

    if (error) throw actionError("Failed to update reviews", error);
    for (const rid of restaurantIds) revalidatePath(`/restaurants/${rid}/reviews`);
    return { updated: true };
  });
}
