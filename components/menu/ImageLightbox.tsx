"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ZoomIn } from "lucide-react";

interface ImageLightboxProps {
  src: string;
  alt: string;
}

export function ImageLightbox({ src, alt }: ImageLightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="relative aspect-video w-full overflow-hidden rounded-xl group cursor-zoom-in text-left"
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 600px"
          className="object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <ZoomIn className="h-8 w-8 text-white drop-shadow" />
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background border-0" showCloseButton={true}>
        <div className="relative aspect-video w-full">
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 800px"
            priority
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
