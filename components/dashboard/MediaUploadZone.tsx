"use client";

import { useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { recordMediaUpload } from "@/lib/data/media-actions";
import { formatBytes } from "@/lib/utils/bytes";
import { Progress } from "@/components/ui/progress";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface UploadedMediaItem {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

interface MediaUploadZoneProps {
  restaurantId: string;
  /** Called after a successful upload with the new media record. */
  onUploaded?: (item: UploadedMediaItem) => void;
  /**
   * Remaining storage for this restaurant, in bytes. When set, uploads larger
   * than this are blocked client-side before hitting storage. The server still
   * enforces the quota authoritatively in `recordMediaUpload`.
   */
  remainingBytes?: number;
}

/**
 * The drag-and-drop / click-to-upload control. Kept dialog-free so it can be
 * embedded inline (e.g. inside the media picker) or wrapped in a dialog
 * (see MediaUploadDialog) without nesting modals.
 */
export function MediaUploadZone({
  restaurantId,
  onUploaded,
  remainingBytes,
}: MediaUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Only image files are allowed.");
        return;
      }

      if (remainingBytes != null && file.size > remainingBytes) {
        toast.error(
          `Not enough storage. This file is ${formatBytes(file.size)} but only ${formatBytes(
            Math.max(remainingBytes, 0)
          )} remains.`
        );
        return;
      }

      setUploading(true);
      setProgress(0);

      try {
        const ext = file.name.split(".").pop() || "png";
        const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
        const bucket = "menu-media";

        const supabase = createBrowserClient();

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);

        const formData = new FormData();
        formData.set("bucket", bucket);
        formData.set("path", path);
        formData.set("url", publicUrlData.publicUrl);
        formData.set("name", file.name);
        formData.set("mime", file.type);
        formData.set("size", String(file.size));

        const result = await recordMediaUpload(restaurantId, formData);
        if (!result.ok || !result.data) {
          throw new Error(
            (!result.ok && result.message) || "Failed to record upload."
          );
        }

        toast.success("Image uploaded successfully.");
        onUploaded?.(result.data.media);
      } catch (err) {
        console.error("Upload failed:", err);
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [restaurantId, onUploaded, remainingBytes]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/20"}
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <ImagePlus className="h-10 w-10 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Click to upload</span> or
          drag and drop
        </div>
        <div className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</div>
        <input
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={uploading}
        />
      </div>

      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  );
}
