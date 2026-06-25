"use client";

import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Menu, Info, UtensilsCrossed } from "lucide-react";
import { publicAboutHref } from "@/lib/menu/public-routes";

interface MobileNavProps {
  restaurantSlug: string;
  restaurantName: string;
  currentMenuSlug: string;
  menus: Array<{ id: string; name: string; slug: string }>;
  categories: Array<{ id: string; name: string }>;
}

export function MobileNav({
  restaurantSlug,
  restaurantName,
  currentMenuSlug,
  menus,
  categories,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-current/10 outline-none"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="w-72 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <SheetTitle className="text-base font-semibold font-heading">{restaurantName}</SheetTitle>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto">
          {menus.length > 1 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Menus
              </p>
              <div className="space-y-1">
                {menus.map((menu) => (
                  <Link
                    key={menu.id}
                    href={`/m/${restaurantSlug}/${menu.slug}`}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                      menu.slug === currentMenuSlug
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted"
                    }`}
                  >
                    <UtensilsCrossed className="h-4 w-4" />
                    {menu.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {categories.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Categories
              </p>
              <div className="space-y-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setOpen(false);
                      const el = document.getElementById(`category-${category.id}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              More
            </p>
            <Link
              href={publicAboutHref(restaurantSlug, currentMenuSlug)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Info className="h-4 w-4" />
              About
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
