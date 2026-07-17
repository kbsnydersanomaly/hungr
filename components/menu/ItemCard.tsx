"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { formatZar } from "@/lib/utils/money";
import { trackEvent } from "@/lib/analytics/track";

interface ItemCardProps {
  item: {
    id: string;
    name: string;
    description: string | null;
    price_cents: number;
    image_url: string | null;
    image_urls: string[];
    labels: string[];
    original_price_cents?: number;
    discounted_price_cents?: number;
    discount_label?: string | null;
  };
  restaurantSlug: string;
  menuSlug: string;
  menuId: string;
  compact?: boolean;
}

export function ItemCard({ item, restaurantSlug, menuSlug, menuId, compact }: ItemCardProps) {
  const image = item.image_url || item.image_urls?.[0];

  return (
    <Link
      href={`/m/${restaurantSlug}/${menuSlug}/item/${item.id}`}
      onClick={() => {
        trackEvent({ menuId, itemId: item.id, eventType: "click" });
      }}
      className={cn(
        "group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md",
        compact ? "p-3" : "p-0"
      )}
    >
      {!compact && image && (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <Image
            src={image}
            alt={item.name}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      )}
      <div className={cn("space-y-1", !compact && "p-3")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{item.name}</h3>
          <div className="shrink-0 text-right">
            {item.discount_label && item.discounted_price_cents !== undefined && (
              <>
                <span className="block text-xs text-muted-foreground line-through">
                  {formatZar(item.original_price_cents ?? item.price_cents)}
                </span>
                <span className="block text-sm font-medium text-primary">
                  {formatZar(item.discounted_price_cents)}
                </span>
              </>
            )}
            {!item.discount_label && (
              <span className="block text-sm font-medium text-primary">
                {formatZar(item.price_cents)}
              </span>
            )}
          </div>
        </div>
        {item.description && (
          <p className="line-clamp-2 text-xs menu-description">{item.description}</p>
        )}
        {(item.labels.length > 0 || item.discount_label) && (
          <div className="flex flex-wrap gap-1 pt-1">
            {item.discount_label && (
              <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-[10px] font-medium text-destructive-foreground">
                {item.discount_label}
              </span>
            )}
            {item.labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-[color:var(--color-accent,var(--secondary))] px-2 py-0.5 text-[10px] font-medium text-[color:var(--accent-foreground,var(--secondary-foreground))]"
              >
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
