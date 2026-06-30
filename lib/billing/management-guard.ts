import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isRestaurantManagementAllowed,
  loadRestaurantSubscriptions,
} from "@/lib/billing/subscription";

/**
 * Guard for restaurant management pages (menus, branding, specials, etc.).
 *
 * Management is allowed while a subscription is valid or still `pending`
 * (mid-signup). For never-paid / failed / cancelled / paused / expired
 * restaurants this redirects to the billing page, where the owner can pay or
 * retry — billing/settings themselves stay reachable.
 */
export async function requireRestaurantManagement(restaurant: {
  id: string;
  org_id: string;
}) {
  // The caller is already authorized to view the page (the restaurant layout
  // runs requireRestaurantAccess). Use the admin client so the billing-state
  // check works for managers too — RLS only lets org admins read subscriptions.
  const subscriptions = await loadRestaurantSubscriptions(
    createAdminClient(),
    restaurant
  );

  if (!isRestaurantManagementAllowed(subscriptions)) {
    redirect(`/restaurants/${restaurant.id}/billing?blocked=1`);
  }
}
