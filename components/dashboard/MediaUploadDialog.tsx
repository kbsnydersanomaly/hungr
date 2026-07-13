"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MediaUploadZone } from "./MediaUploadZone";
import { Upload } from "lucide-react";

interface MediaUploadDialogProps {
  restaurantId: string;
  children?: React.ReactNode;
  onUpload?: () => void;
  /** Remaining storage for this restaurant, in bytes (for upload preflight). */
  remainingBytes?: number;
}

export function MediaUploadDialog({
  restaurantId,
  children,
  onUpload,
  remainingBytes,
}: MediaUploadDialogProps) {
  const [open, setOpen] = useState(false);

  const triggerElement = (children ?? (
    <Button size="sm">
      <Upload className="h-4 w-4 mr-2" />
      Upload
    </Button>
  )) as React.ReactElement;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload image</DialogTitle>
          <DialogDescription>
            Drag and drop an image or click to browse.
          </DialogDescription>
        </DialogHeader>

        <MediaUploadZone
          restaurantId={restaurantId}
          remainingBytes={remainingBytes}
          onUploadComplete={({ failed }) => {
            // Keep the dialog open when some files failed so the per-file
            // errors stay readable; the user can close it manually. Succeeded
            // files already refreshed the grid via revalidatePath in
            // recordMediaUpload.
            if (failed > 0) return;
            setOpen(false);
            onUpload?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
