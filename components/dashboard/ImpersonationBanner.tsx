"use client";

import { stopImpersonating } from "@/lib/auth/impersonation";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ImpersonationBannerProps {
  targetName: string | null;
  targetEmail: string;
}

export function ImpersonationBanner({
  targetName,
  targetEmail,
}: ImpersonationBannerProps) {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">
            Impersonating {targetName ?? targetEmail}
          </span>
          <span className="text-amber-600 dark:text-amber-400">
            — All actions will appear as this user
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => stopImpersonating()}
          className="border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          Exit impersonation
        </Button>
      </div>
    </div>
  );
}
