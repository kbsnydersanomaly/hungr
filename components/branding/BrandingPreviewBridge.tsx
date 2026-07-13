"use client";

import { useEffect, useRef } from "react";
import { googleFontsUrl } from "@/lib/theme/cssVars";

export const BRANDING_PREVIEW_MESSAGE = "hungr-branding-preview";
export const BRANDING_PREVIEW_READY_MESSAGE = "hungr-branding-preview-ready";

interface PreviewMessage {
  type: typeof BRANDING_PREVIEW_MESSAGE;
  vars: Record<string, string>;
  fonts: string[];
  // Precomputed Google Fonts URL (carries per-style weights/italic). When
  // present it takes precedence over rebuilding from `fonts`.
  fontsHref?: string | null;
  logoUrl?: string | null;
}

/**
 * Swap the header logo live in the preview document. The server-rendered
 * header has either a logo ([data-branding-logo]) or a letter avatar
 * ([data-branding-avatar]), so all directions are handled: update an existing
 * logo's src, inject a logo element when there was none, or restore/inject
 * the avatar on removal — a blank header must never be possible.
 * Extracted from the message handler so it can be unit-tested.
 */
export function applyLogoToDocument(doc: Document, logoUrl: string | null) {
  const logoWrap = doc.querySelector<HTMLElement>("[data-branding-logo]");
  const avatarWrap = doc.querySelector<HTMLElement>("[data-branding-avatar]");

  if (logoUrl) {
    if (logoWrap) {
      const img = logoWrap.querySelector("img");
      if (img) {
        // Next Image sets srcset, which would win over src — drop it.
        img.removeAttribute("srcset");
        img.src = logoUrl;
      }
      logoWrap.hidden = false;
      // Hide the avatar too (it may have been injected by a prior removal).
      if (avatarWrap) avatarWrap.hidden = true;
    } else if (avatarWrap) {
      // Inject a logo before the avatar. The markup mirrors the logo branch
      // in components/menu/Header.tsx (minus `children`, e.g. the
      // MenuSwitcher, which disappears in the preview for multi-menu
      // restaurants that had no prior logo — preview-only limitation).
      const wrap = doc.createElement("div");
      wrap.className = "flex items-center gap-2";
      wrap.setAttribute("data-branding-logo", "");
      const img = doc.createElement("img");
      img.className = "max-h-8 w-auto object-contain";
      img.alt = avatarWrap.querySelector("h1")?.textContent ?? "";
      img.src = logoUrl;
      wrap.appendChild(img);
      avatarWrap.before(wrap);
      avatarWrap.hidden = true;
    }
    return;
  }

  // Logo removed from the draft: reveal the avatar, injecting one if the
  // server only rendered the logo branch (published logo, no avatar in DOM).
  if (avatarWrap) {
    if (logoWrap) logoWrap.hidden = true;
    avatarWrap.hidden = false;
  } else if (logoWrap) {
    // Scrape the restaurant name from the logo's alt text (Header renders
    // alt={restaurantName}). Markup mirrors Header's avatar branch.
    const name = logoWrap.querySelector("img")?.alt ?? "";
    const avatar = doc.createElement("div");
    avatar.className = "flex items-center gap-3";
    avatar.setAttribute("data-branding-avatar", "");
    const circle = doc.createElement("div");
    circle.className =
      "h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary";
    circle.textContent = name.charAt(0);
    const nameCol = doc.createElement("div");
    nameCol.className = "flex flex-col";
    const h1 = doc.createElement("h1");
    h1.className = "text-base font-semibold font-heading leading-tight";
    h1.style.color = "inherit";
    h1.textContent = name;
    nameCol.appendChild(h1);
    avatar.append(circle, nameCol);
    logoWrap.before(avatar);
    logoWrap.hidden = true;
  }
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

      // Load any Google Fonts the draft references. Prefer the precomputed
      // URL (it includes the draft's weights/italic axes); fall back to
      // rebuilding from the family list for older message senders.
      const href =
        "fontsHref" in data
          ? data.fontsHref
          : googleFontsUrl(data.fonts ?? []);
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

      // Swap the header logo live (see applyLogoToDocument).
      if ("logoUrl" in data) {
        applyLogoToDocument(document, data.logoUrl ?? null);
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
