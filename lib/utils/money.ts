/**
 * Formats cents as "R 1 234.56".
 *
 * Deliberately avoids `toLocaleString`: locale data (e.g. the en-ZA group
 * separator) differs between Node and browser ICU versions, which caused
 * React hydration mismatches on server-rendered prices.
 */
export function formatZar(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const rand = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `R ${sign}${rand}.${fraction}`;
}

export function parseZar(s: string): number {
  return Math.round(
    parseFloat(s.replace(/[^\d.,]/g, "").replace(",", ".")) * 100
  );
}

/**
 * Cents → plain decimal rands (e.g. 7500 → "75.00"), the inverse of the
 * `Math.round(value * 100)` convention used by `upsertItem` and the bulk
 * importer. Unlike `formatZar` this is machine-oriented: no "R " prefix and no
 * thousands grouping, so the output re-parses with `Number()`.
 */
export function centsToRands(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}
