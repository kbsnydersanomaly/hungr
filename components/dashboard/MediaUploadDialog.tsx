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
}

export function MediaUploadDialog({
  restaurantId,
  children,
  onUpload,
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
          onUploaded={() => {
            setOpen(false);
            onUpload?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
