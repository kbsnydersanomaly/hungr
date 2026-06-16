import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";

export async function getActiveOrg() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get("active_org")?.value;

  if (activeOrgId) {
    const { data } = await supabase
      .from("organization_members")
      .select("org_id, role")
      .eq("user_id", user.id)
      .eq("org_id", activeOrgId)
      .maybeSingle();
    if (data) return { orgId: data.org_id, role: data.role };
  }

  const { data } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (data) return { orgId: data.org_id, role: data.role };

  // Restaurant-only members don't have an organization_members row, but they
  // still belong to an org via the restaurant they were invited to.
  const { data: restaurantMember } = await supabase
    .from("restaurant_members")
    .select("restaurants!inner(org_id)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const orgIdFromRestaurant = (restaurantMember?.restaurants as { org_id: string } | null)?.org_id;
  if (orgIdFromRestaurant) {
    return { orgId: orgIdFromRestaurant, role: "staff" };
  }

  return null;
}
