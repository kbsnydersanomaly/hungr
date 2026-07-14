import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { requireRestaurantManagement } from "@/lib/billing/management-guard";
import { PageHeader } from "@/components/PageHeader";
import { QrManager, QrDownloadLinks } from "@/components/dashboard/QrManager";
import { DesktopOnlyPage } from "@/components/dashboard/DesktopOnlyPage";

export default async function QrPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;

  let restaurant;
  try {
    restaurant = await loadRestaurantById(restaurantId);
  } catch {
    notFound();
  }
  await requireRestaurantManagement(restaurant);

  const supabase = await createServerClient();
  const { data: menus } = await supabase
    .from("menus")
    .select("id, name, slug, status, qr_assigned, qr_url")
    .eq("restaurant_id", restaurantId)
    .order("sort_order", { ascending: true });

  return (
    <DesktopOnlyPage
      title="QR Codes"
      seeCurrentHref={`/m/${restaurant.slug}`}
      seeCurrentLabel="see your menu"
      mobileExtra={
        <div className="mt-4 space-y-4">
          <QrDownloadLinks menus={menus ?? []} />
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="QR Codes"
          description={`Generate and download QR codes for ${restaurant.name}`}
        />
        <QrManager
          restaurantSlug={restaurant.slug}
          menus={menus ?? []}
        />
      </div>
    </DesktopOnlyPage>
  );
}
