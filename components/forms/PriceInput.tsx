"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PriceInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "step" | "min"
> & {
  containerClassName?: string;
};

/**
 * Composition component for entering Rand amounts. Renders a fixed "R"
 * prefix so every price field across the app looks the same.
 */
export function PriceInput({
  className,
  containerClassName,
  ...props
}: PriceInputProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      {/* Matches the input's own font sizing (text-base, md:text-sm) so the
          prefix never looks smaller or misaligned next to the typed amount. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 leading-none text-base md:text-sm text-muted-foreground"
      >
        R
      </span>
      <Input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        className={cn("pl-6.5", className)}
        {...props}
      />
    </div>
  );
}
