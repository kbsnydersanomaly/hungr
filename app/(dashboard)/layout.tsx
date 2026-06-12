import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/auth/active-org";
import { getActiveRestaurant } from "@/lib/auth/active-restaurant";
import { loadRestaurantsForOrg } from "@/lib/data/restaurants";
import { RestaurantBreadcrumb } from "@/components/dashboard/RestaurantBreadcrumb";
import { OrgSwitcher } from "@/components/dashboard/OrgSwitcher";
import { AvatarMenu } from "@/components/dashboard/AvatarMenu";
import { NotificationBellServer } from "@/components/dashboard/NotificationBellServer";

import { SidebarNavLink } from "@/components/dashboard/SidebarNavLink";
import { ImpersonationBanner } from "@/components/dashboard/ImpersonationBanner";
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
  Plus,
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

  const impersonation = await getImpersonationState();

  return (
    <div className="grid grid-cols-[260px_1fr] min-h-screen">
      {impersonation?.isImpersonating && impersonation.targetUser && (
        <div className="col-span-2">
          <ImpersonationBanner
            targetName={impersonation.targetUser.display_name}
            targetEmail={impersonation.targetUser.email}
          />
        </div>
      )}
      <aside className="border-r bg-muted/30 px-4 py-6 flex flex-col">
        <div className="mb-8 px-2">
          <Link href="/" className="inline-block">
            <Image src="/Logo.svg" alt="Hungr" width={150} height={50} className="h-10 w-auto" priority />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto min-h-0">
          {mainNavItems.map((item) => {
            const href =
              item.label === "Overview" && effectiveRestaurant
                ? `/restaurants/${effectiveRestaurant.id}`
                : item.href;
            const Icon = item.icon;
            return (
              <SidebarNavLink key={href} href={href} label={item.label} exact>
                <Icon className="h-4 w-4" />
              </SidebarNavLink>
            );
          })}

          {effectiveRestaurant &&
            restaurantNavItems
              .filter((item) => hasMinRole(orgRole, item.minRole))
              .map((item) => {
                const href = `/restaurants/${effectiveRestaurant.id}${item.href}`;
                const Icon = item.icon;
                return (
                  <SidebarNavLink key={href} href={href} label={item.label}>
                    <Icon className="h-4 w-4" />
                  </SidebarNavLink>
                );
              })}

          {restaurants.length === 0 && hasMinRole(orgRole, "owner") && (
            <div className="pt-4 px-3">
              <Link
                href="/restaurants/new"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Add restaurant
              </Link>
            </div>
          )}
        </nav>

        <div className="mt-auto pt-6 border-t">
          <div className="px-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Organization
            </p>
            <OrgSwitcher
              memberships={memberships}
              activeOrgId={activeOrgId ?? null}
              canManageOrg={hasMinRole(orgRole, "owner")}
            />
          </div>
        </div>
      </aside>

      <div className="flex flex-col min-h-screen">
        <header className="border-b px-6 py-3 flex items-center justify-between bg-background/95 backdrop-blur sticky top-0 z-10">
          <RestaurantBreadcrumb
            restaurants={restaurants.map((r) => ({ id: r.id, name: r.name, slug: r.slug }))}
            activeRestaurant={activeRestaurant}
            orgName={orgName}
          />
          <div className="flex items-center gap-2">
            <NotificationBellServer />
            <AvatarMenu email={user.email ?? undefined} />
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}


