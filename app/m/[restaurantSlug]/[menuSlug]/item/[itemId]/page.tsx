import { notFound } from "next/navigation";
import { loadMenuBySlug, loadCategoriesForMenu, loadSubcategoriesForMenu, buildCategoryTree } from "@/lib/data/menus";
import { loadRestaurantBySlug } from "@/lib/data/restaurants";
import Image from "next/image";
import { loadApprovedReviewsForItem, loadReviewStatsForItem } from "@/lib/data/reviews";
import {
  loadCombosForItem,
  loadPairedItems,
  loadRecommendedItems,
} from "@/lib/data/item-detail-actions";
import { loadActiveSpecialsForRestaurant } from "@/lib/data/specials";
import { loadBranding } from "@/lib/data/branding";
import { loadPublishedMenusForRestaurant } from "@/lib/data/menu-switcher-actions";
import {
  applicableItemDiscount,
  currentScheduleContext,
  filterActiveSpecials,
} from "@/lib/utils/specials";
import { formatZar } from "@/lib/utils/money";
import { Header } from "@/components/menu/Header";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ImageCarousel } from "@/components/menu/ImageCarousel";
import { RecommendedCard } from "@/components/menu/RecommendedCard";
import { getItemDiscount } from "@/lib/specials/discounts";
import { Star, Sparkles } from "lucide-react";

