export const COMMON_ALLERGENS = [
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

/** Normalize an allergen for storage/dedupe: trimmed and lowercased. */
export function normalizeAllergen(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Append a custom allergen to the list. No-op (returns the same array) when
 * the input is empty or already covered — case-insensitively — by the common
 * allergens or by an existing entry.
 */
export function addCustomAllergen(allergens: string[], input: string): string[] {
  const value = normalizeAllergen(input);
  if (!value) return allergens;
  const known = new Set(
    [...COMMON_ALLERGENS, ...allergens].map(normalizeAllergen)
  );
  if (known.has(value)) return allergens;
  return [...allergens, value];
}

/** Allergens in the list that are not part of the common checkbox set. */
export function customAllergens(allergens: string[]): string[] {
  const common = new Set(COMMON_ALLERGENS);
  return allergens.filter((a) => !common.has(normalizeAllergen(a)));
}
