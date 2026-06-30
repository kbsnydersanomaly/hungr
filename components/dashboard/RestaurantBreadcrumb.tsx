"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

  return (
    <div className="min-w-0 flex-1">
      {/* Full breadcrumb on sm+ */}
      <div className="hidden min-w-0 items-center gap-2 text-sm text-muted-foreground sm:flex">
        <span className="shrink-0">Dashboard</span>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <Link
          href="/settings/organization"
          className="truncate font-medium text-foreground hover:underline"
        >
          {orgName}
        </Link>
        {restaurants.length > 0 && (
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
      </div>

      {/* Compact breadcrumb on mobile */}
      <div className="min-w-0 sm:hidden">
        {restaurants.length > 0 ? (
          <RestaurantSwitcher
            restaurants={restaurants}
            activeRestaurant={activeRestaurant}
            isPending={isPending}
            startTransition={startTransition}
            canAddRestaurant={canAddRestaurant}
            compact
          />
        ) : (
          <Link
            href="/settings/organization"
            className="block truncate text-sm font-medium text-foreground hover:underline"
          >
            {orgName}
          </Link>
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
