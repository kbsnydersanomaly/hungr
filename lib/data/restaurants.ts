import { createServerClient } from "@/lib/supabase/server";
import { NotFoundError } from "@/lib/errors";

export async function loadRestaurantBySlug(slug: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) throw new NotFoundError("Restaurant not found");
  return data;
}

export async function loadRestaurantById(id: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) throw new NotFoundError("Restaurant not found");
  return data;
}

export async function loadRestaurantsForOrg(orgId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function loadRestaurantsForUser(userId: string, orgId: string) {
  const supabase = await createServerClient();

  const [{ data: orgMember }, { data: memberRestaurants }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("restaurant_members")
      .select("restaurants(*)")
      .eq("user_id", userId)
      .eq("restaurants.org_id", orgId)
      .order("joined_at", { ascending: false }),
  ]);

  const fromMemberships = (memberRestaurants ?? [])
    .map((m) => m.restaurants)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Org 'staff' is the baseline role handed out with restaurant-scoped invites:
  // those users must only see the restaurants they were explicitly assigned to.
  if (!orgMember || orgMember.role === "staff") {
    return fromMemberships;
  }

  const { data: orgRestaurants } = await supabase
    .from("restaurants")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  const fromOrg = orgRestaurants ?? [];

  const seen = new Set<string>();
  const merged: typeof fromOrg = [];
  for (const r of [...fromOrg, ...fromMemberships]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    merged.push(r);
  }
  return merged;
}
