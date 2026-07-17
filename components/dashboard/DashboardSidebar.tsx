"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { OrgSwitcher } from "@/components/dashboard/OrgSwitcher";
import { SidebarNavLink } from "@/components/dashboard/SidebarNavLink";
import { SidebarPlainLink } from "@/components/dashboard/SidebarPlainLink";
import {
  Plus,
  LifeBuoy,
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
  type LucideIcon,
} from "lucide-react";

// Icons travel across the server→client boundary as names; the components
// themselves can't be serialized into a Client Component's props.
const sidebarIcons = {
  LayoutDashboard,
  BarChart3,
  UtensilsCrossed,
  Sparkles,
  Palette,
  Info,
  QrCode,
  Star,
  Image: ImageIcon,
  Users,
  CreditCard,
  Settings,
} satisfies Record<string, LucideIcon>;

export type SidebarIconName = keyof typeof sidebarIcons;

type RestaurantNavItem = {
  href: string;
  label: string;
  icon: SidebarIconName;
  desktopOnly?: boolean;
};

type MainNavItem = {
  href: string;
  label: string;
  icon: SidebarIconName;
};

type OrgMembership = {
  orgId: string;
  name: string;
  role: string;
};

export function DashboardSidebar({
  mainNavItems,
  restaurantNavItems,
  restaurantOverviewHref,
  showAddRestaurant,
  memberships,
  activeOrgId,
  canManageOrg,
  mode = "desktop",
}: {
  mainNavItems: MainNavItem[];
  restaurantNavItems: RestaurantNavItem[];
  /** Href of the active restaurant's home page; null when there is none. */
  restaurantOverviewHref: string | null;
  showAddRestaurant: boolean;
  memberships: OrgMembership[];
  activeOrgId: string | null;
  canManageOrg: boolean;
  mode?: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  // Restaurant context only on restaurant pages (/restaurants/new is org
  // context). Everywhere else the sidebar shows the organisation menu.
  const inRestaurant =
    pathname.startsWith("/restaurants/") && !pathname.startsWith("/restaurants/new");

  const visibleRestaurantNavItems =
    mode === "mobile"
      ? restaurantNavItems.filter((item) => !item.desktopOnly)
      : restaurantNavItems;
  return (
    <>
      <div className="mb-6 px-2 lg:mb-8">
        <Link href="/" className="inline-block">
          <Image
            src="/Logo.svg"
            alt="Hungr"
            width={150}
            height={50}
            className="h-9 w-auto lg:h-10"
            priority
          />
        </Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => {
          const Icon = sidebarIcons[item.icon];
          const href =
            item.label === "Overview" && inRestaurant && restaurantOverviewHref
              ? restaurantOverviewHref
              : item.href;
          return (
            <SidebarNavLink key={item.label} href={href} label={item.label} exact>
              <Icon className="h-4 w-4 shrink-0" />
            </SidebarNavLink>
          );
        })}

        {inRestaurant &&
          visibleRestaurantNavItems.map((item) => {
            const Icon = sidebarIcons[item.icon];
            return (
              <SidebarNavLink key={item.href} href={item.href} label={item.label}>
                <Icon className="h-4 w-4 shrink-0" />
              </SidebarNavLink>
            );
          })}

        {showAddRestaurant && (
          <div className="px-3 pt-4">
            <SidebarPlainLink
              href="/restaurants/new"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Add restaurant
            </SidebarPlainLink>
          </div>
        )}

        <SidebarNavLink href="/help" label="Help" exact>
          <LifeBuoy className="h-4 w-4 shrink-0" />
        </SidebarNavLink>
      </nav>

      <div className="mt-auto border-t pt-6">
        <div className="px-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Organization
          </p>
          <OrgSwitcher
            memberships={memberships}
            activeOrgId={activeOrgId}
            canManageOrg={canManageOrg}
          />
        </div>
      </div>
    </>
  );
}
