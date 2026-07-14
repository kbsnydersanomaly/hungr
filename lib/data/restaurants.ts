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

  const [
    { data: orgMember, error: orgError },
    { data: memberRestaurants, error: rmError },
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("role, restaurant_scoped")
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

  if (orgError) throw orgError;
  if (rmError) throw rmError;

  const fromMemberships = (memberRestaurants ?? [])
    .map((m) => m.restaurants)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Restaurant-scoped staff (organization_members.restaurant_scoped) only see
  // the restaurants they were explicitly assigned to; org-wide staff fall
  // through and see every restaurant in the org like other org roles.
  if (!orgMember || (orgMember.role === "staff" && orgMember.restaurant_scoped)) {
    return fromMemberships;
  }

  const { data: orgRestaurants, error: rError } = await supabase
    .from("restaurants")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (rError) throw rError;

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
