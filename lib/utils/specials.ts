/**
 * Schedule and discount logic for restaurant specials.
 *
 * Pure functions, safe to call on the server or client. Specials carry a
 * day/time/date schedule and either a percentage / fixed discount or a flat
 * combo price; this module decides whether a special is live right now and what
 * price an item should show.
 */

import { formatZar } from "@/lib/utils/money";

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

/** Format a short label like "Combo · R 12.34", "25% off", or "R 5.00 off". */
export function formatSpecialLabel(special: {
  kind: string;
  discount_type?: string | null;
  discount_pct?: number | null;
  discount_amount_cents?: number | null;
  combo_price_cents?: number | null;
}): string | null {
  if (special.kind === "combo" && special.combo_price_cents) {
    return `Combo · ${formatZar(special.combo_price_cents)}`;
  }
  if (special.discount_type === "percentage" && special.discount_pct) {
    return `${special.discount_pct}% off`;
  }
  if (special.discount_type === "fixed" && special.discount_amount_cents) {
    return `${formatZar(special.discount_amount_cents)} off`;
  }
  if (special.discount_pct) {
    return `${special.discount_pct}% off`;
  }
  if (special.discount_amount_cents) {
    return `${formatZar(special.discount_amount_cents)} off`;
  }
  return null;
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

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/** Normalise a weekday key and return a short label. */
export function formatDayLabel(dayKey: string): string {
  return DAY_LABELS[dayKey.toLowerCase()] ?? dayKey;
}

/** Format a list of weekday keys, e.g. ["mon", "wed"] → "Mon, Wed". */
export function formatSelectedDays(days: string[] | null): string | null {
  if (!days || days.length === 0) return null;
  const ordered = days
    .filter((d) => DAY_LABELS[d.toLowerCase()])
    .sort((a, b) => {
      const ai = DAY_ORDER.indexOf(a.toLowerCase() as (typeof DAY_ORDER)[number]);
      const bi = DAY_ORDER.indexOf(b.toLowerCase() as (typeof DAY_ORDER)[number]);
      return ai - bi;
    });
  if (ordered.length === 0) return null;
  if (ordered.length === 7) return "Every day";
  return ordered.map(formatDayLabel).join(", ");
}

/** Format a single time window as "HH:MM – HH:MM". */
export function formatTimeWindow(
  from: string | null,
  to: string | null
): string | null {
  if (!from && !to) return null;
  const start = from ? from.slice(0, 5) : null;
  const end = to ? to.slice(0, 5) : null;
  if (start && end) return `${start} – ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return null;
}

/** Format a date range as "YYYY-MM-DD to YYYY-MM-DD". */
export function formatDateRange(
  from: string | null,
  to: string | null
): string | null {
  if (!from && !to) return null;
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return null;
}

/** A time window object as stored in `specials.time_windows`. */
export interface TimeWindow {
  from?: string;
  to?: string;
}

/** Format the optional `time_windows` JSON array. */
export function formatTimeWindows(windows: unknown): string[] | null {
  if (!Array.isArray(windows) || windows.length === 0) return null;
  const lines: string[] = [];
  for (const window of windows) {
    if (window && typeof window === "object") {
      const w = window as TimeWindow;
      const from = typeof w.from === "string" ? w.from : null;
      const to = typeof w.to === "string" ? w.to : null;
      const formatted = formatTimeWindow(from, to);
      if (formatted) lines.push(formatted);
    }
  }
  return lines.length > 0 ? lines : null;
}

/**
 * Build a concise, human-readable description of when a special is valid.
 * Returns an array of lines that can be rendered as a list.
 */
export function formatSpecialSchedule(
  special: SchedulableSpecial & { time_windows?: unknown }
): string[] {
  const lines: string[] = [];
  const dateRange = formatDateRange(special.date_from, special.date_to);
  if (dateRange) lines.push(dateRange);
  const days = formatSelectedDays(special.selected_days);
  if (days) lines.push(days);
  const time = formatTimeWindow(special.time_from, special.time_to);
  if (time) lines.push(time);
  const windows = formatTimeWindows(special.time_windows);
  if (windows) lines.push(...windows);
  return lines;
}
