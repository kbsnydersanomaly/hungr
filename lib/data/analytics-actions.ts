"use server";

import { requireRestaurantAccess } from "@/lib/auth/role";
import { actionError } from "@/lib/errors";

export interface DailyStats {
  day: string;
  views: number;
  searches: number;
  clicks: number;
}

export interface TopItem {
  item_id: string;
  name: string;
  clicks: number;
}

export interface EventBreakdown {
  event_type: string;
  count: number;
}

export interface MenuSummary {
  menu_id: string;
  menu_name: string;
  total_views: number;
  total_searches: number;
  total_clicks: number;
}

/**
 * Get daily analytics stats for a restaurant's menus.
 * Falls back to raw analytics_events aggregation if analytics_daily is empty.
 */
export async function getDailyStatsForRestaurant(
  restaurantId: string,
  days = 30
): Promise<DailyStats[]> {
  const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromIso = fromDate.toISOString();

  // Try analytics_daily first
  const { data: dailyData, error: dailyError } = await supabase
    .from("analytics_daily")
    .select("day, views, searches, clicks")
    .gte("day", fromIso.slice(0, 10))
    .order("day", { ascending: true });

  if (!dailyError && dailyData && dailyData.length > 0) {
    return dailyData.map((d) => ({
      day: d.day,
      views: d.views,
      searches: d.searches,
      clicks: d.clicks,
    }));
  }

  // Fallback: aggregate from analytics_events
  const { data: menus } = await supabase
    .from("menus")
    .select("id")
    .eq("restaurant_id", restaurantId);

  const menuIds = menus?.map((m) => m.id) ?? [];
  if (menuIds.length === 0) return [];

  const { data: events, error } = await supabase
    .from("analytics_events")
    .select("event_type, occurred_at")
    .in("menu_id", menuIds)
    .gte("occurred_at", fromIso)
    .order("occurred_at", { ascending: true });

  if (error) {
    console.error("getDailyStats error:", error);
    throw actionError("Failed to load analytics", error);
  }

  // Group by day
  const grouped = new Map<string, { views: number; searches: number; clicks: number }>();

  for (const event of events ?? []) {
    const day = event.occurred_at.slice(0, 10);
    const existing = grouped.get(day) ?? { views: 0, searches: 0, clicks: 0 };

    if (event.event_type === "view") existing.views++;
    else if (event.event_type === "search") existing.searches++;
    else if (event.event_type === "click") existing.clicks++;

    grouped.set(day, existing);
  }

  // Fill in missing days with zeros
  const result: DailyStats[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - i));
    const dayStr = d.toISOString().slice(0, 10);
    const stats = grouped.get(dayStr) ?? { views: 0, searches: 0, clicks: 0 };
    result.push({ day: dayStr, ...stats });
  }

  return result;
}

/**
 * Get top clicked items for a restaurant.
 */
export async function getTopItemsForRestaurant(
  restaurantId: string,
  limit = 10
): Promise<TopItem[]> {
  const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

  const { data: menus } = await supabase
    .from("menus")
    .select("id")
    .eq("restaurant_id", restaurantId);

  const menuIds = menus?.map((m) => m.id) ?? [];
  if (menuIds.length === 0) return [];

  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name")
    .in("menu_id", menuIds);

  if (error || !items || items.length === 0) return [];

  const itemIds = items.map((i) => i.id);
  const itemMap = new Map(items.map((i) => [i.id, i.name]));

  const { data: clicks, error: clickError } = await supabase
    .from("analytics_events")
    .select("item_id")
    .in("item_id", itemIds)
    .eq("event_type", "click");

  if (clickError) {
    console.error("getTopItems error:", clickError);
    return [];
  }

  const counts = new Map<string, number>();
  for (const c of clicks ?? []) {
    if (!c.item_id) continue;
    counts.set(c.item_id, (counts.get(c.item_id) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([item_id, clicks]) => ({
      item_id,
      name: itemMap.get(item_id) ?? "Unknown",
      clicks,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
}

/**
 * Get event type breakdown for a restaurant.
 */
export async function getEventBreakdownForRestaurant(
  restaurantId: string,
  days = 30
): Promise<EventBreakdown[]> {
  const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data: menus } = await supabase
    .from("menus")
    .select("id")
    .eq("restaurant_id", restaurantId);

  const menuIds = menus?.map((m) => m.id) ?? [];
  if (menuIds.length === 0) return [];

  const { data: events, error } = await supabase
    .from("analytics_events")
    .select("event_type")
    .in("menu_id", menuIds)
    .gte("occurred_at", fromDate.toISOString());

  if (error) {
    console.error("getEventBreakdown error:", error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const e of events ?? []) {
    counts.set(e.event_type, (counts.get(e.event_type) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([event_type, count]) => ({
    event_type,
    count,
  }));
}

/**
 * Get total menu views across all menus for a restaurant (for dashboard stat).
 */
export async function getTotalMenuViewsForRestaurant(
  restaurantId: string,
  days = 30
): Promise<number> {
  const { supabase } = await requireRestaurantAccess(restaurantId, "staff");

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data: menus } = await supabase
    .from("menus")
    .select("id")
    .eq("restaurant_id", restaurantId);

  const menuIds = menus?.map((m) => m.id) ?? [];
  if (menuIds.length === 0) return 0;

  const { count, error } = await supabase
    .from("analytics_events")
    .select("*", { count: "exact", head: true })
    .in("menu_id", menuIds)
    .eq("event_type", "view")
    .gte("occurred_at", fromDate.toISOString());

  if (error) {
    console.error("getTotalMenuViews error:", error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Get menu-level summary stats for a restaurant.
 */
export async function getMenuSummariesForRestaurant(
  restaurantId: string,
  days = 30
): Promise<MenuSummary[]> {
  const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);

  const { data: menus, error: menuError } = await supabase
    .from("menus")
    .select("id, name")
    .eq("restaurant_id", restaurantId);

  if (menuError || !menus || menus.length === 0) return [];

  const menuIds = menus.map((m) => m.id);

  const { data: events, error } = await supabase
    .from("analytics_events")
    .select("menu_id, event_type")
    .in("menu_id", menuIds)
    .gte("occurred_at", fromDate.toISOString());

  if (error) {
    console.error("getMenuSummaries error:", error);
    return [];
  }

  const stats = new Map<
    string,
    { name: string; views: number; searches: number; clicks: number }
  >();

  for (const menu of menus) {
    stats.set(menu.id, { name: menu.name, views: 0, searches: 0, clicks: 0 });
  }

  for (const e of events ?? []) {
    if (!e.menu_id) continue;
    const s = stats.get(e.menu_id);
    if (!s) continue;
    if (e.event_type === "view") s.views++;
    else if (e.event_type === "search") s.searches++;
    else if (e.event_type === "click") s.clicks++;
  }

  return Array.from(stats.entries()).map(([menu_id, s]) => ({
    menu_id,
    menu_name: s.name,
    total_views: s.views,
    total_searches: s.searches,
    total_clicks: s.clicks,
  }));
}
