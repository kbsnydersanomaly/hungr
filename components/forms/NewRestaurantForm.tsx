"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createRestaurantAndSubscribe } from "@/lib/data/restaurant-actions";
import { isRedirectError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProvinceSelect } from "@/components/forms/ProvinceSelect";

type NewRestaurantFormProps = {
  orgId?: string;
  submitLabel?: string;
};

export function NewRestaurantForm({
  orgId,
  submitLabel = "Create restaurant",
}: NewRestaurantFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createRestaurantAndSubscribe(formData);
        if (!result.ok) {
          const message = result.message ?? "Something went wrong.";
          setError(message);
          toast.error(message);
        }
      } catch (err) {
        if (isRedirectError(err)) {
          return;
        }
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="orgId" value={orgId ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="name">Restaurant name</Label>
        <Input id="name" name="name" placeholder="e.g. Acme Cafe" required disabled={isPending} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="street">Street address</Label>
        <Input id="street" name="street" placeholder="123 Main St" disabled={isPending} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" placeholder="Cape Town" disabled={isPending} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">Province</Label>
          <ProvinceSelect disabled={isPending} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
