"use client";

import { useEffect } from "react";
import { setActiveRestaurant } from "@/lib/auth/active-restaurant";

export function TrackActiveRestaurant({
  restaurantId,
}: {
  restaurantId: string;
}) {
  useEffect(() => {
    // Best-effort cookie update; failure just means the sidebar falls back
    // to the first restaurant.
    setActiveRestaurant(restaurantId).catch(() => {});
  }, [restaurantId]);

  return null;
}
