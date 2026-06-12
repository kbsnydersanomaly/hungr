import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("Seeding plans...");

  const { error } = await supabase.from("plans").insert([
    {
      slug: "starter",
      name: "Starter",
      pricing_model: "per_restaurant",
      base_price_cents: 99_900,
      additional_discount_pct: 10,
      max_restaurants: null,
      features: {
        specials: true,
        analytics: "basic",
        media_library_gb: 5,
        review_moderation: true,
        custom_domain: false,
      },
      contact_only: false,
      is_public: true,
      sort_order: 1,
    },
    {
      slug: "pro",
      name: "Pro",
      pricing_model: "flat_includes_n",
      base_price_cents: 599_900,
      additional_discount_pct: 0,
      included_restaurants: 10,
      max_restaurants: 10,
      features: {
        specials: true,
        analytics: "advanced",
        media_library_gb: 50,
        review_moderation: true,
        custom_domain: false,
        priority_support: true,
      },
      contact_only: false,
      is_public: true,
      sort_order: 2,
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      pricing_model: "custom",
      base_price_cents: 0,
      additional_discount_pct: 0,
      contact_only: true,
      is_public: true,
      sort_order: 3,
      features: {
        specials: true,
        analytics: "advanced",
        media_library_gb: 500,
        review_moderation: true,
        custom_domain: true,
        priority_support: true,
        white_label: true,
      },
    },
  ]);

  if (error) {
    console.error("Failed to seed plans:", error);
    process.exit(1);
  }

  console.log("Seeded 3 plans.");
}

seed();
