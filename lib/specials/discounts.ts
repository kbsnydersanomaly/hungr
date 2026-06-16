import { isSpecialActiveNow, type IsSpecialActiveOptions } from "./filter";

type DiscountSpecial = {
  id: string;
  active: boolean;
  menu_id: string | null;
  kind: string;
  discount_type: string | null;
  discount_pct: number | null;
  discount_amount_cents: number | null;
  date_from: string | null;
  date_to: string | null;
  time_from: string | null;
  time_to: string | null;
  selected_days: string[] | null;
  special_targets?: Array<{
    item_id?: string | null;
    category_id?: string | null;
  }> | null;
};

export function computeDiscountedPrice(
  priceCents: number,
  special: {
    discount_type: string | null;
    discount_pct: number | null;
    discount_amount_cents: number | null;
  }
): number {
  if (special.discount_type === "percentage" && special.discount_pct) {
    return Math.max(0, Math.round(priceCents * (1 - special.discount_pct / 100)));
  }
  if (special.discount_type === "fixed" && special.discount_amount_cents) {
    return Math.max(0, priceCents - special.discount_amount_cents);
  }
  return priceCents;
}

export function formatDiscountLabel(
  special: {
    discount_type: string | null;
    discount_pct: number | null;
    discount_amount_cents: number | null;
  }
): string | null {
  if (special.discount_type === "percentage" && special.discount_pct) {
    return `${special.discount_pct}% off`;
  }
  if (special.discount_type === "fixed" && special.discount_amount_cents) {
    return `R ${(special.discount_amount_cents / 100).toFixed(2)} off`;
  }
  return null;
}

function flatTargets(special: DiscountSpecial) {
  return (special.special_targets ?? []).filter((t): t is NonNullable<typeof t> => t !== null);
}

function findBestItemDiscount(
  itemId: string,
  specials: DiscountSpecial[],
  options?: IsSpecialActiveOptions
): DiscountSpecial | null {
  const candidates = specials.filter((s) => {
    if (s.kind !== "item_discount") return false;
    if (!isSpecialActiveNow(s, options)) return false;
    return flatTargets(s).some((t) => t.item_id === itemId);
  });

  if (candidates.length === 0) return null;

  // Prefer percentage discounts with the highest percentage, then fixed with the largest amount.
  candidates.sort((a, b) => {
    const aValue = a.discount_pct ?? (a.discount_amount_cents ? a.discount_amount_cents / 10000 : 0);
    const bValue = b.discount_pct ?? (b.discount_amount_cents ? b.discount_amount_cents / 10000 : 0);
    return bValue - aValue;
  });

  return candidates[0];
}

export function findCategoryDiscount(
  categoryId: string,
  specials: DiscountSpecial[],
  options?: IsSpecialActiveOptions
): DiscountSpecial | null {
  return (
    specials.find((s) => {
      if (s.kind !== "category_discount") return false;
      if (!isSpecialActiveNow(s, options)) return false;
      return flatTargets(s).some((t) => t.category_id === categoryId);
    }) ?? null
  );
}

export interface ItemDiscountInfo {
  original_price_cents: number;
  discounted_price_cents: number;
  discount_label: string | null;
  special_id: string | null;
}

export function getItemDiscount(
  item: { id: string; price_cents: number },
  specials: DiscountSpecial[],
  options?: IsSpecialActiveOptions
): ItemDiscountInfo {
  const special = findBestItemDiscount(item.id, specials, options);
  if (!special) {
    return {
      original_price_cents: item.price_cents,
      discounted_price_cents: item.price_cents,
      discount_label: null,
      special_id: null,
    };
  }
  return {
    original_price_cents: item.price_cents,
    discounted_price_cents: computeDiscountedPrice(item.price_cents, special),
    discount_label: formatDiscountLabel(special),
    special_id: special.id,
  };
}
