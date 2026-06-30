"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Disables all contained form controls while the enclosing form is submitting.
 * Use inside <ServerActionForm> from a Server Component, where a render-prop
 * child (which can't cross the server/client boundary) is not an option.
 */
export function FormFieldset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <fieldset disabled={pending} className={cn("min-w-0", className)}>
      {children}
    </fieldset>
  );
}
