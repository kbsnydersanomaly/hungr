"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRestaurantStorageLimit } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";

interface RestaurantStorageEditDialogProps {
  restaurantId: string;
  storageLimitMb: number;
}

export function RestaurantStorageEditDialog({
  restaurantId,
  storageLimitMb,
}: RestaurantStorageEditDialogProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Edit storage limit</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit storage limit</DialogTitle>
        </DialogHeader>
        <ServerActionForm
          action={async (formData) => {
            return updateRestaurantStorageLimit(restaurantId, formData);
          }}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
          successMessage="Storage limit updated."
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="storage_limit_mb">Storage limit (MB)</Label>
              <Input
                id="storage_limit_mb"
                name="storage_limit_mb"
                type="number"
                min={1}
                step={1}
                defaultValue={storageLimitMb}
                required
              />
            </div>
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ServerActionForm>
      </DialogContent>
    </Dialog>
  );
}
