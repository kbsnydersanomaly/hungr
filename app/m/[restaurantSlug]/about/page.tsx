import Image from "next/image";
import { loadRestaurantBySlug } from "@/lib/data/restaurants";
import { loadPublishedMenusForRestaurant } from "@/lib/data/menu-switcher-actions";
import { loadBranding } from "@/lib/data/branding";
import { createServerClient } from "@/lib/supabase/server";
import { Header } from "@/components/menu/Header";
import { MapPin, Clock, Mail, Phone } from "lucide-react";

export default async function AboutPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params;
  const restaurant = await loadRestaurantBySlug(restaurantSlug);
  const [menus, branding] = await Promise.all([
    loadPublishedMenusForRestaurant(restaurant.id),
    loadBranding(restaurant.id),
  ]);
  const defaultMenu = menus[0];

  const supabase = await createServerClient();
  const { data: about } = await supabase
    .from("about_pages")
    .select("*")
    .eq("restaurant_id", restaurant.id)
    .single();

  return (
    <div className="flex flex-col flex-1">
      <Header
        restaurantName={restaurant.name}
        logoUrl={branding?.logo_url}
        restaurantSlug={restaurantSlug}
        currentMenuSlug={defaultMenu?.slug ?? ""}
        menus={menus}
      />

      <div className="flex-1 px-4 py-6 space-y-6">
        {about?.main_image_url && (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl">
            <Image
              src={about.main_image_url}
              alt={restaurant.name}
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              className="object-cover"
            />
          </div>
        )}

        {about?.about_text && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold font-heading">About</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {about.about_text}
            </p>
          </div>
        )}

        {about?.show_business_hours && about?.business_hours && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Hours
            </h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {about.business_hours}
            </p>
          </div>
        )}

        {about?.show_contact && (about?.email || about?.phone) && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contact
            </h2>
            <div className="space-y-1 text-sm text-muted-foreground">
              {about.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {about.email}
                </p>
              )}
              {about.phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {about.phone}
                </p>
              )}
            </div>
          </div>
        )}

        {(restaurant.street || restaurant.city) && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold font-heading flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Location
            </h2>
            <p className="text-sm text-muted-foreground">
              {restaurant.street}
              {restaurant.city && `, ${restaurant.city}`}
              {restaurant.province && `, ${restaurant.province}`}
            </p>
          </div>
        )}

        {about?.gallery_urls && about.gallery_urls.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-lg font-semibold font-heading">Gallery</h2>
            <div className="grid grid-cols-2 gap-2">
              {(about.gallery_urls as string[]).map((url: string, i: number) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-lg">
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
