"use client";

import { useEffect, Suspense } from "react";
import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";

interface PostHogProviderProps {
  children: React.ReactNode;
  apiKey?: string;
  apiHost?: string;
}

function PostHogPageView({ apiKey }: { apiKey?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!apiKey || !posthog.__loaded) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, apiKey]);

  return null;
}

export function PostHogProvider({
  children,
  apiKey,
  apiHost = "https://us.i.posthog.com",
}: PostHogProviderProps) {
  useEffect(() => {
    if (!apiKey) return;
    if (typeof window === "undefined") return;
    if (posthog.__loaded) return;

    posthog.init(apiKey, {
      api_host: apiHost,
      capture_pageview: false, // We capture manually
      capture_pageleave: true,
      loaded: (posthog) => {
        if (process.env.NODE_ENV === "development") {
          posthog.debug(false);
        }
      },
    });
  }, [apiKey, apiHost]);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView apiKey={apiKey} />
      </Suspense>
      {children}
    </>
  );
}

export { posthog };
