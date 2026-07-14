"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, Tag, UtensilsCrossed } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatSpecialLabel, formatSpecialSchedule } from "@/lib/utils/specials";
import { cn } from "@/lib/utils";

interface SpecialTarget {
  item_id?: string | null;
  category_id?: string | null;
  combo_item_ids?: string[] | null;
  menu_items?: { name: string } | null;
  categories?: { name: string } | null;
}

export interface SpecialDetailSheetSpecial {
  id: string;
  title: string;
  description: string | null;
  custom_promotional_text?: string | null;
  image_url: string | null;
  kind: string;
  discount_type?: string | null;
  discount_pct?: number | null;
  discount_amount_cents?: number | null;
  combo_price_cents?: number | null;
  date_from: string | null;
  date_to: string | null;
  time_from: string | null;
  time_to: string | null;
  selected_days: string[] | null;
  time_windows?: unknown;
  special_targets?: SpecialTarget[] | null;
}

interface SpecialDetailSheetProps {
  special: SpecialDetailSheetSpecial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantSlug: string;
  menuSlug: string;
  items?: Array<{ id: string; name: string }>;
}

function getKindLabel(kind: string): string {
  if (kind === "combo") return "Combo";
  if (kind === "item_discount") return "Item special";
  if (kind === "category_discount") return "Category special";
  return "Special";
}

export function SpecialDetailSheet({
  special,
  open,
  onOpenChange,
  restaurantSlug,
  menuSlug,
  items = [],
}: SpecialDetailSheetProps) {
  if (!special) return null;

  const schedule = formatSpecialSchedule(special);
  const bodyText = special.custom_promotional_text || special.description;
  const dealLabel = formatSpecialLabel(special);
  const itemIdsOnMenu = new Set(items.map((i) => i.id));

  const itemTargets = (special.special_targets ?? []).filter(
    (t) => t.item_id && t.menu_items?.name
  );
  const categoryTargets = (special.special_targets ?? []).filter(
    (t) => t.category_id && t.categories?.name
  );

  const itemNameById = new Map(items.map((i) => [i.id, i.name]));

  const comboItemTargets = (special.special_targets ?? []).flatMap((target) =>
    (target.combo_item_ids ?? []).map((itemId) => ({
      itemId,
      name: itemNameById.get(itemId) ?? "Item",
      onMenu: itemIdsOnMenu.has(itemId),
    }))
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl px-0 pb-6">
        {special.image_url && (
          <div className="relative aspect-[21/9] w-full overflow-hidden rounded-t-2xl bg-muted">
            <Image
              src={special.image_url}
              alt={special.title}
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4">
              <span
                className={cn(
                  "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase",
                  special.kind === "combo"
                    ? "bg-[color:var(--color-accent,var(--secondary))] text-[color:var(--accent-foreground,var(--secondary-foreground))]"
                    : "bg-destructive text-destructive-foreground"
                )}
              >
                {getKindLabel(special.kind)}
              </span>
            </div>
          </div>
        )}

        <SheetHeader className="px-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <SheetTitle className="text-lg">{special.title}</SheetTitle>
            {dealLabel && (
              <span className="shrink-0 inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {dealLabel}
              </span>
            )}
          </div>
          {!special.image_url && (
            <SheetDescription>
              {getKindLabel(special.kind)}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="px-4 py-2 space-y-5 overflow-y-auto">
          {bodyText && (
            <p className="text-sm leading-relaxed text-foreground">{bodyText}</p>
          )}

          {schedule.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Valid</span>
              </div>
              <ul className="space-y-1">
                {schedule.map((line, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-sm text-foreground"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(itemTargets.length > 0 || categoryTargets.length > 0 || comboItemTargets.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <UtensilsCrossed className="h-3.5 w-3.5" />
                <span>Applies to</span>
              </div>

              {itemTargets.length > 0 && (
                <ul className="space-y-1.5">
                  {itemTargets.map((target) => {
                    const itemId = target.item_id!;
                    const name = target.menu_items?.name ?? "Item";
                    const onMenu = itemIdsOnMenu.has(itemId);

                    if (onMenu) {
                      return (
                        <li key={itemId}>
                          <Link
                            href={`/m/${restaurantSlug}/${menuSlug}/item/${itemId}`}
                            onClick={() => onOpenChange(false)}
                            className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2 hover:text-primary/80"
                          >
                            <Tag className="h-3.5 w-3.5" />
                            {name}
                          </Link>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={itemId}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {name}
                      </li>
                    );
                  })}
                </ul>
              )}

              {categoryTargets.length > 0 && (
                <ul className="space-y-1.5">
                  {categoryTargets.map((target) => (
                    <li
                      key={target.category_id!}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      {target.categories?.name ?? "Category"}
                    </li>
                  ))}
                </ul>
              )}

              {comboItemTargets.length > 0 && (
                <ul className="space-y-1.5">
                  {comboItemTargets.map(({ itemId, name, onMenu }) =>
                    onMenu ? (
                      <li key={itemId}>
                        <Link
                          href={`/m/${restaurantSlug}/${menuSlug}/item/${itemId}`}
                          onClick={() => onOpenChange(false)}
                          className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          <Tag className="h-3.5 w-3.5" />
                          {name}
                        </Link>
                      </li>
                    ) : (
                      <li
                        key={itemId}
                        className="flex items-center gap-1.5 text-sm text-muted-foreground"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        {name}
                      </li>
                    )
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
