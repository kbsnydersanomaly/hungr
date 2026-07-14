"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";
import { setActiveRestaurant } from "@/lib/auth/active-restaurant";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  insights: "Insights",
  restaurants: "Restaurants",
  menus: "Menus",
  branding: "Branding",
  about: "About",
  qr: "QR Codes",
  reviews: "Reviews",
  media: "Media",
  team: "Team",
  specials: "Specials",
  settings: "Settings",
  billing: "Billing",
  organization: "Organization",
  profile: "Profile",
  notifications: "Notifications",
  security: "Security",
  help: "Help",
  admin: "Admin",
};

function getSectionLabel(pathname: string): string | null {
  if (!pathname) return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Dashboard";

  const [first] = segments;

  if (first === "restaurants") {
    // /restaurants/new
    if (segments[1] === "new") return "New restaurant";
    // /restaurants/[id]/*
    if (segments.length >= 3) {
      return SECTION_LABELS[segments[2]] ?? null;
    }
    // /restaurants or /restaurants/[id]
    return segments.length === 1 ? "Restaurants" : "Overview";
  }

  if (first === "settings") {
    return SECTION_LABELS[segments[1]] ?? "Settings";
  }

  if (first === "help") {
    return "Help";
  }

  if (first === "admin") {
    return "Admin";
  }

  return SECTION_LABELS[first] ?? null;
}

export function RestaurantBreadcrumb({
  restaurants,
  activeRestaurant,
  orgName,
  canAddRestaurant,
}: {
  restaurants: Restaurant[];
  activeRestaurant: Restaurant | null;
  orgName: string;
  canAddRestaurant: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const sectionLabel = getSectionLabel(pathname ?? "");
  const isRestaurantScoped =
    /^\/restaurants\/[0-9a-fA-F-]{36,}/.test(pathname ?? "");

  return (
    <div className="min-w-0 flex-1">
      {/* Full breadcrumb on sm+ */}
      <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
        <Link
          href="/settings/organization"
          className="truncate font-medium text-foreground hover:underline"
        >
          {orgName}
        </Link>
        {isRestaurantScoped && restaurants.length > 0 && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <RestaurantSwitcher
              restaurants={restaurants}
              activeRestaurant={activeRestaurant}
              isPending={isPending}
              startTransition={startTransition}
              canAddRestaurant={canAddRestaurant}
            />
          </>
        )}
        {sectionLabel && (
          <>
            <ChevronRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{sectionLabel}</span>
          </>
        )}
      </div>

      {/* Compact breadcrumb on mobile */}
      <div className="min-w-0 sm:hidden">
        {isRestaurantScoped && restaurants.length > 0 ? (
          <div className="flex min-w-0 items-center gap-1 text-sm">
            <RestaurantSwitcher
              restaurants={restaurants}
              activeRestaurant={activeRestaurant}
              isPending={isPending}
              startTransition={startTransition}
              canAddRestaurant={canAddRestaurant}
              compact
            />
            {sectionLabel && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{sectionLabel}</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1 text-sm">
            <Link
              href="/settings/organization"
              className="block truncate font-medium text-foreground hover:underline"
            >
              {orgName}
            </Link>
            {sectionLabel && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="truncate text-muted-foreground">{sectionLabel}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RestaurantSwitcher({
  restaurants,
  activeRestaurant,
  isPending,
  startTransition,
  canAddRestaurant,
  compact = false,
}: {
  restaurants: Restaurant[];
  activeRestaurant: Restaurant | null;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
  canAddRestaurant: boolean;
  compact?: boolean;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          compact
            ? "flex max-w-full items-center gap-1 truncate text-sm font-medium text-foreground outline-none hover:underline cursor-pointer"
            : "flex max-w-full items-center gap-1 truncate font-medium text-foreground outline-none hover:underline cursor-pointer"
        }
      >
        <span className="truncate">
          {activeRestaurant?.name ?? "Select restaurant"}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {restaurants.map((r) => (
          <DropdownMenuItem
            key={r.id}
            onClick={() =>
              startTransition(() => setActiveRestaurant(r.id, `/restaurants/${r.id}`))
            }
            disabled={isPending}
            className="cursor-pointer"
          >
            {r.name}
          </DropdownMenuItem>
        ))}
        {canAddRestaurant && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/restaurants/new")}
              className="cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-2" />
              Add restaurant
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
