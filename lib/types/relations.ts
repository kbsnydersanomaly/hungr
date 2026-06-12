/**
 * Common shapes for joined Supabase relations.
 *
 * Supabase's generated types model FK joins as `unknown | unknown[]` because
 * the relationship cardinality isn't inferable from the select string. These
 * helpers describe the actual shape so callers don't reach for `as any`.
 */

export type ProfileRef = {
  id?: string;
  email?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

export type OrgRef = {
  name?: string | null;
  slug?: string | null;
  owner_id?: string | null;
};

export type RestaurantRef = {
  id?: string;
  name?: string | null;
  slug?: string | null;
};

export type PlanRef = {
  id?: string;
  name?: string | null;
  slug?: string | null;
  base_price_cents?: number | null;
  pricing_model?: string | null;
};

/** Cast a Supabase relation field to its actual single-row shape. */
export function rel<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return value as T;
}
