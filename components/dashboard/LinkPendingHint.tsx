"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * Fixed-size pulsing dot shown while the enclosing <Link>'s navigation is
 * pending. Always rendered (visibility toggled via CSS) to avoid layout
 * shift; the fade-in is delayed ~120ms (see .link-hint in globals.css) so
 * fast navigations never flash it.
 */
export function LinkPendingHint() {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden className={cn("link-hint", pending && "is-pending")} />
  );
}
