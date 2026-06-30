"use client";

import { useState, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  recordHelpMediaUpload,
  type HelpMediaItem,
} from "@/lib/data/help-media-actions";
import { Progress } from "@/components/ui/progress";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BUCKET = "help-media";

interface HelpMediaUploadZoneProps {
  /** Called after a successful upload with the new media record. */
  onUploaded?: (item: HelpMediaItem) => void;
}

/**
 * Drag-and-drop / click-to-upload control for the platform help media library.
 * Uploads straight to the `help-media` storage bucket (super-admin RLS) and
 * records the result in `help_media` so it joins the reusable library —
 * the help-side counterpart to MediaUploadZone.
 */
export function HelpMediaUploadZone({ onUploaded }: HelpMediaUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Only image files are allowed.");
        return;
      }

      setUploading(true);
      try {
        const ext = file.name.split(".").pop() || "png";
        const path = `${crypto.randomUUID()}.${ext}`;
        const supabase = createBrowserClient();

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });

        if (uploadError) throw new Error(uploadError.message);

        const { data: publicUrlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);

        const formData = new FormData();
        formData.set("bucket", BUCKET);
        formData.set("path", path);
        formData.set("url", publicUrlData.publicUrl);
        formData.set("name", file.name);
        formData.set("mime", file.type);
        formData.set("size", String(file.size));

        const result = await recordHelpMediaUpload(formData);
        if (!result.ok || !result.data) {
          throw new Error(
            (!result.ok && result.message) || "Failed to record upload."
          );
        }

        toast.success("Image uploaded.");
        onUploaded?.(result.data.media);
      } catch (err) {
        console.error("Help media upload failed:", err);
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  return (
    <div className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
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
          <Progress className="h-2" />
        </div>
      )}
    </div>
  );
}
