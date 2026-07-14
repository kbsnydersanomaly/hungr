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
import { ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";

interface MediaItem {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

interface MultiImagePickerProps {
  restaurantId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  /** Whether to highlight the first image as the cover. Defaults to true. */
  showCover?: boolean;
}

/**
 * Manages an ordered list of images for a gallery. By default the first image
 * is highlighted as the cover image; consumers that don't use a cover treatment
 * can disable it with `showCover={false}`.
 */
export function MultiImagePicker({
  restaurantId,
  value,
  onChange,
  showCover = true,
}: MultiImagePickerProps) {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

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

  function handleConfirm() {
    if (selectedItem && !value.includes(selectedItem.url)) {
      onChange([...value, selectedItem.url]);
    }
    setOpen(false);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {value.map((url, i) => (
            <div key={url} className="relative w-fit">
              <Image
                src={url}
                alt={`Image ${i + 1}`}
                width={168}
                height={112}
                className="h-28 w-42 aspect-3/2 object-cover rounded-lg border"
              />
              {showCover && i === 0 && (
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  Cover
                </span>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                aria-label="Remove image"
                onClick={() => removeAt(i)}
              >
                <X className="h-3 w-3" />
              </Button>
              {value.length > 1 && (
                <div className="absolute -bottom-2 right-1 flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-5 w-5"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-5 w-5"
                    disabled={i === value.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-28 w-42 aspect-3/2 items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger render={<Button variant="outline" size="sm" type="button" />}>
          Add image
        </DialogTrigger>
        <DialogContent className="w-[92vw] sm:max-w-4xl lg:max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add image</DialogTitle>
            <DialogDescription>
              Choose an image from your media library. Use a 3:2 landscape image
              (e.g. 1200×800px) so all menu items display consistently.
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
                onSelect={setSelectedItem}
                onRefresh={loadMedia}
                showUpload={false}
              />
            )
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)} type="button">
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedItem} type="button">
              Add image
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
