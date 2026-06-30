import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/auth/active-org";
import { getActiveRestaurant } from "@/lib/auth/active-restaurant";
import { loadRestaurantsForOrg } from "@/lib/data/restaurants";
import { RestaurantBreadcrumb } from "@/components/dashboard/RestaurantBreadcrumb";
import { AvatarMenu } from "@/components/dashboard/AvatarMenu";
import { NotificationBellServer } from "@/components/dashboard/NotificationBellServer";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { ImpersonationBanner } from "@/components/dashboard/ImpersonationBanner";
import { SubscriptionInvalidBanner } from "@/components/dashboard/SubscriptionInvalidBanner";
import { getImpersonationState } from "@/lib/auth/impersonation";
import {
  LayoutDashboard,
  BarChart3,
  UtensilsCrossed,
  Sparkles,
  Palette,
  Info,
  QrCode,
  Star,
  Image as ImageIcon,
  Users,
  CreditCard,
  Settings,
} from "lucide-react";

export const dynamic = "force-dynamic";

const mainNavItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];

// minRole: lowest org role that sees this entry. Staff only get overview-style
// pages; managers can edit the restaurant; billing/settings stay owner-only.
const restaurantNavItems = [
  { href: "/menus", label: "Menus", icon: UtensilsCrossed, minRole: "manager" },
  { href: "/specials", label: "Specials", icon: Sparkles, minRole: "manager" },
  { href: "/branding", label: "Branding", icon: Palette, minRole: "manager" },
  { href: "/about", label: "About", icon: Info, minRole: "manager" },
  { href: "/qr", label: "QR Codes", icon: QrCode, minRole: "manager" },
  { href: "/reviews", label: "Reviews", icon: Star, minRole: "staff" },
  { href: "/media", label: "Media", icon: ImageIcon, minRole: "manager" },
  { href: "/team", label: "Team", icon: Users, minRole: "manager" },
  { href: "/billing", label: "Billing", icon: CreditCard, minRole: "owner" },
  { href: "/settings", label: "Settings", icon: Settings, minRole: "owner" },
] as const;

const ORG_ROLE_RANK: Record<string, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  staff: 40,
};

function hasMinRole(role: string | undefined, min: string): boolean {
  // Admins share the owner's view except where noted; unknown roles see nothing extra.
  if (min === "owner") return role === "owner" || role === "admin";
  return (ORG_ROLE_RANK[role ?? ""] ?? 0) >= (ORG_ROLE_RANK[min] ?? 0);
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const org = await getActiveOrg();
  const activeOrgId = org?.orgId;
  const orgRole = org?.role;

  const [{ data: orgData }, { data: membershipRows }] = await Promise.all([
    activeOrgId
      ? supabase.from("organizations").select("name").eq("id", activeOrgId).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("organization_members")
      .select("org_id, role, organizations(name)")
      .eq("user_id", user.id),
  ]);

  const orgName = orgData?.name ?? "No organization";

  const memberships = (membershipRows ?? []).map((m) => ({
    orgId: m.org_id,
    role: m.role,
    name:
      (m.organizations as { name?: string } | null)?.name ?? "Unnamed organization",
  }));

  const restaurants = activeOrgId ? await loadRestaurantsForOrg(activeOrgId) : [];
  const activeRestaurant = await getActiveRestaurant();

  // Fallback to first restaurant if none is active but restaurants exist
  const effectiveRestaurant =
    activeRestaurant ??
    (restaurants.length > 0
      ? { id: restaurants[0].id, name: restaurants[0].name, slug: restaurants[0].slug }
      : null);

  // Restaurant-only members (e.g. invited as a restaurant manager) carry org role
  // 'staff' but should see manager-level nav for the restaurant they manage. Use the
  // higher of their org role and their restaurant-specific role for the active one.
  let effectiveRestaurantRole = orgRole;
  if (effectiveRestaurant) {
    const { data: rm } = await supabase
      .from("restaurant_members")
      .select("role")
      .eq("restaurant_id", effectiveRestaurant.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (rm?.role && (ORG_ROLE_RANK[rm.role] ?? 0) > (ORG_ROLE_RANK[orgRole ?? ""] ?? 0)) {
      effectiveRestaurantRole = rm.role;
    }
  }

  const impersonation = await getImpersonationState();

  const resolvedMainNavItems = mainNavItems.map((item) => ({
    ...item,
    href:
      item.label === "Overview" && effectiveRestaurant
        ? `/restaurants/${effectiveRestaurant.id}`
        : item.href,
  }));

  const resolvedRestaurantNavItems = effectiveRestaurant
    ? restaurantNavItems
        .filter((item) => hasMinRole(effectiveRestaurantRole, item.minRole))
        .map((item) => ({
          href: `/restaurants/${effectiveRestaurant.id}${item.href}`,
          label: item.label,
          icon: item.icon,
        }))
    : [];

  const sidebar = (
    <DashboardSidebar
      mainNavItems={resolvedMainNavItems}
      restaurantNavItems={resolvedRestaurantNavItems}
      showAddRestaurant={restaurants.length === 0 && hasMinRole(orgRole, "owner")}
      memberships={memberships}
      activeOrgId={activeOrgId ?? null}
      canManageOrg={hasMinRole(orgRole, "owner")}
    />
  );

  const header = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
      <RestaurantBreadcrumb
        restaurants={restaurants.map((r) => ({ id: r.id, name: r.name, slug: r.slug }))}
        activeRestaurant={activeRestaurant}
        orgName={orgName}
        canAddRestaurant={hasMinRole(orgRole, "owner")}
      />
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <NotificationBellServer />
        <AvatarMenu email={user.email ?? undefined} />
      </div>
    </div>
  );

  return (
    <DashboardShell
      impersonationBanner={
        impersonation?.isImpersonating && impersonation.targetUser ? (
          <ImpersonationBanner
            targetName={impersonation.targetUser.display_name}
            targetEmail={impersonation.targetUser.email}
          />
        ) : undefined
      }
      sidebar={sidebar}
      header={header}
      banners={
        effectiveRestaurant && activeOrgId && hasMinRole(orgRole, "owner") ? (
          <SubscriptionInvalidBanner
            restaurantId={effectiveRestaurant.id}
            orgId={activeOrgId}
            billingHref={`/restaurants/${effectiveRestaurant.id}/billing`}
          />
        ) : undefined
      }
    >
      {children}
    </DashboardShell>
  );
}


