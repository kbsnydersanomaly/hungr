"use server";

import { createServerClient } from "@/lib/supabase/server";
import { safeAction, ValidationError } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { ReviewSchema } from "@/lib/schemas/review";
import { revalidatePath } from "next/cache";

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
      throw new ValidationError("Failed to submit review.");
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

    if (error) throw new ValidationError("Failed to update review.");
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
    if (error) throw new ValidationError("Failed to delete review.");
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

    if (error) throw new ValidationError("Failed to update reviews.");
    for (const rid of restaurantIds) revalidatePath(`/restaurants/${rid}/reviews`);
    return { updated: true };
  });
}
