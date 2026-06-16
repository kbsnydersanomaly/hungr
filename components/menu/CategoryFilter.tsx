"use client";

import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  categories: { id: string; name: string; discount_label?: string | null }[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryFilter({ categories, activeId, onSelect }: CategoryFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          activeId === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors inline-flex items-center gap-1.5",
            activeId === cat.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {cat.name}
          {cat.discount_label && (
            <span className="inline-flex items-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
              {cat.discount_label}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
