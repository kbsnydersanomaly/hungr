import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { requireSession } from "./session";

export type OrgRole = "owner" | "admin" | "manager" | "staff";
export type RestaurantRole = "manager" | "staff";

const ORG_RANK: Record<OrgRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  staff: 40,
};

export async function requireOrgAccess(orgId: string, min: OrgRole = "staff") {
  const { user, supabase } = await requireSession();
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data || ORG_RANK[data.role as OrgRole] < ORG_RANK[min]) {
    if (!(await isSuperAdmin(user.id))) throw new ForbiddenError();
  }
  return { user, supabase, role: data?.role as OrgRole };
}

export async function requireRestaurantAccess(
  restaurantId: string,
  min: "manager" | "staff" = "staff"
) {
  const { user, supabase } = await requireSession();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("org_id")
    .eq("id", restaurantId)
    .maybeSingle();
  if (!restaurant) throw new ForbiddenError();

  // Org roles manager and above get org-wide access. Org 'staff' is only the
  // baseline membership handed out with restaurant-scoped invites, so it must
  // NOT unlock every restaurant in the org — those users need an explicit
  // restaurant_members row.
  const { data: orgMember } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", restaurant.org_id)
    .eq("user_id", user.id)
    .maybeSingle();

  const orgRole = orgMember?.role as OrgRole | undefined;
  if (orgRole && orgRole !== "staff" && ORG_RANK[orgRole] >= ORG_RANK[min]) {
    return { user, supabase };
  }

  const { data: restaurantMember } = await supabase
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    restaurantMember &&
    ORG_RANK[restaurantMember.role as RestaurantRole] >= ORG_RANK[min]
  ) {
    return { user, supabase };
  }

  if (await isSuperAdmin(user.id)) return { user, supabase };

  throw new ForbiddenError();
}

type MenuOwnedTable = "categories" | "menu_items";

async function resolveMenuOwnedAccess(
  table: MenuOwnedTable,
  id: string,
  notFoundLabel: string,
  min: "manager" | "staff"
) {
  const supabase = await createServerClient();
  const { data: row } = await supabase
    .from(table)
    .select("id, menu_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) throw new NotFoundError(`${notFoundLabel} not found`);

  const { data: menu } = await supabase
    .from("menus")
    .select("restaurant_id")
    .eq("id", row.menu_id)
    .maybeSingle();
  if (!menu) throw new NotFoundError("Menu not found");

  const { supabase: authed } = await requireRestaurantAccess(menu.restaurant_id, min);
  return { supabase: authed, restaurantId: menu.restaurant_id, menuId: row.menu_id };
}

export function requireCategoryAccess(
  categoryId: string,
  min: "manager" | "staff" = "manager"
) {
  return resolveMenuOwnedAccess("categories", categoryId, "Category", min);
}

export function requireItemAccess(
  itemId: string,
  min: "manager" | "staff" = "manager"
) {
  return resolveMenuOwnedAccess("menu_items", itemId, "Item", min);
}

export async function isSuperAdmin(userId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", userId)
    .single();
  return data?.is_super_admin === true;
}

/**
 * Require the current session user to be a super admin.
 * Use in server actions that operate with the service-role admin client.
 * Returns the admin Supabase client + the session user.
 */
export async function requireSuperAdmin() {
  const { user } = await requireSession();
  if (!(await isSuperAdmin(user.id))) throw new ForbiddenError();
  return { user, supabase: createAdminClient() };
}
