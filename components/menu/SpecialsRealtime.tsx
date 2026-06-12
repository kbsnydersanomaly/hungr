"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export function SpecialsRealtime({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`specials:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "specials",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, router]);

  return null;
}
