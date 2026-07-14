"use client";

import { useState } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { Sparkles } from "lucide-react";
import { formatSpecialLabel } from "@/lib/utils/specials";
import { cn } from "@/lib/utils";
import {
  SpecialDetailSheet,
  type SpecialDetailSheetSpecial,
} from "./SpecialDetailSheet";

interface SpecialsSliderProps {
  specials: SpecialDetailSheetSpecial[];
  restaurantSlug: string;
  menuSlug: string;
  items?: Array<{ id: string; name: string }>;
}

export function SpecialsSlider({
  specials,
  restaurantSlug,
  menuSlug,
  items = [],
}: SpecialsSliderProps) {
  const [selectedSpecial, setSelectedSpecial] =
    useState<SpecialDetailSheetSpecial | null>(null);

  if (specials.length === 0) return null;

  const multipleSpecials = specials.length > 1;

  return (
    <>
      <div className="py-3">
        <div className="flex items-center gap-2 mb-3 px-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Specials
          </h2>
        </div>
        <Swiper
          modules={multipleSpecials ? [Pagination, Autoplay] : []}
          pagination={
            multipleSpecials ? { clickable: true, dynamicBullets: true } : false
          }
          autoplay={
            multipleSpecials
              ? { delay: 5000, disableOnInteraction: false }
              : undefined
          }
          spaceBetween={0}
          slidesPerView={1}
          className={cn(
            multipleSpecials && "!pb-8",
            "[--swiper-theme-color:var(--primary)] [--swiper-pagination-bullet-inactive-color:var(--primary)]"
          )}
        >
          {specials.map((special) => (
            <SwiperSlide key={special.id}>
              <button
                type="button"
                onClick={() => setSelectedSpecial(special)}
                className="block w-full text-left"
                aria-label={`View details for ${special.title}`}
              >
                <SpecialSliderCard special={special} />
              </button>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <SpecialDetailSheet
        special={selectedSpecial}
        open={!!selectedSpecial}
        onOpenChange={(open) => {
          if (!open) setSelectedSpecial(null);
        }}
        restaurantSlug={restaurantSlug}
        menuSlug={menuSlug}
        items={items}
      />
    </>
  );
}

function SpecialSliderCard({
  special,
}: {
  special: SpecialDetailSheetSpecial;
}) {
  const label = formatSpecialLabel(special);
  return (
    <div className="relative overflow-hidden bg-card">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {special.image_url ? (
          <Image
            src={special.image_url}
            alt={special.title}
            fill
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <Sparkles className="h-8 w-8 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="text-on-image absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-md bg-[color:var(--color-accent,var(--secondary))] px-2 py-0.5 text-[10px] font-bold text-[color:var(--accent-foreground,var(--secondary-foreground))] uppercase">
              {special.kind === "combo" ? "Combo" : "Special"}
            </span>
            {label && (
              <span className="text-xs font-bold drop-shadow">
                {label}
              </span>
            )}
          </div>
          <span className="text-sm font-bold drop-shadow">{special.title}</span>
        </div>
      </div>
      {special.description && (
        <div className="p-3">
          <span className="text-xs menu-description line-clamp-2">{special.description}</span>
        </div>
      )}
    </div>
  );
}
