"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upsertItem } from "@/lib/data/menu-actions";
import {
  loadOptionSuggestions,
  type OptionSuggestions,
} from "@/lib/data/option-suggestions";
import { MultiImagePicker } from "@/components/dashboard/MultiImagePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceInput } from "@/components/forms/PriceInput";
import { TagAutocomplete } from "@/components/ui/autocomplete";
import { EditorSheet } from "@/components/dashboard/EditorSheet";
import { Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const COMMON_ALLERGENS = [
  "gluten",
  "peanuts",
  "dairy",
  "eggs",
  "fish",
  "shellfish",
  "soy",
  "tree nuts",
  "wheat",
  "sesame",
];

const COMMON_LABELS = [
  "vegan",
  "vegetarian",
  "gluten-free",
  "spicy",
  "halal",
  "kosher",
  "organic",
  "local",
];

interface OptionItem {
  /** Client-only stable identity for React list rendering. */
  key: string;
  name: string;
  price: string;
}

function newOptionKey(): string {
  return crypto.randomUUID();
}

interface ItemData {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  image_urls?: string[];
  allergens: string[];
  labels: string[];
  preparations: { name: string; price_cents?: number }[];
  variations: { name: string; price_cents?: number }[];
  sides: { name: string; price_cents?: number }[];
  sauces: { name: string; price_cents?: number }[];
  pairing_ids?: string[];
}

/** Minimal shape needed to offer an item as a pairing choice. */
interface PairingOption {
  id: string;
  name: string;
}

interface ItemEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuId: string;
  categoryId: string;
  restaurantId: string;
  item?: ItemData | null;
  /** Other items in this menu, used to pick pairings. */
  menuItems?: PairingOption[];
}

interface FormState {
  name: string;
  description: string;
  price: string;
  imageUrls: string[];
  allergens: string[];
  labels: string[];
  preparations: OptionItem[];
  variations: OptionItem[];
  sides: OptionItem[];
  sauces: OptionItem[];
  pairingIds: string[];
}

function toOptionItems(
  options?: { name: string; price_cents?: number }[]
): OptionItem[] {
  return (
    options?.map((o) => ({
      key: newOptionKey(),
      name: o.name,
      price: o.price_cents ? (o.price_cents / 100).toFixed(2) : "",
    })) ?? []
  );
}

function getInitialState(item?: ItemData | null): FormState {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    price: item ? (item.price_cents / 100).toFixed(2) : "",
    imageUrls:
      item?.image_urls && item.image_urls.length > 0
        ? item.image_urls
        : item?.image_url
          ? [item.image_url]
          : [],
    allergens: item?.allergens ?? [],
    labels: item?.labels ?? [],
    preparations: toOptionItems(item?.preparations),
    variations: toOptionItems(item?.variations),
    sides: toOptionItems(item?.sides),
    sauces: toOptionItems(item?.sauces),
    pairingIds: item?.pairing_ids ?? [],
  };
}

const EMPTY_SUGGESTIONS: OptionSuggestions = {
  preparations: [],
  variations: [],
  sides: [],
  sauces: [],
};

