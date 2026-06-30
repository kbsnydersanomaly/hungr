const DIGITS_ONLY = /\D/g;
const SA_PHONE_RE = /^27[6-8]\d{8}$/;
const DISALLOWED_PHONE_CHARS = /[^\d\s+\-()]/g;

/**
 * Strips characters that are not valid in a phone number field (digits,
 * spaces, +, parentheses, and hyphens).
 */
export function sanitizePhoneInput(value: string): string {
  return value.replace(DISALLOWED_PHONE_CHARS, "");
}

/**
 * Normalizes a South African phone number to E.164 format.
 * Returns a string starting with `+`, or `null` if the input is invalid.
 */
export function normalizeSouthAfricanPhone(input: string): string | null {
  let digits = input.replace(DIGITS_ONLY, "");

  // Handle the common +27 (0)82 ... notation by stripping the placeholder 0.
  if (digits.startsWith("270")) {
    digits = `27${digits.slice(3)}`;
  }

  const normalized = digits.startsWith("0")
    ? `27${digits.slice(1)}`
    : digits.startsWith("27")
    ? digits
    : null;
  if (!normalized) return null;
  if (!SA_PHONE_RE.test(normalized)) return null;
  return `+${normalized}`;
}

/**
 * Validates whether a string is a normalizable South African phone number.
 */
export function isValidSouthAfricanPhone(input: string): boolean {
  return normalizeSouthAfricanPhone(input) !== null;
}
