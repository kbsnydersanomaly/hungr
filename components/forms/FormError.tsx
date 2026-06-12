"use client";

import { cn } from "@/lib/utils";

export function FormError({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className
      )}
    >
      {message}
    </div>
  );
}
