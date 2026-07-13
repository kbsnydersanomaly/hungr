"use client";

import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { cn } from "@/lib/utils";

interface BannerSpecial {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  discount_pct: number | null;
  discount_amount_cents: number | null;
  discount_type: string | null;
  combo_price_cents: number | null;
  kind: string;
}

interface MenuBannerProps {
  bannerImageUrls: string[];
  specials: BannerSpecial[];
}

function formatDiscountLabel(special: BannerSpecial): string | null {
  if (special.kind === "combo" && special.combo_price_cents) {
    return `Combo · R ${(special.combo_price_cents / 100).toFixed(2)}`;
  }
  if (special.discount_pct) {
    return `${special.discount_pct}% off`;
  }
  if (special.discount_amount_cents) {
    return `R ${(special.discount_amount_cents / 100).toFixed(2)} off`;
  }
  return null;
}

export function MenuBanner({ bannerImageUrls, specials }: MenuBannerProps) {
  const slides: (
    | { type: "image"; id: string; url: string }
    | { type: "special"; id: string; special: BannerSpecial }
  )[] = [
    ...bannerImageUrls.map((url, index) => ({ type: "image" as const, id: `banner-${index}`, url })),
    ...specials.map((special) => ({ type: "special" as const, id: special.id, special })),
  ];

  if (slides.length === 0) return null;

  const multipleSlides = slides.length > 1;

  return (
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
            <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted">
                {slide.type === "image" ? (
                  <Image
                    src={slide.url}
                    alt="Restaurant banner"
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority
                  />
                ) : (
                  <>
                    <Image
                      src={slide.special.image_url}
                      alt={slide.special.title}
                      fill
                      className="object-cover"
                      sizes="100vw"
                      priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="text-on-image absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-md bg-[color:var(--color-accent,var(--secondary))] px-2 py-0.5 text-[10px] font-bold text-[color:var(--accent-foreground,var(--secondary-foreground))] uppercase">
                          {slide.special.kind === "combo" ? "Combo" : "Special"}
                        </span>
                        {formatDiscountLabel(slide.special) && (
                          <span className="text-xs font-bold drop-shadow">
                            {formatDiscountLabel(slide.special)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold drop-shadow">
                        {slide.special.title}
                      </h3>
                      {slide.special.description && (
                        <p className="text-on-image-muted text-xs line-clamp-1 drop-shadow">
                          {slide.special.description}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
