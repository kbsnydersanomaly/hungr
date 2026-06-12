"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { listMediaForRestaurant } from "@/lib/data/media-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MediaLibrary, MediaLibrarySkeleton } from "./MediaLibrary";
import { MediaUploadZone } from "./MediaUploadZone";
import { ImageIcon, X } from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

// Recommended dimensions per upload context. Menu item/special imagery is
// 3:2; logos are wide-and-short so they fit the public menu nav.
const ASPECT_PRESETS = {
  "3/2": {
    previewClass: "aspect-3/2 h-32 w-48",
    hint: "Use a 3:2 landscape image (e.g. 1200×800px) so it displays consistently on the menu.",
  },
  logo: {
    previewClass: "aspect-3/1 h-20 w-60 object-contain bg-muted",
    hint: "Use a wide logo around 3:1 (e.g. 600×200px) so it fits comfortably in the menu header.",
  },
  square: {
    previewClass: "aspect-square h-32 w-32",
    hint: "Use a square image (e.g. 800×800px).",
  },
} as const;

export type MediaAspect = keyof typeof ASPECT_PRESETS;

interface MediaPickerProps {
  restaurantId: string;
  value?: string | null;
  onChange: (url: string | null, mediaId?: string | null) => void;
  /** Which dimensions this image is for — controls the preview shape and the size hint. */
  aspect?: MediaAspect;
}

export function MediaPicker({
  restaurantId,
  value,
  onChange,
  aspect = "3/2",
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const preset = ASPECT_PRESETS[aspect];

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listMediaForRestaurant(restaurantId);
      setMedia(data);
    } catch {
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  function handleOpenChange(open: boolean) {
    setOpen(open);
    if (open) {
      loadMedia();
      setSelectedItem(null);
    }
  }

  function handleSelect(item: MediaItem) {
    setSelectedItem(item);
  }

  function handleConfirm() {
    if (selectedItem) {
      onChange(selectedItem.url, selectedItem.id);
    }
    setOpen(false);
  }

  function handleClear() {
    onChange(null, null);
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-fit">
          <Image
            src={value}
            alt="Selected"
            width={240}
            height={160}
            className={`object-cover rounded-lg border ${preset.previewClass}`}
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div
          className={`flex items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted ${preset.previewClass}`}
        >
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={<Button variant="outline" size="sm" type="button" />}>
          {value ? "Change image" : "Select image"}
        </DialogTrigger>
        <DialogContent className="w-[92vw] sm:max-w-4xl lg:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select image</DialogTitle>
            <DialogDescription>
              Choose an image from your media library. {preset.hint}
            </DialogDescription>
          </DialogHeader>

          <MediaUploadZone
            restaurantId={restaurantId}
            onUploaded={(item) => {
              setSelectedItem(item);
              loadMedia();
            }}
          />

          {loading ? (
            <MediaLibrarySkeleton />
          ) : (
            media.length > 0 && (
              <MediaLibrary
                restaurantId={restaurantId}
                media={media}
                selectable
                selectedId={selectedItem?.id ?? null}
                onSelect={handleSelect}
                onRefresh={loadMedia}
                showUpload={false}
              />
            )
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!selectedItem}
              type="button"
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
