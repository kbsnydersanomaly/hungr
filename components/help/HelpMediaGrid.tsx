"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import type { HelpMediaItem } from "@/lib/data/help-media-actions";
import { Check, Trash2 } from "lucide-react";

interface HelpMediaGridProps {
  items: HelpMediaItem[];
  /** URLs currently selected — shows a checkmark overlay when selectable. */
  selectedUrls?: string[];
  /** Clicking a tile toggles selection. When omitted, tiles are not selectable. */
  onToggle?: (item: HelpMediaItem) => void;
  /** Enables a per-tile delete button with a confirm dialog. */
  onDelete?: (item: HelpMediaItem) => void;
  deletingId?: string | null;
}

export function HelpMediaGrid({
  items,
  selectedUrls = [],
  onToggle,
  onDelete,
  deletingId,
}: HelpMediaGridProps) {
  const [pendingDelete, setPendingDelete] = useState<HelpMediaItem | null>(null);
  const selectable = Boolean(onToggle);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No images yet. Upload one to get started.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => {
          const selected = selectedUrls.includes(item.url);
          return (
            <div key={item.id} className="group relative">
              <button
                type="button"
                onClick={() => onToggle?.(item)}
                disabled={!selectable}
                className={`
                  relative block aspect-3/2 w-full overflow-hidden rounded-lg border bg-muted transition-all
                  ${selectable ? "cursor-pointer hover:ring-2 hover:ring-primary/50" : "cursor-default"}
                  ${selected ? "ring-2 ring-primary" : ""}
                `}
              >
                <Image
                  src={item.url}
                  alt={item.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>

              {onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -right-2 -top-2 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => setPendingDelete(item)}
                  disabled={deletingId === item.id}
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete image?</DialogTitle>
            <DialogDescription>
              This permanently removes “{pendingDelete?.name}” from the help media
              library and storage. Articles still referencing it will show a
              broken image.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete) onDelete?.(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
