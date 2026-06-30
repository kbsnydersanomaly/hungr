"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCloseMobileNav } from "@/components/dashboard/MobileNavContext";

export function SidebarNavLink({
  href,
  label,
  exact = false,
  children,
}: {
  href: string;
  label: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const closeMobileNav = useCloseMobileNav();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={() => closeMobileNav?.()}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
      {label}
    </Link>
  );
}
