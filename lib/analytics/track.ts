import { createBrowserClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/database.types";

let sessionId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId =
      typeof crypto !== "undefined"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
  }
  return sessionId;
}

export async function trackEvent({
  menuId,
  itemId,
  eventType,
  metadata,
}: {
  menuId: string;
  itemId?: string;
  eventType: "view" | "search" | "click" | "filter";
  metadata?: Record<string, unknown>;
}) {
  try {
    const supabase = createBrowserClient();
    await supabase.from("analytics_events").insert({
      menu_id: menuId,
      item_id: itemId ?? null,
      event_type: eventType,
      session_id: getSessionId(),
      metadata: (metadata ?? null) as Json,
    });
  } catch {
    // Silently fail — analytics should never break the user experience
  }
}
