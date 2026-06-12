"use client";

import type React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DailyStats {
  day: string;
  views: number;
  searches: number;
  clicks: number;
}

interface TopItem {
  item_id: string;
  name: string;
  clicks: number;
}

interface EventBreakdown {
  event_type: string;
  count: number;
}

interface MenuSummary {
  menu_id: string;
  menu_name: string;
  total_views: number;
  total_searches: number;
  total_clicks: number;
}

interface InsightsDashboardProps {
  dailyStats: DailyStats[];
  topItems: TopItem[];
  eventBreakdown: EventBreakdown[];
  menuSummaries: MenuSummary[];
}

const CHART_COLORS = {
  views: "#FE1B54",
  searches: "#16A889",
  clicks: "#C91342",
  filter: "#68E8C2",
  redSoft: "#FF6B8F",
  greenSoft: "#9AF3D7",
};

const EVENT_COLORS = [
  CHART_COLORS.views,
  CHART_COLORS.searches,
  CHART_COLORS.clicks,
  CHART_COLORS.filter,
  CHART_COLORS.redSoft,
  CHART_COLORS.greenSoft,
];

const EVENT_LABELS: Record<string, string> = {
  view: "Views",
  search: "Searches",
  click: "Clicks",
  filter: "Filters",
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
}

const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 8 };

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function ChartContainer({
  height,
  children,
}: {
  height: number;
  children: React.ReactElement;
}) {
  return (
    <div className="min-w-0 w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function truncateLabel(label: string, maxLength = 18): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

function getCategoryAxisWidth(labels: string[], maxLength = 18): number {
  const longest = labels.reduce(
    (max, label) => Math.max(max, truncateLabel(String(label), maxLength).length),
    0
  );
  return Math.min(Math.max(Math.ceil(longest * 6.5) + 8, 36), 96);
}

function formatEventType(eventType: string): string {
  return (
    EVENT_LABELS[eventType] ??
    eventType
      .split(/[_-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function InsightsDashboard({
  dailyStats,
  topItems,
  eventBreakdown,
  menuSummaries,
}: InsightsDashboardProps) {
  const hasData = dailyStats.some((d) => d.views > 0 || d.searches > 0 || d.clicks > 0);
  const topItemsChartHeight = Math.max(280, topItems.length * 48);
  const topItemsAxisWidth = getCategoryAxisWidth(topItems.map((item) => item.name));

  return (
    <Tabs defaultValue="overview" className="flex-col space-y-4">
      <TabsList className="h-auto w-full justify-start rounded-xl bg-muted/70 p-1 sm:w-fit">
        <TabsTrigger className="h-9 flex-none px-4 py-2" value="overview">
          Overview
        </TabsTrigger>
        <TabsTrigger className="h-9 flex-none px-4 py-2" value="menus">
          Menus
        </TabsTrigger>
        <TabsTrigger className="h-9 flex-none px-4 py-2" value="items">
          Top Items
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4">
        {/* Daily activity chart */}
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Daily activity</CardTitle>
            <CardDescription>Views, searches, and clicks over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="pb-6 pt-0">
            {hasData ? (
              <ChartContainer height={300}>
                <LineChart data={dailyStats} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatDateLabel}
                    tick={{ fontSize: 12 }}
                    interval={4}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(label) => formatDateLabel(String(label))}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="views"
                    stroke={CHART_COLORS.views}
                    strokeWidth={2}
                    dot={false}
                    name="Views"
                  />
                  <Line
                    type="monotone"
                    dataKey="searches"
                    stroke={CHART_COLORS.searches}
                    strokeWidth={2}
                    dot={false}
                    name="Searches"
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke={CHART_COLORS.clicks}
                    strokeWidth={2}
                    dot={false}
                    name="Clicks"
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No activity data yet. Views will appear here once customers visit your menus." />
            )}
          </CardContent>
        </Card>

        {/* Event breakdown */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Event breakdown</CardTitle>
              <CardDescription>Distribution of event types</CardDescription>
            </CardHeader>
            <CardContent className="pb-6 pt-0">
              {eventBreakdown.length > 0 ? (
                <div className="flex flex-col gap-6">
                  <div className="mx-auto w-full max-w-[260px] min-w-0">
                    <ChartContainer height={220}>
                      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                        <Pie
                          data={eventBreakdown}
                          dataKey="count"
                          nameKey="event_type"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {eventBreakdown.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={EVENT_COLORS[index % EVENT_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [
                            Number(value).toLocaleString(),
                            formatEventType(String(name)),
                          ]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                        />
                      </PieChart>
                    </ChartContainer>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {eventBreakdown.map((event, index) => (
                      <div
                        key={event.event_type}
                        className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor: EVENT_COLORS[index % EVENT_COLORS.length],
                            }}
                          />
                          <span className="truncate">{formatEventType(event.event_type)}</span>
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">
                          {event.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState message="No event data yet." />
              )}
            </CardContent>
          </Card>

          {/* Quick stats */}
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Menu performance</CardTitle>
              <CardDescription>Views per menu (last 30 days)</CardDescription>
            </CardHeader>
            <CardContent className="pb-6 pt-0">
              {menuSummaries.length > 0 ? (
                <ChartContainer height={260}>
                  <BarChart
                    data={menuSummaries}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="menu_name"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => truncateLabel(String(value), 14)}
                      interval={0}
                      tickLine={false}
                      axisLine={false}
                      height={56}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      width={28}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      labelFormatter={(label) => String(label)}
                      contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                    />
                    <Bar
                      dataKey="total_views"
                      fill={CHART_COLORS.views}
                      name="Views"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <EmptyState message="No menu data yet." />
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="menus" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Menu breakdown</CardTitle>
            <CardDescription>Views, searches, and clicks by menu</CardDescription>
          </CardHeader>
          <CardContent className="pb-6 pt-0">
            {menuSummaries.length > 0 ? (
              <ChartContainer height={350}>
                <BarChart data={menuSummaries} margin={CHART_MARGIN}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="menu_name"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => truncateLabel(String(value), 14)}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(label) => String(label)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Legend />
                  <Bar
                    dataKey="total_views"
                    fill={CHART_COLORS.views}
                    name="Views"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="total_searches"
                    fill={CHART_COLORS.searches}
                    name="Searches"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="total_clicks"
                    fill={CHART_COLORS.clicks}
                    name="Clicks"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No menu data yet." />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="items" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading">Top items by clicks</CardTitle>
            <CardDescription>Most clicked menu items (last 30 days)</CardDescription>
          </CardHeader>
          <CardContent className="pb-6 pt-0">
            {topItems.length > 0 ? (
              <ChartContainer height={topItemsChartHeight}>
                <BarChart
                  data={topItems}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={topItemsAxisWidth}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => truncateLabel(String(value))}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    labelFormatter={(label) => String(label)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                  <Bar
                    dataKey="clicks"
                    fill={CHART_COLORS.views}
                    name="Clicks"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyState message="No click data yet. Clicks will appear here once customers interact with menu items." />
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
