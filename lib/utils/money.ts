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
