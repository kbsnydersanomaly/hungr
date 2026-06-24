import { notFound } from "next/navigation";
import { loadRestaurantBySlug } from "@/lib/data/restaurants";
import { loadBranding } from "@/lib/data/branding";
import { isBottomNavEnabled } from "@/lib/data/platform-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isRestaurantSubscriptionValid,
  loadRestaurantSubscriptions,
} from "@/lib/billing/subscription";
import {
  brandingToCssVars,
  brandingFontFamilies,
  googleFontsUrl,
} from "@/lib/theme/cssVars";
import { BrandingRealtime } from "@/components/branding/BrandingRealtime";
import { BrandingPreviewBridge } from "@/components/branding/BrandingPreviewBridge";
import { SpecialsRealtime } from "@/components/menu/SpecialsRealtime";
import { BottomNav } from "@/components/menu/BottomNav";

export default async function PublicMenuLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;

  const restaurant = await loadRestaurantBySlug(restaurantSlug);
  if (!restaurant) notFound();

  const subscriptions = await loadRestaurantSubscriptions(
    createAdminClient(),
    restaurant
  );
  const validity = isRestaurantSubscriptionValid(subscriptions);
  if (!validity.valid) {
    notFound();
  }

  const [branding, showBottomNav] = await Promise.all([
    loadBranding(restaurant.id),
    isBottomNavEnabled(),
  ]);
  const cssVars = brandingToCssVars(branding);
  const fontsHref = googleFontsUrl(brandingFontFamilies(branding));

  return (
    <div
      data-branding-root
      className="branding-scope min-h-dvh flex flex-col"
      style={cssVars}
    >
      {fontsHref && (

        <link rel="stylesheet" href={fontsHref} />
      )}
      <BrandingRealtime restaurantId={restaurant.id} />
      <BrandingPreviewBridge />
      <SpecialsRealtime restaurantId={restaurant.id} />
      {/* The public menu is designed for phones — cap it at phone width even
          on desktop. */}
      <div className="mx-auto flex w-full max-w-[600px] flex-1 flex-col">
        {children}
        {showBottomNav && <BottomNav active="menu" />}
      </div>
    </div>
  );
}
