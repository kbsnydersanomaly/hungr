import { getUnreadNotificationCount, listUnreadNotifications } from "@/lib/data/notification-actions";
import { NotificationBell } from "./NotificationBell";

export async function NotificationBellServer() {
  const [countResult, listResult] = await Promise.all([
    getUnreadNotificationCount(),
    listUnreadNotifications(),
  ]);

  const count = countResult.ok ? (countResult.data ?? 0) : 0;
  const notifications = listResult.ok
    ? (listResult.data ?? []).map((n) => ({
        ...n,
        payload: n.payload as Record<string, unknown> | null,
      }))
    : [];

  return <NotificationBell count={count} notifications={notifications} />;
}
