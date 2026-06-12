import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type BrandingRow = Database["public"]["Tables"]["branding"]["Row"];
export type BrandingDraftRow = Database["public"]["Tables"]["branding_drafts"]["Row"];

function coerceBranding(row: BrandingRow | BrandingDraftRow | null) {
  if (!row) return null;
  const asRecord = (v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, string>;
    return null;
  };
  return {
    ...row,
    primary_button: asRecord(row.primary_button),
    secondary_button: asRecord(row.secondary_button),
    main_heading: asRecord(row.main_heading),
    sub_heading: asRecord(row.sub_heading),
    body: asRecord(row.body),
  };
}

export async function loadBranding(restaurantId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("branding")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .single();

  if (error || !data) return null;
  return coerceBranding(data);
}

export async function loadBrandingDraft(restaurantId: string) {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("branding_drafts")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .single();

  if (error || !data) return null;
  return coerceBranding(data);
}
