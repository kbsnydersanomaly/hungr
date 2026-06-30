"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { MobileNavProvider } from "@/components/dashboard/MobileNavContext";

export function DashboardShell({
  impersonationBanner,
  sidebar,
  header,
  banners,
  children,
}: {
  impersonationBanner?: React.ReactNode;
  sidebar: React.ReactNode;
  header: React.ReactNode;
  banners?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  return (
    <div className="flex min-h-screen flex-col">
      {impersonationBanner}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[260px] shrink-0 flex-col border-r bg-muted/30 px-4 py-6 lg:flex">
          {sidebar}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:gap-3 lg:px-6">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 lg:hidden"
              aria-label="Open navigation menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">{header}</div>
          </header>

          {banners}

          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[min(100vw-2rem,280px)] gap-0 border-r bg-white p-0"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <MobileNavProvider onNavigate={closeMobileNav}>
            <div className="flex h-full flex-col px-4 py-6">{sidebar}</div>
          </MobileNavProvider>
        </SheetContent>
      </Sheet>
    </div>
  );
}
