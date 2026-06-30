/**
 * Schedule and discount logic for restaurant specials.
 *
 * Pure functions, safe to call on the server or client. Specials carry a
 * day/time/date schedule and either a percentage / fixed discount or a flat
 * combo price; this module decides whether a special is live right now and what
 * price an item should show.
 */

/** Schedules are evaluated in South African wall-clock time (UTC+2, no DST). */
export const SPECIAL_TIME_ZONE = "Africa/Johannesburg";

export interface ScheduleContext {
  /** e.g. "mon" */
  dayKey: string;
  /** "YYYY-MM-DD" in the schedule timezone */
  date: string;
  /** minutes since midnight in the schedule timezone */
  minutes: number;
}

/** The schedule-relevant fields of a special. */
export interface SchedulableSpecial {
  date_from: string | null;
  date_to: string | null;
  time_from: string | null;
  time_to: string | null;
  selected_days: string[] | null;
}

interface SpecialTarget {
  item_id: string | null;
  category_id: string | null;
}

/** The discount-relevant fields of a special. */
export interface DiscountableSpecial extends SchedulableSpecial {
  kind: string;
  discount_type: string | null;
  discount_pct: number | null;
  discount_amount_cents: number | null;
  special_targets?: SpecialTarget[] | null;
}

/**
 * Build the current schedule context from a timezone. Uses Intl rather than the
 * server's local clock so behaviour is identical regardless of where it runs.
 */
export function currentScheduleContext(
  tz: string = SPECIAL_TIME_ZONE,
  now: Date = new Date()
): ScheduleContext {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = parseInt(get("hour"), 10) || 0;
  const minute = parseInt(get("minute"), 10) || 0;
  const dayKey = get("weekday").toLowerCase().slice(0, 3);

  return { dayKey, date, minutes: hour * 60 + minute };
}

/** Parse "HH:MM" (or "HH:MM:SS") into minutes since midnight, or null. */
function parseTimeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  const hours = parseInt(h, 10);
  const minutes = parseInt(m ?? "0", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Is the special live for the given moment? Empty `selected_days`, null dates,
 * and null times each mean "no restriction on that dimension".
 */
export function isSpecialActive(
  special: SchedulableSpecial,
  ctx: ScheduleContext
): boolean {
  // Date window (inclusive). Dates are "YYYY-MM-DD" so string compare is safe.
  if (special.date_from && ctx.date < special.date_from) return false;
  if (special.date_to && ctx.date > special.date_to) return false;

  // Day of week.
  if (
    special.selected_days &&
    special.selected_days.length > 0 &&
    !special.selected_days.includes(ctx.dayKey)
  ) {
    return false;
  }

  // Time window. Only enforced when both ends are set; supports overnight
  // windows that wrap past midnight (e.g. 22:00 → 02:00).
  const from = parseTimeToMinutes(special.time_from);
  const to = parseTimeToMinutes(special.time_to);
  if (from !== null && to !== null) {
    if (from <= to) {
      if (ctx.minutes < from || ctx.minutes > to) return false;
    } else {
      // overnight: active if after `from` OR before `to`
      if (ctx.minutes < from && ctx.minutes > to) return false;
    }
  }

  return true;
}

/** Return only the specials that are live for the given context. */
export function filterActiveSpecials<T extends SchedulableSpecial>(
  specials: T[],
  ctx: ScheduleContext
): T[] {
  return specials.filter((s) => isSpecialActive(s, ctx));
}

export interface ItemForDiscount {
  id: string;
  category_id: string | null;
  price_cents: number;
}

export interface ItemDiscount {
  originalCents: number;
  discountedCents: number;
  special: DiscountableSpecial;
}

/** Apply a single special's discount to a price, or null if it doesn't reduce it. */
function discountedPrice(
  special: DiscountableSpecial,
  priceCents: number
): number | null {
  if (special.discount_type === "percentage") {
    if (!special.discount_pct) return null;
    return Math.round(priceCents * (1 - special.discount_pct / 100));
  }
  if (special.discount_type === "fixed") {
    if (!special.discount_amount_cents) return null;
    return Math.max(0, priceCents - special.discount_amount_cents);
  }
  return null;
}

/**
 * Best (lowest-price) item- or category-discount that applies to the item,
 * drawn from a list of already schedule-active specials. Combos are bundles and
 * never produce a per-item discount, so they're ignored here.
 */
export function applicableItemDiscount(
  item: ItemForDiscount,
  activeSpecials: DiscountableSpecial[]
): ItemDiscount | null {
  let best: ItemDiscount | null = null;

  for (const special of activeSpecials) {
    const targets = special.special_targets ?? [];

    const matches =
      (special.kind === "item_discount" &&
        targets.some((t) => t.item_id === item.id)) ||
      (special.kind === "category_discount" &&
        item.category_id != null &&
        targets.some((t) => t.category_id === item.category_id));

    if (!matches) continue;

    const discounted = discountedPrice(special, item.price_cents);
    if (discounted === null || discounted >= item.price_cents) continue;

    if (!best || discounted < best.discountedCents) {
      best = {
        originalCents: item.price_cents,
        discountedCents: discounted,
        special,
      };
    }
  }

  return best;
}
