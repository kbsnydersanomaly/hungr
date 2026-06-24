"use client";

import { useState } from "react";
import { createPlan, updatePlan } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/lib/database.types";

type Plan = Database["public"]["Tables"]["plans"]["Row"];

interface PlanDialogProps {
  plan?: Plan;
}

export function PlanDialog({ plan }: PlanDialogProps) {
  const isEdit = !!plan;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = isEdit && plan
      ? await updatePlan(plan.id, formData)
      : await createPlan(formData);

    if (result.ok) {
      toast.success(isEdit ? "Plan updated." : "Plan created.");
      setOpen(false);
      window.location.reload();
    } else {
      toast.error(result.message ?? "Failed to save plan.");
    }

    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? (
            <Button size="icon" variant="ghost" className="h-8 w-8" type="button">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button size="sm" type="button">
              <Plus className="h-4 w-4 mr-2" />
              Add plan
            </Button>
          )
        }
      />
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit plan" : "Add plan"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update plan details." : "Create a new billing plan."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="plan-name">Name</Label>
            <Input
              id="plan-name"
              name="name"
              defaultValue={plan?.name ?? ""}
              required
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="plan-slug">Slug</Label>
              <Input
                id="plan-slug"
                name="slug"
                placeholder="starter"
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="plan-desc">Description</Label>
            <Textarea
              id="plan-desc"
              name="description"
              defaultValue={plan?.description ?? ""}
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Pricing model</Label>
              <Select
                name="pricing_model"
                defaultValue={plan?.pricing_model ?? "per_restaurant"}
                items={[
                  { value: "per_restaurant", label: "Per restaurant" },
                  { value: "flat_includes_n", label: "Flat (includes N)" },
                  { value: "custom", label: "Custom" },
                ]}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_restaurant">Per restaurant</SelectItem>
                  <SelectItem value="flat_includes_n">Flat (includes N)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="base-price">Base price (cents)</Label>
              <Input
                id="base-price"
                name="base_price_cents"
                type="number"
                min="0"
                defaultValue={plan?.base_price_cents ?? 0}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="discount">Discount %</Label>
              <Input
                id="discount"
                name="additional_discount_pct"
                type="number"
                min="0"
                max="100"
                defaultValue={plan?.additional_discount_pct ?? 0}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="included">Included restaurants</Label>
              <Input
                id="included"
                name="included_restaurants"
                type="number"
                min="0"
                defaultValue={plan?.included_restaurants ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Max restaurants</Label>
              <Input
                id="max"
                name="max_restaurants"
                type="number"
                min="0"
                defaultValue={plan?.max_restaurants ?? ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="features">Features (JSON)</Label>
            <Textarea
              id="features"
              name="features"
              defaultValue={JSON.stringify(plan?.features ?? {}, null, 2)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort-order">Sort order</Label>
            <Input
              id="sort-order"
              name="sort_order"
              type="number"
              min="0"
              defaultValue={plan?.sort_order ?? 0}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Active</p>
              <p className="text-xs text-muted-foreground">
                Show this plan on the pricing page
              </p>
            </div>
            <Switch
              name="active"
              defaultChecked={plan?.active ?? true}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Public</p>
              <p className="text-xs text-muted-foreground">
                Visible on the public pricing page
              </p>
            </div>
            <Switch
              name="is_public"
              defaultChecked={plan?.is_public ?? true}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Contact only</p>
              <p className="text-xs text-muted-foreground">
                Require sales contact instead of self-serve
              </p>
            </div>
            <Switch
              name="contact_only"
              defaultChecked={plan?.contact_only ?? false}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save changes" : "Create plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
