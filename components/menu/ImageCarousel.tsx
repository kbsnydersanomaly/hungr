"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./ImageLightbox";

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

/**
 * Scroll-snap carousel for menu item images. Falls back to a single
 * lightbox image when there is only one.
 */
export function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) return null;
  if (images.length === 1) return <ImageLightbox src={images[0]} alt={alt} />;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.min(index, images.length - 1));
  }

  function scrollTo(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="space-y-2">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex w-full snap-x snap-mandatory overflow-x-auto rounded-xl scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, i) => (
          <div key={src} className="w-full shrink-0 snap-center">
            <ImageLightbox src={src} alt={`${alt} (${i + 1} of ${images.length})`} />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5">
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            aria-label={`Go to image ${i + 1}`}
            onClick={() => scrollTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === activeIndex
                ? "w-4 bg-primary"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