type Variant = { name?: string; price_cents?: number };

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string; menuSlug: string; itemId: string }>;
}) {
  const { restaurantSlug, menuSlug, itemId } = await params;

  const restaurant = await loadRestaurantBySlug(restaurantSlug);
  const menu = await loadMenuBySlug(restaurantSlug, menuSlug);

  const supabase = await import("@/lib/supabase/server").then((m) => m.createServerClient());
  const { data: rawItem } = await supabase
    .from("menu_items")
    .select("*")
    .eq("id", itemId)
    .eq("menu_id", menu.id)
    .single();

  if (!rawItem) notFound();

  const item = {
    ...rawItem,
    preparations: (rawItem.preparations ?? []) as { name: string; price_cents?: number }[],
    variations: (rawItem.variations ?? []) as { name: string; price_cents?: number }[],
    sides: (rawItem.sides ?? []) as { name: string; price_cents?: number }[],
    sauces: (rawItem.sauces ?? []) as { name: string; price_cents?: number }[],
  };

  const images: string[] =
    rawItem.image_urls && rawItem.image_urls.length > 0
      ? rawItem.image_urls
      : rawItem.image_url
        ? [rawItem.image_url]
        : [];

  const [reviews, stats, combos, paired, recommended, branding, specials, topCategories, subCategories, menus] = await Promise.all([
    loadApprovedReviewsForItem(itemId),
    loadReviewStatsForItem(itemId),
    loadCombosForItem(itemId),
    loadPairedItems(menu.id, (rawItem.pairing_ids ?? []) as string[]),
    loadRecommendedItems(menu.id, itemId, 4),
    loadBranding(restaurant.id),
    loadActiveSpecialsForRestaurant(restaurant.id),
    loadCategoriesForMenu(menu.id),
    loadSubcategoriesForMenu(menu.id),
    loadPublishedMenusForRestaurant(restaurant.id),
  ]);
  const categories = buildCategoryTree(topCategories, subCategories).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const discount = applicableItemDiscount(
    { id: item.id, category_id: rawItem.category_id, price_cents: item.price_cents },
    filterActiveSpecials(specials, currentScheduleContext())
  );

  const itemDiscount = getItemDiscount(rawItem, specials, { menuId: menu.id });

  return (
    <div className="flex flex-col flex-1">
      <Header
        restaurantName={restaurant.name}
        logoUrl={branding?.logo_url}
        restaurantSlug={restaurantSlug}
        currentMenuSlug={menuSlug}
        menus={menus}
        categories={categories}
      />

      <div className="flex-1 px-4 py-6 space-y-6">
        {images.length > 0 && <ImageCarousel images={images} alt={item.name} />}

        <div>
          <h1 className="text-2xl font-bold font-heading">{item.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {itemDiscount.discount_label ? (
              <>
                <p className="text-sm text-muted-foreground line-through">
                  R {(itemDiscount.original_price_cents / 100).toFixed(2)}
                </p>
                <p className="text-lg font-medium text-primary">
                  R {(itemDiscount.discounted_price_cents / 100).toFixed(2)}
                </p>
                <span className="inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                  {itemDiscount.discount_label}
                </span>
              </>
            ) : (
              <p className="text-lg font-medium text-primary">
                R {(item.price_cents / 100).toFixed(2)}
              </p>
            )}
          </div>
        </div>

        {item.description && (
          <p className="text-sm menu-description">{item.description}</p>
        )}

        {item.allergens && item.allergens.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Allergens
            </p>
            <div className="flex flex-wrap gap-2">
              {item.allergens.map((allergen: string) => (
                <span key={allergen} className="text-xs px-2 py-1 rounded-full bg-muted">
                  {allergen}
                </span>
              ))}
            </div>
          </div>
        )}

        {item.labels && item.labels.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Labels
            </p>
            <div className="flex flex-wrap gap-2">
              {item.labels.map((label: string) => (
                <span
                  key={label}
                  className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {item.preparations &&
          Array.isArray(item.preparations) &&
          item.preparations.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Preparations
              </p>
              <div className="space-y-1">
                {item.preparations.map((p: Variant, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{p.name}</span>
                    {p.price_cents ? (
                      <span className="text-muted-foreground">
                        +R {(p.price_cents / 100).toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

        {item.variations &&
          Array.isArray(item.variations) &&
          item.variations.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Variations
              </p>
              <div className="space-y-1">
                {item.variations.map((v: Variant, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{v.name}</span>
                    {v.price_cents ? (
                      <span className="text-muted-foreground">
                        +R {(v.price_cents / 100).toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

        {item.sides &&
          Array.isArray(item.sides) &&
          item.sides.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Sides
              </p>
              <div className="space-y-1">
                {item.sides.map((s: Variant, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{s.name}</span>
                    {s.price_cents ? (
                      <span className="text-muted-foreground">
                        +R {(s.price_cents / 100).toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

        {item.sauces &&
          Array.isArray(item.sauces) &&
          item.sauces.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                Sauces
              </p>
              <div className="space-y-1">
                {item.sauces.map((s: Variant, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{s.name}</span>
                    {s.price_cents ? (
                      <span className="text-muted-foreground">
                        +R {(s.price_cents / 100).toFixed(2)}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

        {combos.length > 0 && (
          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold font-heading">Combo deals</h2>
            </div>
            <div className="space-y-3">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className="flex items-start gap-3 rounded-xl border bg-card p-3"
                >
                  {combo.image_url && (
                    <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={combo.image_url}
                        alt={combo.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{combo.title}</h3>
                    {combo.description && (
                      <p className="text-xs menu-description line-clamp-2 mt-0.5">
                        {combo.description}
                      </p>
                    )}
                    {combo.combo_price_cents ? (
                      <span className="inline-flex mt-1.5 items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        R {(combo.combo_price_cents / 100).toFixed(2)}
                      </span>
                    ) : combo.discount_pct ? (
                      <span className="inline-flex mt-1.5 items-center rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                        Save {combo.discount_pct}%
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {paired.length > 0 && (
          <div className="border-t pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold font-heading">Pairs well with</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {paired.map((pairItem) => (
                <RecommendedCard
                  key={pairItem.id}
                  item={pairItem}
                  restaurantSlug={restaurantSlug}
                  menuSlug={menuSlug}
                  menuId={menu.id}
                />
              ))}
            </div>
          </div>
        )}

        {paired.length === 0 && recommended.length > 0 && (
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold font-heading mb-4">You might also like</h2>
            <div className="grid grid-cols-2 gap-3">
              {recommended.map((recItem) => (
                <RecommendedCard
                  key={recItem.id}
                  item={recItem}
                  restaurantSlug={restaurantSlug}
                  menuSlug={menuSlug}
                  menuId={menu.id}
                />
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold font-heading">Reviews</h2>
            {stats && (
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span>{stats.avg_rating}</span>
                <span className="text-muted-foreground">({stats.total})</span>
              </div>
            )}
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-4 mb-6">
              {reviews.map((review) => (
                <div key={review.id} className="border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{review.customer_name}</span>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < review.rating
                              ? "fill-primary text-primary"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">No reviews yet. Be the first!</p>
          )}

          <ReviewForm menuItemId={itemId} restaurantId={restaurant.id} />
        </div>
      </div>

    </div>
  );
}
