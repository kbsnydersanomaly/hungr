const DIGITS_ONLY = /\D/g;

export function normalizeSouthAfricanPhone(input: string): string | null {
  const digits = input.replace(DIGITS_ONLY, "");
  const normalized = digits.startsWith("0")
    ? `27${digits.slice(1)}`
    : digits.startsWith("27")
    ? digits
    : null;
  if (!normalized) return null;
  if (!/^27[6-8]\d{8}$/.test(normalized)) return null;
  return `+${normalized}`;
}

export function isValidSouthAfricanPhone(input: string): boolean {
  return normalizeSouthAfricanPhone(input) !== null;
}
