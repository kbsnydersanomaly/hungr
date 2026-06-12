"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { brandingToCssVars } from "@/lib/theme/cssVars";

export function BrandingRealtime({ restaurantId }: { restaurantId: string }) {
  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`branding:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "branding",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const vars = brandingToCssVars(payload.new);
          const root =
            document.querySelector<HTMLElement>("[data-branding-root]") ??
            document.documentElement;
          Object.entries(vars).forEach(([key, value]) => {
            if (value) root.style.setProperty(key, String(value));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return null;
}
