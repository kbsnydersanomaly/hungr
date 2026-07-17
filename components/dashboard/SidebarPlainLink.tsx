"use client";

import Link from "next/link";
import { useCloseMobileNav } from "@/components/dashboard/MobileNavContext";
import { LinkPendingHint } from "@/components/dashboard/LinkPendingHint";

export function SidebarPlainLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const closeMobileNav = useCloseMobileNav();

  return (
    <Link href={href} onClick={() => closeMobileNav?.()} className={className}>
      {children}
      <LinkPendingHint />
    </Link>
  );
}
