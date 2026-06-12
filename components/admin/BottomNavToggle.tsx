"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { setBottomNavEnabledAction } from "@/lib/data/platform-settings-actions";
import { toast } from "sonner";

export function BottomNavToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const result = await setBottomNavEnabledAction(next);
      if (!result.ok) {
        setEnabled(!next);
        toast.error(result.message ?? "Failed to update setting");
        return;
      }
      toast.success(next ? "Bottom navigation enabled" : "Bottom navigation disabled");
    });
  }

  return (
    <Switch
      checked={enabled}
      onCheckedChange={handleChange}
      disabled={isPending}
      aria-label="Toggle public menu bottom navigation"
    />
  );
}
