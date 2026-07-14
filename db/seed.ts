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

  console.log("Seeding help content...");

  const { data: existingCategory } = await supabase
    .from("help_categories")
    .select("id")
    .eq("slug", "getting-started")
    .maybeSingle();

  let categoryId = existingCategory?.id;
  if (!categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from("help_categories")
      .insert({
        name: "Getting started",
        slug: "getting-started",
        sort_order: 1,
      })
      .select("id")
      .single();

    if (categoryError) {
      console.error("Failed to seed help category:", categoryError);
      process.exit(1);
    }
    categoryId = category.id;
  }

  const articleSlug = "how-organisations-restaurants-and-teams-fit-together";
  const { data: existingArticle } = await supabase
    .from("help_articles")
    .select("id")
    .eq("slug", articleSlug)
    .maybeSingle();

  if (!existingArticle) {
    const { error: articleError } = await supabase.from("help_articles").insert({
      title: "How organisations, restaurants and teams fit together",
      slug: articleSlug,
      category_id: categoryId,
      topics: ["organisations", "restaurants", "teams", "getting-started"],
      content: `Hungr is organised in three levels:

1. Organisation — your business account.
   • Owns the subscription and billing.
   • Contains one or more restaurants.

2. Restaurant — a single location or brand.
   • Has its own menus, branding, media library, QR codes, reviews and about page.
   • Has its own team with restaurant-specific roles.

3. Team members — people who can access the organisation or a restaurant.
   • Organisation roles: owner, admin, manager, staff.
   • Restaurant roles: manager, staff.

Think of it like this:

  Organisation (your company)
  └── Restaurant A (location/brand)
  │     ├── Menus
  │     ├── Branding
  │     ├── Media
  │     └── Team
  └── Restaurant B (location/brand)
        ├── Menus
        ├── Branding
        ├── Media
        └── Team

Tip: Invite someone from your organisation Team page if they need access to everything, or from a restaurant Team page if they only need access to that restaurant.`,
      screenshots: [],
      video_url: null,
      published: true,
    });

    if (articleError) {
      console.error("Failed to seed help article:", articleError);
      process.exit(1);
    }
    console.log("Seeded help article.");
  } else {
    console.log("Help article already exists, skipping.");
  }
}

seed();
