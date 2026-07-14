"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { getActiveOrg } from "@/lib/auth/active-org";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { ValidationError } from "@/lib/errors";

export async function getActiveRestaurant() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const activeOrg = await getActiveOrg();
  if (!activeOrg?.orgId) return null;

  const cookieStore = await cookies();
  const activeRestaurantId = cookieStore.get("active_restaurant")?.value;

  if (activeRestaurantId) {
    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, name, slug")
      .eq("id", activeRestaurantId)
      .eq("org_id", activeOrg.orgId)
      .maybeSingle();

    if (restaurant) {
      return { id: restaurant.id, name: restaurant.name, slug: restaurant.slug };
    }
  }

  // No (valid) selection yet — let the layout fall back to the first
  // restaurant the user is actually allowed to see.
  return null;
}

export async function setActiveRestaurant(
  restaurantId: string,
  redirectTo?: string
) {
  const { supabase } = await requireSession();
  const activeOrg = await getActiveOrg();
  if (!activeOrg?.orgId) throw new ValidationError("No organization found.");

  await requireRestaurantAccess(restaurantId, "staff");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("id")
    .eq("id", restaurantId)
    .eq("org_id", activeOrg.orgId)
    .maybeSingle();

  if (!restaurant) throw new ValidationError("Restaurant not found.");

  const cookieStore = await cookies();
  cookieStore.set("active_restaurant", restaurantId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  if (redirectTo) redirect(redirectTo);
}
