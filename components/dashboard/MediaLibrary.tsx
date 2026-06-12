"use client";

import { useState } from "react";
import Image from "next/image";
import { deleteMedia } from "@/lib/data/media-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaUploadDialog } from "./MediaUploadDialog";
import { Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface MediaItem {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

interface MediaLibraryProps {
  restaurantId: string;
  media: MediaItem[];
  selectable?: boolean;
  selectedId?: string | null;
  onSelect?: (item: MediaItem) => void;
  onRefresh?: () => void;
  /**
   * Show the built-in "Upload" dialog button in the header. Disable when the
   * parent already provides its own upload control (e.g. the media picker) to
   * avoid stacking dialogs.
   */
  showUpload?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function MediaLibrary({
  restaurantId,
  media,
  selectable,
  selectedId,
  onSelect,
  onRefresh,
  showUpload = true,
}: MediaLibraryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(item: MediaItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${item.name}"?`)) return;

    setDeletingId(item.id);
    try {
      await deleteMedia(item.id);
      toast.success("Image deleted.");
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  if (media.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">0 images</h3>
          {showUpload && (
            <MediaUploadDialog restaurantId={restaurantId} onUpload={onRefresh} />
          )}
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No images yet. Upload your first image.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          {media.length} image{media.length === 1 ? "" : "s"}
        </h3>
        {showUpload && (
          <MediaUploadDialog restaurantId={restaurantId} onUpload={onRefresh} />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {media.map((item) => {
          const isSelected = selectedId === item.id;
          return (
            <div
              key={item.id}
              onClick={() => selectable && onSelect?.(item)}
              className={`
                group relative aspect-square overflow-hidden rounded-lg border bg-muted cursor-pointer transition-all
                ${isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:border-primary/50"}
                ${selectable ? "" : "cursor-default"}
              `}
            >
              <Image
                src={item.url}
                alt={item.name}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-xs text-white truncate">{item.name}</p>
                <p className="text-[10px] text-white/70">{formatBytes(item.size)}</p>
              </div>

              {!selectable && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => handleDelete(item, e)}
                  disabled={deletingId === item.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}

              {isSelected && (
                <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                  Selected
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MediaLibrarySkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}
