"use client";

import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecialsSliderProps {
  specials: Array<{
    id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    discount_pct: number | null;
    discount_amount_cents: number | null;
    discount_type: string | null;
    combo_price_cents: number | null;
    kind: string;
  }>;
}

export function SpecialsSlider({ specials }: SpecialsSliderProps) {
  if (specials.length === 0) return null;

  const multipleSpecials = specials.length > 1;

  return (
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
                    <span className="inline-flex items-center rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase">
                      {special.kind === "combo" ? "Combo" : "Special"}
                    </span>
                    {special.kind === "combo" && special.combo_price_cents ? (
                      <span className="text-xs font-bold drop-shadow">
                        R {(special.combo_price_cents / 100).toFixed(2)}
                      </span>
                    ) : special.discount_pct ? (
                      <span className="text-xs font-bold drop-shadow">
                        {special.discount_pct}% off
                      </span>
                    ) : special.discount_amount_cents ? (
                      <span className="text-xs font-bold drop-shadow">
                        R {(special.discount_amount_cents / 100).toFixed(2)} off
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-sm font-bold drop-shadow">{special.title}</h3>
                </div>
              </div>
              {special.description && (
                <div className="p-3">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {special.description}
                  </p>
                </div>
              )}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