export function ItemEditSheet({
  open,
  onOpenChange,
  menuId,
  categoryId,
  restaurantId,
  item,
  menuItems = [],
}: ItemEditSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(() => getInitialState(item));
  const [suggestions, setSuggestions] =
    useState<OptionSuggestions>(EMPTY_SUGGESTIONS);
  const [pairingSearch, setPairingSearch] = useState("");

  // Other items in the menu that can be picked as pairings (never itself).
  const pairingChoices = menuItems.filter((m) => m.id !== item?.id);
  const pairingNameById = new Map(pairingChoices.map((m) => [m.id, m.name]));
  const unselectedPairings = pairingChoices.filter(
    (m) =>
      !form.pairingIds.includes(m.id) &&
      m.name.toLowerCase().includes(pairingSearch.trim().toLowerCase())
  );

  // Re-derive form state every time the sheet opens so stale values never
  // leak between items (state adjustment during render, per React docs).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(getInitialState(item));
      setPairingSearch("");
    }
  }

  // Load option-name suggestions for autocomplete when the sheet opens.
  useEffect(() => {
    if (!open) return;
    loadOptionSuggestions(restaurantId)
      .then(setSuggestions)
      .catch(() => setSuggestions(EMPTY_SUGGESTIONS));
  }, [open, restaurantId]);

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const toggleIn = useCallback(
    (key: "allergens" | "labels", value: string) =>
      setForm((prev) => ({
        ...prev,
        [key]: prev[key].includes(value)
          ? prev[key].filter((v) => v !== value)
          : [...prev[key], value],
      })),
    []
  );

  type OptionKey = "preparations" | "variations" | "sides" | "sauces";

  function addOption(key: OptionKey) {
    set(key, [...form[key], { key: newOptionKey(), name: "", price: "" }]);
  }

  function updateOption(
    key: OptionKey,
    index: number,
    field: "name" | "price",
    value: string
  ) {
    const next = [...form[key]];
    next[index] = { ...next[index], [field]: value };
    set(key, next);
  }

  function removeOption(key: OptionKey, index: number) {
    set(
      key,
      form[key].filter((_, i) => i !== index)
    );
  }

  function addPairing(id: string) {
    if (form.pairingIds.includes(id)) return;
    set("pairingIds", [...form.pairingIds, id]);
    setPairingSearch("");
  }

  function removePairing(id: string) {
    set(
      "pairingIds",
      form.pairingIds.filter((pid) => pid !== id)
    );
  }

  function toCents(priceStr: string): number | undefined {
    const n = parseFloat(priceStr);
    return isNaN(n) || n <= 0 ? undefined : Math.round(n * 100);
  }

  function serializeOptions(options: OptionItem[]): string {
    return JSON.stringify(
      options
        .filter((o) => o.name.trim())
        .map((o) => ({ name: o.name.trim(), price_cents: toCents(o.price) }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData();
    if (item?.id) formData.set("id", item.id);
    formData.set("categoryId", categoryId);
    formData.set("name", form.name);
    formData.set("description", form.description);
    formData.set("price", form.price);
    formData.set("image_urls", JSON.stringify(form.imageUrls));
    formData.set("allergens", JSON.stringify(form.allergens));
    formData.set("labels", JSON.stringify(form.labels));
    formData.set("preparations", serializeOptions(form.preparations));
    formData.set("variations", serializeOptions(form.variations));
    formData.set("sides", serializeOptions(form.sides));
    formData.set("sauces", serializeOptions(form.sauces));
    formData.set("pairing_ids", JSON.stringify(form.pairingIds));

    try {
      const result = await upsertItem(menuId, formData);
      if (result && !result.ok) {
        toast.error(result.message ?? "Failed to save item");
        return;
      }
      if (!item) {
        // Clear the form after a successful create so the next "Add item"
        // starts fresh.
        setForm(getInitialState(null));
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const optionSections: {
    key: OptionKey;
    title: string;
    addLabel: string;
    placeholder: string;
  }[] = [
    {
      key: "preparations",
      title: "Preparations",
      addLabel: "Add preparation",
      placeholder: "e.g. Grilled",
    },
    {
      key: "variations",
      title: "Variations",
      addLabel: "Add variation",
      placeholder: "e.g. Large",
    },
    { key: "sides", title: "Sides", addLabel: "Add side", placeholder: "e.g. Fries" },
    { key: "sauces", title: "Sauces", addLabel: "Add sauce", placeholder: "e.g. BBQ" },
  ];

  return (
    <EditorSheet
      open={open}
      onOpenChange={onOpenChange}
      title={item ? "Edit item" : "Add item"}
      description={
        item ? "Update the item details below." : "Fill in the item details below."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-price">Price</Label>
              <PriceInput
                id="item-price"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                required
                containerClassName="max-w-48"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Optional description"
                rows={4}
                className="min-h-24"
              />
            </div>

            <div className="space-y-2">
              <Label>Images</Label>
              <MultiImagePicker
                restaurantId={restaurantId}
                value={form.imageUrls}
                onChange={(urls) => set("imageUrls", urls)}
              />
            </div>
          </div>

          {/* Allergens */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium py-2 border-b">
              Allergens
            </summary>
            <div className="grid grid-cols-2 gap-2 pt-3">
              {COMMON_ALLERGENS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.allergens.includes(a)}
                    onCheckedChange={() => toggleIn("allergens", a)}
                  />
                  <span className="capitalize">{a}</span>
                </label>
              ))}
            </div>
          </details>

          {/* Labels */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium py-2 border-b">
              Labels
            </summary>
            <div className="grid grid-cols-2 gap-2 pt-3">
              {COMMON_LABELS.map((l) => (
                <label key={l} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.labels.includes(l)}
                    onCheckedChange={() => toggleIn("labels", l)}
                  />
                  <span className="capitalize">{l}</span>
                </label>
              ))}
            </div>
          </details>

          {/* Option sections (preparations, variations, sides, sauces) */}
          {optionSections.map(({ key, title, addLabel, placeholder }) => (
            <details key={key} className="group">
              <summary className="cursor-pointer text-sm font-medium py-2 border-b">
                {title}
              </summary>
              <div className="space-y-2 pt-3">
                {form[key].map((option, i) => (
                  <div key={option.key} className="flex items-center gap-2">
                    <TagAutocomplete
                      value={option.name}
                      onChange={(v) => updateOption(key, i, "name", v)}
                      suggestions={suggestions[key]}
                      placeholder={placeholder}
                      className="basis-3/5"
                    />
                    <PriceInput
                      value={option.price}
                      onChange={(e) =>
                        updateOption(key, i, "price", e.target.value)
                      }
                      placeholder="00.00"
                      containerClassName="basis-2/5"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground"
                      aria-label={`Remove ${option.name || "option"}`}
                      onClick={() => removeOption(key, i)}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addOption(key)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {addLabel}
                </Button>
              </div>
            </details>
          ))}

          {/* Pairings — other items in this menu that go well with this one */}
          {pairingChoices.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium py-2 border-b">
                Pairings
              </summary>
              <div className="space-y-3 pt-3">
                {form.pairingIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.pairingIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
                      >
                        {pairingNameById.get(id) ?? "Unknown item"}
                        <button
                          type="button"
                          aria-label={`Remove ${pairingNameById.get(id) ?? "pairing"}`}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => removePairing(id)}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <Input
                  value={pairingSearch}
                  onChange={(e) => setPairingSearch(e.target.value)}
                  placeholder="Search items to pair…"
                />

                {pairingSearch.trim() && (
                  <div className="max-h-48 overflow-y-auto rounded-lg border">
                    {unselectedPairings.length > 0 ? (
                      unselectedPairings.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => addPairing(m.id)}
                        >
                          {m.name}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-muted-foreground">
                        No matching items.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </details>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {item ? "Save changes" : "Add item"}
            </Button>
          </div>
        </form>
    </EditorSheet>
  );
}
