"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MenuSwitcherProps {
  restaurantSlug: string;
  currentMenuSlug: string;
  menus: Array<{ id: string; name: string; slug: string; is_default?: boolean | null }>;
}

export function MenuSwitcher({ restaurantSlug, currentMenuSlug, menus }: MenuSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (menus.length <= 1) return null;

  const currentMenu = menus.find((m) => m.slug === currentMenuSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-busy={isPending}
        className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors outline-none"
      >
        {currentMenu?.name ?? "Menu"}
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {menus.map((menu) => {
          const isActive = menu.slug === currentMenuSlug;
          return (
            <DropdownMenuItem
              key={menu.id}
              className={cn(
                "flex items-center justify-between gap-4 cursor-pointer",
                isActive && "font-medium"
              )}
              onClick={() =>
                startTransition(() =>
                  router.push(`/m/${restaurantSlug}/${menu.slug}`)
                )
              }
            >
              <span>{menu.name}</span>
              {isActive && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
