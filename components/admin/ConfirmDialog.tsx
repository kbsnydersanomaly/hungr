"use client";

import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { VariantProps } from "class-variance-authority";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void | Promise<void>;
  children: React.ReactElement;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  confirmVariant = "destructive",
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
