import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, MapPin, ExternalLink } from "lucide-react";

export default async function RestaurantHomePage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const restaurant = await loadRestaurantById(restaurantId);

  const supabase = await createServerClient();

  const [{ data: menus }, { data: branding }, { data: about }, { data: reviews }] = await Promise.all([
    supabase.from("menus").select("id, name, status, qr_assigned").eq("restaurant_id", restaurantId),
    supabase.from("branding").select("restaurant_id").eq("restaurant_id", restaurantId).maybeSingle(),
    supabase.from("about_pages").select("restaurant_id").eq("restaurant_id", restaurantId).maybeSingle(),
    supabase.from("reviews").select("id", { count: "exact" }).eq("restaurant_id", restaurantId),
  ]);

  const publishedMenus = menus?.filter((m) => m.status === "published") ?? [];
  const hasBranding = !!branding;
  const hasAbout = !!about;

  const checklist = [
    {
      label: "Add your first menu",
      done: (menus?.length ?? 0) > 0,
      href: `/restaurants/${restaurantId}/menus`,
    },
    {
      label: "Publish a menu",
      done: publishedMenus.length > 0,
      href: `/restaurants/${restaurantId}/menus`,
    },
    {
      label: "Upload a logo",
      done: hasBranding,
      href: `/restaurants/${restaurantId}/branding`,
    },
    {
      label: "Set your brand colors",
      done: hasBranding,
      href: `/restaurants/${restaurantId}/branding`,
    },
    {
      label: "Fill in your about page",
      done: hasAbout,
      href: `/restaurants/${restaurantId}/about`,
    },
    {
      label: "Generate a QR code",
      done: publishedMenus.some((m) => m.qr_assigned),
      href: `/restaurants/${restaurantId}/qr`,
    },
  ];

  const completedCount = checklist.filter((c) => c.done).length;
  const progress = Math.round((completedCount / checklist.length) * 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="font-heading">Setup checklist</CardTitle>
                <CardDescription>
                  {completedCount} of {checklist.length} completed
                </CardDescription>
              </div>
              <Badge variant="outline">{progress}%</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item) => (
              <div key={item.label} className="flex flex-wrap items-center gap-3">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
                {!item.done && (
                  <Button variant="link" size="sm" className="ml-auto" asChild>
                    <Link href={item.href}>Go</Link>
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Restaurant details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium">Status</p>
              <Badge variant={restaurant.status === "active" ? "default" : "secondary"}>
                {restaurant.status}
              </Badge>
            </div>

            {(restaurant.street || restaurant.city) && (
              <div>
                <p className="text-sm font-medium">Address</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[restaurant.street, restaurant.city, restaurant.province].filter(Boolean).join(", ")}
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium">Public menu</p>
              <Button variant="link" size="sm" className="px-0" asChild>
                <a href={`/m/${restaurant.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  /m/{restaurant.slug}
                </a>
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium">Menus</p>
              <p className="text-sm text-muted-foreground">{menus?.length ?? 0} total, {publishedMenus.length} published</p>
            </div>

            <div>
              <p className="text-sm font-medium">Reviews</p>
              <p className="text-sm text-muted-foreground">{reviews?.length ?? 0} total</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
