"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createMenu } from "@/lib/data/menu-actions";
import { isRedirectError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateMenuFormProps {
  restaurantId: string;
}

export function CreateMenuForm({ restaurantId }: CreateMenuFormProps) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await createMenu(restaurantId, formData);
        if (!result.ok) {
          toast.error(result.message ?? "Failed to create menu.");
        }
      } catch (err) {
        if (isRedirectError(err)) {
          return;
        }
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Menu name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Lunch, Dinner, Brunch"
          required
          disabled={isPending}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Create menu
      </Button>
    </form>
  );
}
