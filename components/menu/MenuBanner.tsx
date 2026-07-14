"use client";

import { useState } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { formatSpecialLabel } from "@/lib/utils/specials";
import { cn } from "@/lib/utils";
import {
  SpecialDetailSheet,
  type SpecialDetailSheetSpecial,
} from "./SpecialDetailSheet";

interface BannerSpecial extends SpecialDetailSheetSpecial {
  image_url: string;
}

interface MenuBannerProps {
  bannerImageUrls: string[];
  specials: BannerSpecial[];
  restaurantSlug: string;
  menuSlug: string;
  items?: Array<{ id: string; name: string }>;
}

export function MenuBanner({
  bannerImageUrls,
  specials,
  restaurantSlug,
  menuSlug,
  items = [],
}: MenuBannerProps) {
  const [selectedSpecial, setSelectedSpecial] = useState<BannerSpecial | null>(
    null
  );

  const slides: (
    | { type: "image"; id: string; url: string }
    | { type: "special"; id: string; special: BannerSpecial }
  )[] = [
    ...bannerImageUrls.map((url, index) => ({
      type: "image" as const,
      id: `banner-${index}`,
      url,
    })),
    ...specials.map((special) => ({
      type: "special" as const,
      id: special.id,
      special,
    })),
  ];

  if (slides.length === 0) return null;

  const multipleSlides = slides.length > 1;

  return (
    <>
      <div className="px-4 pt-3 pb-1">
        <Swiper
          modules={multipleSlides ? [Pagination, Autoplay] : []}
          pagination={
            multipleSlides ? { clickable: true, dynamicBullets: true } : false
          }
          autoplay={
            multipleSlides
              ? { delay: 5000, disableOnInteraction: false }
              : undefined
          }
          spaceBetween={12}
          slidesPerView={1}
          className={cn(
            multipleSlides && "!pb-8",
            "[--swiper-theme-color:var(--primary)] [--swiper-pagination-bullet-inactive-color:var(--primary)]"
          )}
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.id}>
              {slide.type === "special" ? (
                <button
                  type="button"
                  onClick={() => setSelectedSpecial(slide.special)}
                  className="block w-full text-left"
                  aria-label={`View details for ${slide.special.title}`}
                >
                  <SpecialBannerSlide special={slide.special} />
                </button>
              ) : (
                <SpecialBannerSlide special={null} imageUrl={slide.url} />
              )}
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

function SpecialBannerSlide({
  special,
  imageUrl,
}: {
  special: BannerSpecial | null;
  imageUrl?: string;
}) {
  const label = special ? formatSpecialLabel(special) : null;
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted">
        {special ? (
          <>
            <Image
              src={special.image_url}
              alt={special.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="text-on-image absolute bottom-0 left-0 right-0 p-4">
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
              <span className="text-base font-bold drop-shadow">{special.title}</span>
              {special.description && (
                <span className="text-on-image-muted text-xs line-clamp-1 drop-shadow">
                  {special.description}
                </span>
              )}
            </div>
          </>
        ) : (
          <Image
            src={imageUrl!}
            alt="Restaurant banner"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        )}
      </div>
    </div>
  );
}
