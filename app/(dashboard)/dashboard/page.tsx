import Link from "next/link";
import { getActiveOrg } from "@/lib/auth/active-org";
import { getSession } from "@/lib/auth/session";
import { loadRestaurantsForUser } from "@/lib/data/restaurants";
import { getTotalMenuViewsForRestaurant } from "@/lib/data/analytics-actions";
import { createServerClient } from "@/lib/supabase/server";
import { getRestaurantBillingContext } from "@/lib/billing/pricing";
import type { OrgRole } from "@/lib/auth/role";
import { PageHeader } from "@/components/PageHeader";
import { AddRestaurantButton } from "@/components/dashboard/AddRestaurantButton";
import { AddRestaurantCard, RestaurantCard } from "@/components/dashboard/RestaurantCard";
import { LinkButton } from "@/components/ui/link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UtensilsCrossed, TrendingUp, Users, Star, Plus, CheckCircle2, Circle } from "lucide-react";

export default async function DashboardPage() {
  const [org, session] = await Promise.all([getActiveOrg(), getSession()]);
  const orgId = org?.orgId;
  const userId = session?.user.id;
  const restaurants = orgId && userId ? await loadRestaurantsForUser(userId, orgId) : [];
  const billing = orgId ? await getRestaurantBillingContext(orgId) : null;

  if (restaurants.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Get started with your first restaurant"
        />
        <Card>
          <CardContent className="py-16 text-center">
            <UtensilsCrossed className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-2">Add your first restaurant</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              Create a restaurant to start building menus, generating QR codes, and managing your brand.
            </p>
            <LinkButton href="/restaurants/new" icon={<Plus />} size="lg">
              Add restaurant
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createServerClient();

  // Query real stats
  const restaurantIds = restaurants.map((r) => r.id);

  const [{ count: menuCount }, { count: teamCount }, { data: reviewsData }, menuViewsArr] =
    await Promise.all([
      supabase
        .from("menus")
        .select("*", { count: "exact", head: true })
        .in("restaurant_id", restaurantIds),
      supabase
        .from("organization_members")
        .select("*", { count: "exact", head: true })
        .eq("org_id", orgId!),
      supabase
        .from("reviews")
        .select("rating, status")
        .in("restaurant_id", restaurantIds),
      Promise.all(
        restaurants.map((r) => getTotalMenuViewsForRestaurant(r.id, 30).catch(() => 0))
      ),
    ]);

  const publishedMenus =
    menuCount ?? 0;

  const pendingReviews =
    reviewsData?.filter((r) => r.status === "pending").length ?? 0;

  const approvedReviews =
    reviewsData?.filter((r) => r.status === "approved") ?? [];

  const avgRating =
    approvedReviews.length > 0
      ? (
          approvedReviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) /
          approvedReviews.length
        ).toFixed(1)
      : "—";

  // Setup checklist based on first restaurant (or most incomplete)
  const firstRestaurant = restaurants[0];
  const [{ data: menus }, { data: branding }, { data: about }] = await Promise.all([
    supabase.from("menus").select("id, status, qr_assigned").eq("restaurant_id", firstRestaurant.id),
    supabase.from("branding").select("restaurant_id").eq("restaurant_id", firstRestaurant.id).maybeSingle(),
    supabase.from("about_pages").select("restaurant_id").eq("restaurant_id", firstRestaurant.id).maybeSingle(),
  ]);

  const hasPublishedMenu = menus?.some((m) => m.status === "published") ?? false;
  const hasQr = menus?.some((m) => m.qr_assigned) ?? false;
  const hasBranding = !!branding;
  const hasAbout = !!about;
  const hasMenus = (menus?.length ?? 0) > 0;

  const checklist = [
    { label: "Create your first restaurant", done: true },
    { label: "Add a menu", done: hasMenus },
    { label: "Publish a menu", done: hasPublishedMenu },
    { label: "Upload a logo", done: hasBranding },
    { label: "Set your brand colors", done: hasBranding },
    { label: "Fill in your about page", done: hasAbout },
    { label: "Generate a QR code", done: hasQr },
  ];

  const completedCount = checklist.filter((c) => c.done).length;
  const progress = Math.round((completedCount / checklist.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your restaurant performance"
        action={
          <AddRestaurantButton role={(org?.role as OrgRole) ?? "staff"} billing={billing} />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total menus", value: String(publishedMenus), icon: UtensilsCrossed },
          { label: "Menu views", value: String(menuViewsArr.reduce((a, b) => a + b, 0)), icon: TrendingUp },
          { label: "Team members", value: String(teamCount ?? 1), icon: Users },
          { label: "Avg. rating", value: avgRating, icon: Star },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">Your restaurants</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
          <AddRestaurantCard />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Recent activity</CardTitle>
            <CardDescription>Coming in Phase 4</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="font-heading">Setup checklist</CardTitle>
                <CardDescription>
                  {completedCount} of {checklist.length} completed
                </CardDescription>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{progress}%</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <span className={item.done ? "text-muted-foreground line-through" : ""}>
                  {item.label}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {pendingReviews > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Pending reviews</p>
              <p className="text-xs text-muted-foreground">
                You have {pendingReviews} review{pendingReviews === 1 ? "" : "s"} waiting for moderation
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/restaurants/${firstRestaurant.id}/reviews`}>
                Moderate
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
