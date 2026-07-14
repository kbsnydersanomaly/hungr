import { getActiveOrg } from "@/lib/auth/active-org";
import { getSession } from "@/lib/auth/session";
import { loadRestaurantsForUser } from "@/lib/data/restaurants";
import {
  getDailyStatsForRestaurant,
  getTopItemsForRestaurant,
  getEventBreakdownForRestaurant,
  getMenuSummariesForRestaurant,
} from "@/lib/data/analytics-actions";
import { PageHeader } from "@/components/PageHeader";
import { InsightsDashboard } from "@/components/dashboard/InsightsDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const [org, session] = await Promise.all([getActiveOrg(), getSession()]);
  const orgId = org?.orgId;
  const userId = session?.user.id;

  if (!orgId || !userId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Insights" description="Menu and visitor analytics" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No organization found.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Scoped to the current user: restaurant-scoped staff only see analytics for
  // the restaurants they were explicitly assigned to.
  const restaurants = await loadRestaurantsForUser(userId, orgId);

  if (restaurants.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Insights" description="Menu and visitor analytics" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Create a restaurant to see analytics.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Load analytics for all restaurants in the org
  const allDailyStats = await Promise.all(
    restaurants.map((r) => getDailyStatsForRestaurant(r.id, 30).catch(() => []))
  );

  const allTopItems = await Promise.all(
    restaurants.map((r) => getTopItemsForRestaurant(r.id, 10).catch(() => []))
  );

  const allEventBreakdowns = await Promise.all(
    restaurants.map((r) =>
      getEventBreakdownForRestaurant(r.id, 30).catch(() => [])
    )
  );

  const allMenuSummaries = await Promise.all(
    restaurants.map((r) =>
      getMenuSummariesForRestaurant(r.id, 30).catch(() => [])
    )
  );

  // Merge daily stats across restaurants
  const mergedDaily = new Map<string, { views: number; searches: number; clicks: number }>();
  for (const stats of allDailyStats) {
    for (const s of stats) {
      const existing = mergedDaily.get(s.day) ?? { views: 0, searches: 0, clicks: 0 };
      existing.views += s.views;
      existing.searches += s.searches;
      existing.clicks += s.clicks;
      mergedDaily.set(s.day, existing);
    }
  }

  const dailyStats = Array.from(mergedDaily.entries())
    .map(([day, stats]) => ({ day, ...stats }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // Merge top items across restaurants
  const mergedItems = new Map<string, { name: string; clicks: number }>();
  for (const items of allTopItems) {
    for (const item of items) {
      const existing = mergedItems.get(item.item_id) ?? { name: item.name, clicks: 0 };
      existing.clicks += item.clicks;
      mergedItems.set(item.item_id, existing);
    }
  }

  const topItems = Array.from(mergedItems.entries())
    .map(([item_id, stats]) => ({ item_id, ...stats }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  // Merge event breakdowns
  const mergedEvents = new Map<string, number>();
  for (const breakdowns of allEventBreakdowns) {
    for (const b of breakdowns) {
      mergedEvents.set(b.event_type, (mergedEvents.get(b.event_type) ?? 0) + b.count);
    }
  }

  const eventBreakdown = Array.from(mergedEvents.entries()).map(([event_type, count]) => ({
    event_type,
    count,
  }));

  // Merge menu summaries
  const mergedMenus = new Map<string, { name: string; views: number; searches: number; clicks: number }>();
  for (const summaries of allMenuSummaries) {
    for (const s of summaries) {
      const existing = mergedMenus.get(s.menu_id) ?? {
        name: s.menu_name,
        views: 0,
        searches: 0,
        clicks: 0,
      };
      existing.views += s.total_views;
      existing.searches += s.total_searches;
      existing.clicks += s.total_clicks;
      mergedMenus.set(s.menu_id, existing);
    }
  }

  const menuSummaries = Array.from(mergedMenus.entries()).map(([menu_id, stats]) => ({
    menu_id,
    menu_name: stats.name,
    total_views: stats.views,
    total_searches: stats.searches,
    total_clicks: stats.clicks,
  }));

  const totalViews = dailyStats.reduce((sum, d) => sum + d.views, 0);
  const totalSearches = dailyStats.reduce((sum, d) => sum + d.searches, 0);
  const totalClicks = dailyStats.reduce((sum, d) => sum + d.clicks, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insights"
        description="Menu and visitor analytics"
      />

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total views (30d)
                </p>
                <p className="text-2xl font-bold mt-1">{totalViews.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total searches (30d)
                </p>
                <p className="text-2xl font-bold mt-1">{totalSearches.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Total clicks (30d)
                </p>
                <p className="text-2xl font-bold mt-1">{totalClicks.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <InsightsDashboard
        dailyStats={dailyStats}
        topItems={topItems}
        eventBreakdown={eventBreakdown}
        menuSummaries={menuSummaries}
      />
    </div>
  );
}
