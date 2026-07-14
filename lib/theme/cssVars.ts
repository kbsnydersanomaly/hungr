function fontStack(family: string): string {
  return `"${family}", ui-sans-serif, system-ui, sans-serif`;
}

/** Parses a #RRGGBB (or #RGB) hex color into [r, g, b] 0-255, or null. */
function parseHexColor(value: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

/**
 * Picks a readable foreground (black or white) for the given hex background
 * using WCAG relative luminance. Returns null for unparseable values.
 */
export function contrastForeground(background: string): string | null {
  const rgb = parseHexColor(background);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? "#181818" : "#FFFFFF";
}

export function brandingToCssVars(branding: Record<string, unknown> | null): React.CSSProperties {
  if (!branding) return {};

  const vars: Record<string, string> = {};

  // The Tailwind theme is configured with `@theme inline`, so utilities like
  // `text-primary` resolve `var(--primary)` directly. Override the underlying
  // root vars (plus the `--color-*` aliases for any direct var() usage).
  const colorMap: [string, string[]][] = [
    ["primary_color", ["--primary", "--color-primary"]],
    ["secondary_color", ["--secondary", "--color-secondary"]],
    ["accent_color", ["--accent", "--color-accent"]],
    ["nav_bar_color", ["--color-nav-bar"]],
    ["background_color", ["--background", "--color-background"]],
  ];

  for (const [src, dests] of colorMap) {
    const val = branding[src];
    if (typeof val === "string" && val) {
      for (const dest of dests) vars[dest] = val;
    }
  }

  // Keep nav bar icons/text readable: dark nav colors get white foreground,
  // light ones get near-black.
  const navColor = branding.nav_bar_color;
  if (typeof navColor === "string" && navColor) {
    const foreground = contrastForeground(navColor);
    if (foreground) vars["--color-nav-bar-foreground"] = foreground;
  }

  // Same for the accent: pills/tags render text on the accent background, and
  // the global --accent-foreground is a fixed near-black that disappears on a
  // dark accent.
  const accentColor = branding.accent_color;
  if (typeof accentColor === "string" && accentColor) {
    const foreground = contrastForeground(accentColor);
    if (foreground) vars["--accent-foreground"] = foreground;
  }

  const buttonMap: [string, string][] = [
    ["main_color", "--color-primary-button"],
    ["text_color", "--color-primary-button-text"],
    ["typeface", "--font-primary-button"],
    ["case", "--case-primary-button"],
  ];

  const secondaryButtonMap: [string, string][] = [
    ["main_color", "--color-secondary-button"],
    ["text_color", "--color-secondary-button-text"],
    ["typeface", "--font-secondary-button"],
    ["case", "--case-secondary-button"],
  ];

  const headingMap: [string, string][] = [
    ["color", "--color-main-heading"],
    ["typeface", "--font-main-heading"],
    ["case", "--case-main-heading"],
    ["size", "--size-main-heading"],
    ["weight", "--font-main-heading-weight"],
  ];

  const subHeadingMap: [string, string][] = [
    ["color", "--color-sub-heading"],
    ["typeface", "--font-sub-heading"],
    ["case", "--case-sub-heading"],
    ["size", "--size-sub-heading"],
    ["weight", "--font-sub-heading-weight"],
  ];

  const bodyMap: [string, string][] = [
    ["color", "--color-body"],
    ["typeface", "--font-body"],
    ["case", "--case-body"],
    ["size", "--size-body"],
    ["weight", "--font-body-weight"],
  ];

  const sections: [string, [string, string][]][] = [
    ["primary_button", buttonMap],
    ["secondary_button", secondaryButtonMap],
    ["main_heading", headingMap],
    ["sub_heading", subHeadingMap],
    ["body", bodyMap],
  ];

  for (const [sectionKey, fieldMap] of sections) {
    const section = branding[sectionKey];
    if (section && typeof section === "object" && !Array.isArray(section)) {
      const obj = section as Record<string, string>;
      for (const [field, dest] of fieldMap) {
        const val = obj[field];
        if (val) vars[dest] = val;
      }
    }
  }

  // Italic is stored as a boolean; expose it as a font-style keyword.
  const italicMap: [string, string][] = [
    ["main_heading", "--font-main-heading-style"],
    ["sub_heading", "--font-sub-heading-style"],
    ["body", "--font-body-style"],
  ];
  for (const [sectionKey, dest] of italicMap) {
    const section = branding[sectionKey];
    if (
      section &&
      typeof section === "object" &&
      !Array.isArray(section) &&
      (section as Record<string, unknown>).italic === true
    ) {
      vars[dest] = "italic";
    }
  }

  // Map the chosen typefaces onto the global font tokens so the public menu's
  // existing `font-heading` / `font-body` styling picks them up directly.
  const headingFont = (branding.main_heading as Record<string, string> | null)?.typeface;
  if (headingFont) {
    vars["--font-heading"] = fontStack(headingFont);
    vars["--font-main-heading"] = fontStack(headingFont);
  }
  const bodyFont = (branding.body as Record<string, string> | null)?.typeface;
  if (bodyFont) {
    vars["--font-body"] = fontStack(bodyFont);
  }

  return vars;
}

/** Google Font families referenced by a branding row (for <link> loading). */
export function brandingFontFamilies(
  branding: Record<string, unknown> | null
): string[] {
  if (!branding) return [];
  const families = new Set<string>();
  const heading = (branding.main_heading as Record<string, string> | null)?.typeface;
  const body = (branding.body as Record<string, string> | null)?.typeface;
  if (heading) families.add(heading);
  if (body) families.add(body);
  return [...families];
}

/** Weights always requested so Tailwind font-* utilities keep real glyphs. */
const BASE_FONT_WEIGHTS = ["400", "500", "600", "700"];

function buildGoogleFontsUrl(
  families: string[],
  weights: string[],
  italic: boolean
): string {
  const sortedWeights = [...new Set(weights)].sort();
  const params = families
    .map((f) => {
      const family = encodeURIComponent(f).replace(/%20/g, "+");
      if (italic) {
        // CSS2 requires the ital axis first, with sorted 0/1 tuples.
        const tuples = sortedWeights
          .flatMap((w) => [`0,${w}`, `1,${w}`])
          .sort();
        return `family=${family}:ital,wght@${tuples.join(";")}`;
      }
      return `family=${family}:wght@${sortedWeights.join(";")}`;
    })
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/** Builds a Google Fonts stylesheet URL for the given font families. */
export function googleFontsUrl(families: string[]): string | null {
  if (families.length === 0) return null;
  return buildGoogleFontsUrl(families, BASE_FONT_WEIGHTS, false);
}

/**
 * Builds a Google Fonts URL for a branding row: the base weights plus any
 * explicit style weights, and the italic axis when any style is italic.
 */
export function brandingGoogleFontsUrl(
  branding: Record<string, unknown> | null
): string | null {
  const families = brandingFontFamilies(branding);
  if (families.length === 0) return null;

  const weights = new Set(BASE_FONT_WEIGHTS);
  let italic = false;
  // Fallbacks mirror the CSS defaults in app/globals.css (.branding-scope).
  const styles: [unknown, string][] = [
    [branding?.main_heading, "700"],
    [branding?.sub_heading, "700"],
    [branding?.body, "400"],
  ];
  for (const [section, fallback] of styles) {
    if (section && typeof section === "object" && !Array.isArray(section)) {
      const obj = section as Record<string, unknown>;
      weights.add(
        typeof obj.weight === "string" && obj.weight ? obj.weight : fallback
      );
      if (obj.italic === true) italic = true;
    }
  }
  return buildGoogleFontsUrl(families, [...weights], italic);
}
