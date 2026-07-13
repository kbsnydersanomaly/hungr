"use client";

import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/lib/types/menu";

interface CategoryFilterProps {
  categories: (CategoryNode & { discount_label?: string | null })[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryFilter({ categories, activeId, onSelect }: CategoryFilterProps) {
  // Find the top-level category whose sub-pills should be shown: either the
  // active one (if it has children) or the parent of an active sub-category.
  const activeNode = categories.find((c) => c.id === activeId);
  const activeParent =
    activeNode && activeNode.children.length > 0
      ? activeNode
      : categories.find((c) => c.children.some((s) => s.id === activeId));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            activeId === null
              ? "bg-[color:var(--color-accent,var(--secondary))] text-[color:var(--accent-foreground,var(--secondary-foreground))]"
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
              activeId === cat.id || activeParent?.id === cat.id
                ? "bg-[color:var(--color-accent,var(--secondary))] text-[color:var(--accent-foreground,var(--secondary-foreground))]"
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

      {activeParent && activeParent.children.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
          <button
            onClick={() => onSelect(activeParent.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeId === activeParent.id
                ? "bg-[color:var(--color-accent,var(--secondary))] text-[color:var(--accent-foreground,var(--secondary-foreground))]"
                : "bg-background text-muted-foreground border hover:bg-muted/60"
            )}
          >
            All {activeParent.name}
          </button>
          {activeParent.children.map((sub) => (
            <button
              key={sub.id}
              onClick={() => onSelect(sub.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeId === sub.id
                  ? "bg-[color:var(--color-accent,var(--secondary))] text-[color:var(--accent-foreground,var(--secondary-foreground))]"
                  : "bg-background text-muted-foreground border hover:bg-muted/60"
              )}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
