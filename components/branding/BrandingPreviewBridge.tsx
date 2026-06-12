"use client";

import { useEffect, useRef } from "react";
import { googleFontsUrl } from "@/lib/theme/cssVars";

export const BRANDING_PREVIEW_MESSAGE = "hungr-branding-preview";
export const BRANDING_PREVIEW_READY_MESSAGE = "hungr-branding-preview-ready";

interface PreviewMessage {
  type: typeof BRANDING_PREVIEW_MESSAGE;
  vars: Record<string, string>;
  fonts: string[];
}

/**
 * Mounted on the public menu so the branding editor (which embeds the menu
 * in an iframe) can push draft styles in live via postMessage — no save or
 * reload required for the preview to update.
 */
export function BrandingPreviewBridge() {
  const appliedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as PreviewMessage | null;
      if (!data || data.type !== BRANDING_PREVIEW_MESSAGE) return;

      const root = document.querySelector<HTMLElement>("[data-branding-root]");
      if (!root) return;

      // Remove vars that are no longer present, then apply the new set.
      for (const key of appliedKeys.current) {
        if (!(key in data.vars)) root.style.removeProperty(key);
      }
      appliedKeys.current = new Set(Object.keys(data.vars));
      for (const [key, value] of Object.entries(data.vars)) {
        root.style.setProperty(key, value);
      }

      // Load any Google Fonts the draft references.
      const href = googleFontsUrl(data.fonts ?? []);
      let link = document.getElementById(
        "branding-preview-fonts"
      ) as HTMLLinkElement | null;
      if (href) {
        if (!link) {
          link = document.createElement("link");
          link.id = "branding-preview-fonts";
          link.rel = "stylesheet";
          document.head.appendChild(link);
        }
        if (link.href !== href) link.href = href;
      } else if (link) {
        link.remove();
      }
    }

    window.addEventListener("message", handleMessage);

    // Tell the parent (branding editor) we're ready to receive draft styles.
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: BRANDING_PREVIEW_READY_MESSAGE },
        window.location.origin
      );
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
