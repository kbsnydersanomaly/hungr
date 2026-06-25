"use client";

import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Renders `icon` normally, swapping to a spinner while the enclosing
 * <Link> navigation is pending. Must be a descendant of a <Link>.
 */
export function LinkPendingIcon({ icon }: { icon: ReactNode }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  ) : (
    icon
  );
}
