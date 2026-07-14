type SpecialLike = {
  active: boolean;
  menu_id?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  time_from?: string | null;
  time_to?: string | null;
  selected_days?: string[] | null;
  time_windows?: unknown;
};

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return { hours, minutes };
}

function isWithinTimeWindow(now: Date, from: string | null | undefined, to: string | null | undefined): boolean {
  if (!from && !to) return true;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (from && to) {
    const start = parseTime(from);
    const end = parseTime(to);
    if (!start || !end) return true;
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    if (endMinutes < startMinutes) {
      // Overnight window (e.g. 22:00 - 02:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  if (from) {
    const start = parseTime(from);
    if (!start) return true;
    return currentMinutes >= start.hours * 60 + start.minutes;
  }

  if (to) {
    const end = parseTime(to);
    if (!end) return true;
    return currentMinutes <= end.hours * 60 + end.minutes;
  }

  return true;
}

function isInSelectedDays(now: Date, selectedDays: string[] | null | undefined): boolean {
  if (!selectedDays || selectedDays.length === 0) return true;
  const today = DAY_NAMES[now.getDay()];
  return selectedDays.includes(today);
}

function isInDateRange(now: Date, dateFrom: string | null | undefined, dateTo: string | null | undefined): boolean {
  if (!dateFrom && !dateTo) return true;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (dateFrom) {
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    if (today < from) return false;
  }

  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(0, 0, 0, 0);
    if (today > to) return false;
  }

  return true;
}

export interface IsSpecialActiveOptions {
  /** Current reference time. Defaults to browser/server now. */
  now?: Date;
  /** The menu ID the special must apply to (or null/undefined if checking across all menus). */
  menuId?: string | null;
}

/**
 * Determine whether a special is active right now for a given menu.
 * Checks active flag, menu scope, date range, time range, and selected weekdays.
 */
export function isSpecialActiveNow(
  special: SpecialLike,
  options: IsSpecialActiveOptions = {}
): boolean {
  const now = options.now ?? new Date();
  const menuId = options.menuId ?? null;

  if (!special.active) return false;

  // Menu scope: null means all menus.
  if (special.menu_id && menuId && special.menu_id !== menuId) return false;

  if (!isInDateRange(now, special.date_from, special.date_to)) return false;
  if (!isInSelectedDays(now, special.selected_days)) return false;
  if (!isWithinTimeWindow(now, special.time_from, special.time_to)) return false;

  return true;
}
