"use client";

import { useState } from "react";
import {
  deleteHelpMedia,
  type HelpMediaItem,
} from "@/lib/data/help-media-actions";
import { HelpMediaUploadZone } from "./HelpMediaUploadZone";
import { HelpMediaGrid } from "./HelpMediaGrid";
import { toast } from "sonner";

interface HelpMediaManagerProps {
  initialMedia: HelpMediaItem[];
}

/**
 * Standalone management view for the help media library — upload and delete
 * images independently of any single article. Used by /admin/help/media.
 */
export function HelpMediaManager({ initialMedia }: HelpMediaManagerProps) {
  const [media, setMedia] = useState<HelpMediaItem[]>(initialMedia);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(item: HelpMediaItem) {
    setDeletingId(item.id);
    try {
      const result = await deleteHelpMedia(item.id);
      if (!result.ok) {
        toast.error(result.message ?? "Failed to delete image.");
        return;
      }
      toast.success("Image deleted.");
      setMedia((prev) => prev.filter((m) => m.id !== item.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <HelpMediaUploadZone
        onUploaded={(item) => setMedia((prev) => [item, ...prev])}
      />
      <HelpMediaGrid
        items={media}
        onDelete={handleDelete}
        deletingId={deletingId}
      />
    </div>
  );
}
