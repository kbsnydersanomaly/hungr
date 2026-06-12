"use client";

import { UtensilsCrossed, ShoppingCart, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  active?: "menu" | "order" | "history";
}

export function BottomNav({ active = "menu" }: BottomNavProps) {
  return (
    <nav className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur px-4 py-2">
      <div className="flex items-center justify-around">
        <NavItem icon={UtensilsCrossed} label="Menu" isActive={active === "menu"} />
        <NavItem icon={ShoppingCart} label="Order" isActive={active === "order"} disabled />
        <NavItem icon={History} label="History" isActive={active === "history"} disabled />
      </div>
    </nav>
  );
}

function NavItem({
  icon: Icon,
  label,
  isActive,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      aria-label={disabled ? `${label} (coming soon)` : label}
      className={cn(
        "relative flex flex-col items-center gap-1 px-3 py-1 text-xs font-medium transition-colors",
        isActive ? "text-primary" : "text-muted-foreground",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
      {disabled && (
        <span className="absolute -top-1 right-0 rounded-full bg-muted px-1 text-[9px] leading-3 text-muted-foreground">
          Soon
        </span>
      )}
    </button>
  );
}
