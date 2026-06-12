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
