"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Building2,
  CircleHelp,
  CreditCard,
  FileText,
  Receipt,
  Settings,
  Shield,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Icons are resolved here by name because server components can't pass
// component functions across the client boundary.
const icons = {
  activity: Activity,
  bell: Bell,
  building: Building2,
  "credit-card": CreditCard,
  "file-text": FileText,
  "help-circle": CircleHelp,
  receipt: Receipt,
  settings: Settings,
  shield: Shield,
  user: User,
  users: Users,
} satisfies Record<string, LucideIcon>;

export type TabNavIcon = keyof typeof icons;

export type TabNavItem = {
  href: string;
  label: string;
  icon: TabNavIcon;
};

export function TabNav({ items }: { items: TabNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 border-b">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = icons[item.icon];

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors",
              isActive
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
