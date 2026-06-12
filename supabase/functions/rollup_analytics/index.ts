import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

interface AnalyticsEvent {
  menu_id: string;
  item_id: string | null;
  event_type: "view" | "search" | "click" | "filter";
}

serve(async (req) => {
  // Verify cron secret if provided
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response("Missing Supabase credentials", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // Calculate yesterday's date range
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date(yesterday);
  today.setDate(today.getDate() + 1);

  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  try {
    // Fetch raw events from yesterday
    const { data: events, error: fetchError } = await supabase
      .from("analytics_events")
      .select("menu_id, item_id, event_type")
      .gte("occurred_at", yesterday.toISOString())
      .lt("occurred_at", today.toISOString());

    if (fetchError) {
      console.error("Failed to fetch events:", fetchError);
      return new Response(`Fetch error: ${fetchError.message}`, { status: 500 });
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No events to rollup", processed: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Aggregate per (menu_id, item_id)
    const aggregated = new Map<
      string,
      { menu_id: string; item_id: string; views: number; searches: number; clicks: number }
    >();

    for (const event of events as AnalyticsEvent[]) {
      const itemId = event.item_id ?? "00000000-0000-0000-0000-000000000000";
      const key = `${event.menu_id}:${itemId}`;

      const existing = aggregated.get(key);
      if (existing) {
        if (event.event_type === "view") existing.views++;
        else if (event.event_type === "search") existing.searches++;
        else if (event.event_type === "click") existing.clicks++;
      } else {
        aggregated.set(key, {
          menu_id: event.menu_id,
          item_id: itemId,
          views: event.event_type === "view" ? 1 : 0,
          searches: event.event_type === "search" ? 1 : 0,
          clicks: event.event_type === "click" ? 1 : 0,
        });
      }
    }

    // Upsert into analytics_daily
    const rows = Array.from(aggregated.values()).map((row) => ({
      menu_id: row.menu_id,
      day: yesterdayStr,
      item_id: row.item_id === "00000000-0000-0000-0000-000000000000" ? null : row.item_id,
      views: row.views,
      searches: row.searches,
      clicks: row.clicks,
    }));

    const { error: upsertError } = await supabase
      .from("analytics_daily")
      .upsert(rows, {
        onConflict: "menu_id, day, item_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("Failed to upsert analytics_daily:", upsertError);
      return new Response(`Upsert error: ${upsertError.message}`, { status: 500 });
    }

    // Optional: trim raw events older than 90 days
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error: trimError } = await supabase
      .from("analytics_events")
      .delete()
      .lt("occurred_at", ninetyDaysAgo.toISOString());

    if (trimError) {
      console.error("Failed to trim old events:", trimError);
      // Don't fail the whole job over trimming
    }

    return new Response(
      JSON.stringify({
        ok: true,
        day: yesterdayStr,
        processed: events.length,
        aggregated: rows.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      `Error: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
});
