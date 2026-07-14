"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { orgStructureHelpPath } from "@/lib/help/constants";
import { Building2, Store, X, HelpCircle } from "lucide-react";

const STORAGE_KEY = "hungr:org-structure-explainer:dismissed";

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function OrgStructureExplainer({ orgName }: { orgName: string }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "true") {
      // Sync dismissed state from localStorage on mount. This is the standard
      // pattern for avoiding SSR/client hydration mismatches with stored UI state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDismissed(true);
    }
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setIsDismissed(true);
  }

  if (!mounted || isDismissed) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="hidden rounded-full bg-primary/10 p-2 sm:block">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm">
                Your organisation contains restaurants
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss"
                onClick={dismiss}
                className="shrink-0 -mr-2 -mt-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{orgName}</span> is
              your organisation. Each restaurant inside it has its own menus,
              branding, media and team.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/settings/organization">
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  Organisation settings
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/restaurants/new">
                  <Store className="h-3.5 w-3.5 mr-1.5" />
                  Add a restaurant
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={orgStructureHelpPath()}>
                  <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                  Learn more
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
