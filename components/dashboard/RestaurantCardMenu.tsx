"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Settings, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * "⋯" overflow menu on the restaurant grid card. Deletion lives in the
 * settings page danger zone (with its type-the-name confirmation), so the
 * Delete item just deep-links there.
 */
export function RestaurantCardMenu({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const settingsHref = `/restaurants/${restaurantId}/settings`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="More actions"
        className="ml-auto text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => router.push(settingsHref)}
          className="cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push(`${settingsHref}#danger-zone`)}
          variant="destructive"
          className="cursor-pointer"
        >
          <Trash2 className="h-4 w-4" />
          Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
