"use client";

import { useState } from "react";
import { createSpecial, updateSpecial } from "@/lib/data/special-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PriceInput } from "@/components/forms/PriceInput";
import { EditorSheet } from "./EditorSheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MediaPicker } from "./MediaPicker";
import { SpecialTargetSelector } from "./SpecialTargetSelector";
import { saveSpecialTargets } from "@/lib/data/special-target-actions";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Special {
  id: string;
  title: string;
  description: string | null;
  kind: "item_discount" | "category_discount" | "combo";
  discount_type: "percentage" | "fixed" | null;
  discount_amount_cents: number | null;
  discount_pct: number | null;
  combo_price_cents: number | null;
  date_from: string | null;
  date_to: string | null;
  time_from: string | null;
  time_to: string | null;
  selected_days: string[] | null;
  priority: number;
  active: boolean;
  image_url: string | null;
  menu_id: string | null;
}

interface SpecialEditorProps {
  restaurantId: string;
  menus: { id: string; name: string }[];
  special?: Special | null;
  children?: React.ReactNode;
  onSaved?: () => void;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const KIND_ITEMS = [
  { value: "item_discount", label: "Item discount" },
  { value: "category_discount", label: "Category discount" },
  { value: "combo", label: "Combo" },
];

const DISCOUNT_TYPE_ITEMS = [
  { value: "percentage", label: "Percentage" },
  { value: "fixed", label: "Fixed amount" },
];

export function SpecialEditor({
  restaurantId,
  menus,
  special,
  children,
  onSaved,
}: SpecialEditorProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!special;

  const [title, setTitle] = useState(special?.title ?? "");
  const [description, setDescription] = useState(special?.description ?? "");
  const [kind, setKind] = useState<Special["kind"]>(special?.kind ?? "item_discount");
  const [discountType, setDiscountType] = useState<Special["discount_type"]>(
    special?.discount_type ?? "percentage"
  );
  const [discountAmount, setDiscountAmount] = useState(
    special?.discount_amount_cents ? (special.discount_amount_cents / 100).toFixed(2) : ""
  );
  const [discountPct, setDiscountPct] = useState(
    special?.discount_pct ? special.discount_pct.toString() : ""
  );
  const [comboPrice, setComboPrice] = useState(
    special?.combo_price_cents ? (special.combo_price_cents / 100).toFixed(2) : ""
  );
  const [dateFrom, setDateFrom] = useState(special?.date_from ?? "");
  const [dateTo, setDateTo] = useState(special?.date_to ?? "");
  const [timeFrom, setTimeFrom] = useState(special?.time_from ?? "");
  const [timeTo, setTimeTo] = useState(special?.time_to ?? "");
  const [selectedDays, setSelectedDays] = useState<string[]>(
    special?.selected_days ?? []
  );
  const [priority, setPriority] = useState(special?.priority ?? 0);
  const [active, setActive] = useState(special?.active ?? true);
  const [imageUrl, setImageUrl] = useState(special?.image_url ?? "");
  const [menuId, setMenuId] = useState(special?.menu_id ?? "");
  const [targets, setTargets] = useState<
    { item_id?: string; category_id?: string; combo_item_ids?: string[] }[]
  >([]);

  // Re-derive form state whenever the sheet opens so values from a previous
  // session (or a different special) never leak into the form
  // (state adjustment during render, per React docs).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setTitle(special?.title ?? "");
      setDescription(special?.description ?? "");
      setKind(special?.kind ?? "item_discount");
      setDiscountType(special?.discount_type ?? "percentage");
      setDiscountAmount(
        special?.discount_amount_cents
          ? (special.discount_amount_cents / 100).toFixed(2)
          : ""
      );
      setDiscountPct(special?.discount_pct ? special.discount_pct.toString() : "");
      setComboPrice(
        special?.combo_price_cents
          ? (special.combo_price_cents / 100).toFixed(2)
          : ""
      );
      setDateFrom(special?.date_from ?? "");
      setDateTo(special?.date_to ?? "");
      setTimeFrom(special?.time_from ?? "");
      setTimeTo(special?.time_to ?? "");
      setSelectedDays(special?.selected_days ?? []);
      setPriority(special?.priority ?? 0);
      setActive(special?.active ?? true);
      setImageUrl(special?.image_url ?? "");
      setMenuId(special?.menu_id ?? "");
      setTargets([]);
    }
  }

  function toggleDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("kind", kind);
    formData.set("discount_type", discountType ?? "");
    formData.set(
      "discount_amount_cents",
      discountAmount ? String(Math.round(parseFloat(discountAmount) * 100)) : "0"
    );
    formData.set("discount_pct", discountPct ?? "0");
    formData.set(
      "combo_price_cents",
      comboPrice ? String(Math.round(parseFloat(comboPrice) * 100)) : "0"
    );
    formData.set("date_from", dateFrom);
    formData.set("date_to", dateTo);
    formData.set("time_from", timeFrom);
    formData.set("time_to", timeTo);
    formData.set("selected_days", JSON.stringify(selectedDays));
    formData.set("priority", String(priority));
    formData.set("active", active ? "on" : "");
    formData.set("image_url", imageUrl);
    formData.set("menu_id", menuId);

    try {
      let specialId = special?.id;
      if (isEdit && special) {
        await updateSpecial(special.id, formData);
        specialId = special.id;
        toast.success("Special updated.");
      } else {
        const result = await createSpecial(restaurantId, formData);
        if (result.ok && result.data?.id) {
          specialId = result.data.id;
        }
        toast.success("Special created.");
      }

      // Save targets
      if (specialId && targets.length > 0) {
        await saveSpecialTargets(specialId, targets);
      }

      setOpen(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save special.");
    } finally {
      setLoading(false);
    }
  }

  const menuItems = [
    { value: "", label: "All menus" },
    ...menus.map((m) => ({ value: m.id, label: m.name })),
  ];

  return (
    <EditorSheet
      open={open}
      onOpenChange={setOpen}
      trigger={
        (children as React.ReactElement | undefined) ?? (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add special
          </Button>
        )
      }
      title={isEdit ? "Edit special" : "Add special"}
      description={
        isEdit
          ? "Update the special details below."
          : "Create a new special or promotion."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium text-sm">Active</p>
              <p className="text-xs text-muted-foreground">
                Show this special on the public menu
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="space-y-2">
            <Label>Applies to menu</Label>
            <Select
              items={menuItems}
              value={menuId}
              onValueChange={(v) => setMenuId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All menus" />
              </SelectTrigger>
              <SelectContent>
                {menuItems.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              items={KIND_ITEMS}
              value={kind}
              onValueChange={(v) => setKind((v ?? "item_discount") as Special["kind"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_ITEMS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special-title">Title</Label>
            <Input
              id="special-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Happy Hour"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="special-desc">Description</Label>
            <Textarea
              id="special-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Image</Label>
            <MediaPicker
              restaurantId={restaurantId}
              value={imageUrl}
              onChange={(url) => setImageUrl(url ?? "")}
            />
          </div>

          <SpecialTargetSelector
            restaurantId={restaurantId}
            specialId={isEdit ? special?.id ?? null : null}
            kind={kind}
            menuId={menuId || null}
            value={targets}
            onChange={setTargets}
          />

          {kind !== "combo" && (
            <div className="grid gap-4 grid-cols-1">
              <div className="space-y-2">
                <Label>Discount type</Label>
                <Select
                  items={DISCOUNT_TYPE_ITEMS}
                  value={discountType ?? "percentage"}
                  onValueChange={(v) => setDiscountType((v ?? "percentage") as Special["discount_type"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_TYPE_ITEMS.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {discountType === "fixed" ? "Discount amount" : "Discount %"}
                </Label>
                {discountType === "fixed" ? (
                  <PriceInput
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                  />
                ) : (
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}

          {kind === "combo" && (
            <div className="space-y-2">
              <Label>Combo price</Label>
              <PriceInput
                value={comboPrice}
                onChange={(e) => setComboPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The flat total price customers pay for this combo.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start time</Label>
              <Input
                type="time"
                value={timeFrom}
                onChange={(e) => setTimeFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End time</Label>
              <Input
                type="time"
                value={timeTo}
                onChange={(e) => setTimeTo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Active days</Label>
            <div className="grid grid-cols-4 gap-2">
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`
                    px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors
                    ${selectedDays.includes(day)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }
                  `}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special-priority">Priority</Label>
            <Input
              id="special-priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Save changes" : "Create special"}
            </Button>
          </div>
      </form>
    </EditorSheet>
  );
}
