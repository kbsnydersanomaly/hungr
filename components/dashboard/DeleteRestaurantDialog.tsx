"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteRestaurant } from "@/lib/data/restaurant-actions";
import { isRedirectError } from "@/lib/errors";

interface DeleteRestaurantDialogProps {
  restaurantId: string;
  restaurantName: string;
}

export function DeleteRestaurantDialog({
  restaurantId,
  restaurantName,
}: DeleteRestaurantDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [isPending, startTransition] = useTransition();

  const confirmed = confirmation === restaurantName;

  function handleDelete() {
    if (!confirmed) return;
    startTransition(async () => {
      try {
        const result = await deleteRestaurant(restaurantId);
        if (result && !result.ok) {
          toast.error(result.message ?? "Failed to delete restaurant.");
        }
        // On success the server action redirects to /restaurants.
      } catch (err) {
        if (isRedirectError(err)) return;
        toast.error("Something went wrong.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmation("");
      }}
    >
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 className="h-4 w-4 mr-2" />
        Delete this restaurant
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {restaurantName}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the restaurant along with all of its
            menus, menu items, media (including uploaded images), reviews and
            branding. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-restaurant-confirm">
            Type <span className="font-medium">{restaurantName}</span> to
            confirm
          </Label>
          <Input
            id="delete-restaurant-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={restaurantName}
            autoComplete="off"
            disabled={isPending}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!confirmed || isPending}
            onClick={handleDelete}
          >
            {isPending ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
