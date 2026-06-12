"use client";

import Link from "next/link";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { formatZar } from "@/lib/utils/money";
import { trackEvent } from "@/lib/analytics/track";

interface RecommendedCardProps {
  item: {
    id: string;
    name: string;
    price_cents: number;
    image_url: string | null;
    image_urls: string[];
  };
  restaurantSlug: string;
  menuSlug: string;
  menuId: string;
}

/**
 * "You might also like" tile: the item's cover image with the name and price
 * overlaid on a darkening gradient. Intentionally shows no labels/description.
 */
export function RecommendedCard({
  item,
  restaurantSlug,
  menuSlug,
  menuId,
}: RecommendedCardProps) {
  const image = item.image_url || item.image_urls?.[0];

  return (
    <Link
      href={`/m/${restaurantSlug}/${menuSlug}/item/${item.id}`}
      onClick={() => {
        trackEvent({ menuId, itemId: item.id, eventType: "click" });
      }}
      className="group relative block aspect-3/2 overflow-hidden rounded-xl border bg-muted"
    >
      {image ? (
        <Image
          src={image}
          alt={item.name}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 600px) 50vw, 300px"
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="text-sm font-semibold leading-tight text-white">
          {item.name}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-white/90">
          {formatZar(item.price_cents)}
        </p>
      </div>
    </Link>
  );
}
