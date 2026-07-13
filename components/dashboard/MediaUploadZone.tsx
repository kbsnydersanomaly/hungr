"use client";

import { useState, useCallback, useRef } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { recordMediaUpload } from "@/lib/data/media-actions";
import { formatBytes } from "@/lib/utils/bytes";
import { Progress } from "@/components/ui/progress";
import { ImagePlus, Loader2, CheckCircle2, XCircle, Circle } from "lucide-react";
import { toast } from "sonner";

export interface UploadedMediaItem {
  id: string;
  url: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
}

type QueueItemState = "pending" | "uploading" | "done" | "failed";

interface QueueItem {
  id: string;
  name: string;
  state: QueueItemState;
  error?: string;
}

interface MediaUploadZoneProps {
  restaurantId: string;
  /** Called after each successful upload with the new media record. */
  onUploaded?: (item: UploadedMediaItem) => void;
  /**
   * Called once when the whole batch finishes and at least one file uploaded
   * successfully, with the success/failure counts. Use this to close dialogs /
   * refresh, so a multi-file batch isn't cut short after the first file — and
   * keep the dialog open when `failed > 0` so per-file errors stay visible.
   */
  onUploadComplete?: (result: { succeeded: number; failed: number }) => void;
  /**
   * Remaining storage for this restaurant, in bytes. When set, a batch whose
   * total size exceeds this is blocked client-side before hitting storage.
   * The server still enforces the quota authoritatively in `recordMediaUpload`.
   */
  remainingBytes?: number;
}

/**
 * The drag-and-drop / click-to-upload control. Kept dialog-free so it can be
 * embedded inline (e.g. inside the media picker) or wrapped in a dialog
 * (see MediaUploadDialog) without nesting modals.
 *
 * Supports selecting/dropping multiple files: they upload sequentially with a
 * per-file queue (pending / uploading / done / failed) so one corrupt file
 * fails without aborting the rest of the batch.
 */
export function MediaUploadZone({
  restaurantId,
  onUploaded,
  onUploadComplete,
  remainingBytes,
}: MediaUploadZoneProps) {
  const [uploading, setUploading] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // Guards against a second batch starting mid-flight (the drop handler's
  // `uploading` state check has a render-tick window).
  const busyRef = useRef(false);

  const uploadOne = useCallback(
    async (
      supabase: ReturnType<typeof createBrowserClient>,
      file: File
    ): Promise<UploadedMediaItem> => {
      const dotIndex = file.name.lastIndexOf(".");
      const ext = dotIndex > 0 ? file.name.slice(dotIndex + 1) : "png";
      const path = `${restaurantId}/${crypto.randomUUID()}.${ext}`;
      const bucket = "menu-media";

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

      return result.data.media;
    },
    [restaurantId]
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;
      if (busyRef.current) return;
      busyRef.current = true;

      try {
        // Per-file type check, same rule as the single-file path. Invalid files
        // enter the queue as failed so the user sees a per-file error, while the
        // valid ones still upload.
        const entries: { id: string; name: string; file: File | null; error?: string }[] =
          files.map((file) => {
            const id = crypto.randomUUID();
            if (!file.type.startsWith("image/")) {
              return { id, name: file.name, file: null, error: "Only image files are allowed." };
            }
            return { id, name: file.name, file };
          });

        const valid = entries.filter((e) => e.file != null);

        // Batch storage pre-check: fail fast before uploading anything if the
        // whole batch would exceed the restaurant's remaining quota.
        if (valid.length > 0 && remainingBytes != null) {
          const totalBytes = valid.reduce((sum, e) => sum + (e.file?.size ?? 0), 0);
          if (totalBytes > remainingBytes) {
            // Clear any results from a previous batch so they don't linger.
            setQueue([]);
            toast.error(
              `Not enough storage. ${valid.length === 1 ? "This file is" : `These ${valid.length} files are`} ${formatBytes(
                totalBytes
              )} but only ${formatBytes(Math.max(remainingBytes, 0))} remains.`
            );
            return;
          }
        }

        setQueue(
          entries.map((e) => ({
            id: e.id,
            name: e.name,
            state: e.file ? "pending" : "failed",
            error: e.error,
          }))
        );

        if (valid.length === 0) {
          toast.error("Only image files are allowed.");
          return;
        }

        const setItemState = (id: string, state: QueueItemState, error?: string) =>
          setQueue((prev) =>
            prev.map((item) => (item.id === id ? { ...item, state, error } : item))
          );

        setUploading(true);

        const supabase = createBrowserClient();
        let succeeded = 0;
        let failedCount = entries.length - valid.length;
        let lastError: string | undefined;

        // Sequential uploads: simple and avoids hammering storage with a burst.
        for (const entry of valid) {
          if (!entry.file) continue;
          setItemState(entry.id, "uploading");
          try {
            const media = await uploadOne(supabase, entry.file);
            setItemState(entry.id, "done");
            succeeded += 1;
            onUploaded?.(media);
          } catch (err) {
            console.error("Upload failed:", err);
            lastError = err instanceof Error ? err.message : "Upload failed.";
            setItemState(entry.id, "failed", lastError);
            failedCount += 1;
          }
        }

        setUploading(false);

        const total = entries.length;
        if (failedCount > 0) {
          toast.error(
            total === 1
              ? lastError ?? "Upload failed."
              : `${failedCount} of ${total} uploads failed.`
          );
        } else {
          toast.success(
            total === 1
              ? "Image uploaded successfully."
              : `${total} images uploaded successfully.`
          );
        }

        if (succeeded > 0) onUploadComplete?.({ succeeded, failed: failedCount });
      } finally {
        busyRef.current = false;
      }
    },
    [uploadOne, onUploaded, onUploadComplete, remainingBytes]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Clear the value so the same files can be re-picked later.
      e.target.value = "";
    }
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (uploading) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles, uploading]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const total = queue.length;
  const doneCount = queue.filter((item) => item.state === "done").length;
  const settledCount = queue.filter(
    (item) => item.state === "done" || item.state === "failed"
  ).length;

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
          multiple
          onChange={onFileChange}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={uploading}
        />
      </div>

      {total > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading
              ? `Uploading... ${doneCount} of ${total} uploaded`
              : `${doneCount} of ${total} uploaded`}
          </div>
          <Progress value={total > 0 ? (settledCount / total) * 100 : 0} className="h-2" />
          <ul className="space-y-1">
            {queue.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-xs">
                {item.state === "uploading" && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                )}
                {item.state === "done" && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                )}
                {item.state === "failed" && (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                )}
                {item.state === "pending" && (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{item.name}</span>
                {item.state === "failed" && item.error && (
                  <span className="truncate text-destructive">— {item.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
