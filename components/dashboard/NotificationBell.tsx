"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

interface NotificationBellProps {
  count: number;
  notifications: Notification[];
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatNotification(n: Notification): string {
  const p = n.payload ?? {};
  switch (n.type) {
    case "review":
      return `New review on "${p.item_name ?? "an item"}"`;
    case "payment":
      return p.status === "success" ? "Payment received" : "Payment failed";
    case "team":
      return `${p.action ?? "Team update"}: ${p.member_name ?? ""}`;
    default:
      return (p.title as string) ?? "New notification";
  }
}

export function NotificationBell({ count, notifications }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label={
          count > 0 ? `Notifications (${count} unread)` : "Notifications"
        }
        className="relative h-8 w-8 rounded-full flex items-center justify-center outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {notifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
            No new notifications
          </div>
        ) : (
          notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-1 cursor-pointer"
              onClick={() => {
                setOpen(false);
                router.push("/settings/notifications");
              }}
            >
              <span className="text-sm">{formatNotification(n)}</span>
              <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuItem
          className="justify-center text-xs text-muted-foreground cursor-pointer"
          onClick={() => {
            setOpen(false);
            router.push("/settings/notifications");
          }}
        >
          View all settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
