"use client";

import { useState } from "react";
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
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await createRestaurantAndSubscribe(formData);
      if (!result.ok) {
        setError(result.message ?? "Something went wrong.");
      }
    } catch (err) {
      if (isRedirectError(err)) {
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="orgId" value={orgId ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="name">Restaurant name</Label>
        <Input id="name" name="name" placeholder="e.g. Acme Cafe" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="street">Street address</Label>
        <Input id="street" name="street" placeholder="123 Main St" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" placeholder="Cape Town" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="province">Province</Label>
          <ProvinceSelect />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
