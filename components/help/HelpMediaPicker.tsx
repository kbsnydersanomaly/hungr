"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  listHelpMedia,
  deleteHelpMedia,
  type HelpMediaItem,
} from "@/lib/data/help-media-actions";
import { HelpMediaUploadZone } from "./HelpMediaUploadZone";
import { HelpMediaGrid } from "./HelpMediaGrid";
import { ImageIcon, X } from "lucide-react";
import { toast } from "sonner";

interface HelpMediaPickerProps {
  /** Form field name the selected URLs are submitted under. */
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string[];
  disabled?: boolean;
}

/**
 * Reusable help media library picker for article screenshots. Lets super
 * admins browse, upload to, and delete from the platform `help_media` library,
 * then attach one or more images to an article. Selected URLs are submitted as
 * a newline-joined hidden field (the server splits on newlines), so the
 * existing help article server action is unchanged.
 */
export function HelpMediaPicker({
  name,
  label,
  hint,
  defaultValue = [],
  disabled = false,
}: HelpMediaPickerProps) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<HelpMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      setMedia(await listHelpMedia());
    } catch {
      setMedia([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) loadMedia();
  }

  function toggle(item: HelpMediaItem) {
    setSelected((prev) =>
      prev.includes(item.url)
        ? prev.filter((u) => u !== item.url)
        : [...prev, item.url]
    );
  }

  function removeAt(index: number) {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  }

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
      setSelected((prev) => prev.filter((u) => u !== item.url));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {/* Submitted as a single newline-joined field (server splits on newlines). */}
      <input type="hidden" name={name} value={selected.join("\n")} />

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {selected.map((url, i) => (
            <div key={url} className="relative w-fit">
              <Image
                src={url}
                alt={`Screenshot ${i + 1}`}
                width={168}
                height={112}
                className="h-28 w-42 aspect-3/2 rounded-lg border object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -right-2 -top-2 h-6 w-6"
                onClick={() => removeAt(i)}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-28 w-42 aspect-3/2 items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted">
          <ImageIcon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" type="button" disabled={disabled} />
          }
        >
          {selected.length > 0 ? "Manage images" : "Add images"}
        </DialogTrigger>
        <DialogContent className="w-[92vw] max-h-[85vh] overflow-y-auto sm:max-w-4xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Help media library</DialogTitle>
            <DialogDescription>
              Upload new images or pick from previously uploaded ones. Click an
              image to attach or detach it from this article.
            </DialogDescription>
          </DialogHeader>

          <HelpMediaUploadZone
            onUploaded={(item) => {
              setMedia((prev) => [item, ...prev]);
              setSelected((prev) =>
                prev.includes(item.url) ? prev : [...prev, item.url]
              );
            }}
          />

          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : (
            <HelpMediaGrid
              items={media}
              selectedUrls={selected}
              onToggle={toggle}
              onDelete={handleDelete}
              deletingId={deletingId}
            />
          )}

          <div className="flex justify-end pt-2">
            <Button type="button" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
