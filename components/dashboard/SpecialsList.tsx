"use client";

import { useState } from "react";
import Image from "next/image";
import { deleteSpecial } from "@/lib/data/special-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SpecialEditor } from "./SpecialEditor";
import { Pencil, Trash2, Sparkles, ImageIcon, Loader2 } from "lucide-react";
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
  media_id: string | null;
  menu_id: string | null;
}

interface SpecialsListProps {
  restaurantId: string;
  menus: { id: string; name: string }[];
  specials: Special[];
  onRefresh?: () => void;
}

const KIND_LABELS: Record<string, string> = {
  item_discount: "Item discount",
  category_discount: "Category discount",
  combo: "Combo",
};

export function SpecialsList({
  restaurantId,
  menus,
  specials,
  onRefresh,
}: SpecialsListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(special: Special) {
    if (!confirm(`Delete "${special.title}"?`)) return;

    setDeletingId(special.id);
    try {
      await deleteSpecial(special.id);
      toast.success("Special deleted.");
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDiscount(special: Special): string {
    if (special.kind === "combo") {
      return special.combo_price_cents
        ? `Combo · R ${(special.combo_price_cents / 100).toFixed(2)}`
        : "Combo deal";
    }
    if (special.discount_type === "percentage" && special.discount_pct) {
      return `${special.discount_pct}% off`;
    }
    if (special.discount_type === "fixed" && special.discount_amount_cents) {
      return `R ${(special.discount_amount_cents / 100).toFixed(2)} off`;
    }
    return "Discount";
  }

  function menuName(menuId: string | null): string {
    if (!menuId) return "All menus";
    return menus.find((m) => m.id === menuId)?.name ?? "All menus";
  }

  if (specials.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            No specials yet. Create your first special offer.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {specials.map((special) => (
        <Card key={special.id}>
          <CardContent className="py-4">
            <div className="flex items-start gap-4">
              {special.image_url ? (
                <Image
                  src={special.image_url}
                  alt={special.title}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">{special.title}</h3>
                  <Badge variant={special.active ? "default" : "secondary"}>
                    {special.active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline">{KIND_LABELS[special.kind]}</Badge>
                </div>
                {special.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {special.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatDiscount(special)}
                  </span>
                  <span>·</span>
                  <span>{menuName(special.menu_id)}</span>
                  {special.date_from && (
                    <>
                      <span>·</span>
                      <span>
                        {special.date_from}
                        {special.date_to ? ` → ${special.date_to}` : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-1 flex-shrink-0">
                <SpecialEditor
                  restaurantId={restaurantId}
                  menus={menus}
                  special={special}
                  onSaved={onRefresh}
                >
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </SpecialEditor>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(special)}
                  disabled={deletingId === special.id}
                >
                  {deletingId === special.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
