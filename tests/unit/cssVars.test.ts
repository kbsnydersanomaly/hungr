import { describe, it, expect } from "vitest";
import {
  brandingToCssVars,
  brandingFontFamilies,
  googleFontsUrl,
  contrastForeground,
} from "@/lib/theme/cssVars";

describe("contrastForeground", () => {
  it("returns white for dark backgrounds", () => {
    expect(contrastForeground("#000000")).toBe("#FFFFFF");
    expect(contrastForeground("#181818")).toBe("#FFFFFF");
    expect(contrastForeground("#1a2b3c")).toBe("#FFFFFF");
  });

  it("returns near-black for light backgrounds", () => {
    expect(contrastForeground("#FFFFFF")).toBe("#181818");
    expect(contrastForeground("#f5f5f5")).toBe("#181818");
    expect(contrastForeground("#FFE45C")).toBe("#181818");
  });

  it("supports 3-digit hex shorthand", () => {
    expect(contrastForeground("#000")).toBe("#FFFFFF");
    expect(contrastForeground("#fff")).toBe("#181818");
  });

  it("returns null for unparseable values", () => {
    expect(contrastForeground("not-a-color")).toBeNull();
    expect(contrastForeground("")).toBeNull();
    expect(contrastForeground("#12345")).toBeNull();
  });
});

describe("brandingToCssVars", () => {
  it("returns an empty object for null branding", () => {
    expect(brandingToCssVars(null)).toEqual({});
  });

  it("maps top-level colors to CSS variables", () => {
    const vars = brandingToCssVars({
      primary_color: "#FE1B54",
      secondary_color: "#16D3D2",
      accent_color: "#3CE1AF",
      background_color: "#FAFAFA",
    }) as Record<string, string>;

    expect(vars["--primary"]).toBe("#FE1B54");
    expect(vars["--color-primary"]).toBe("#FE1B54");
    expect(vars["--secondary"]).toBe("#16D3D2");
    expect(vars["--accent"]).toBe("#3CE1AF");
    expect(vars["--background"]).toBe("#FAFAFA");
  });

  it("skips empty or missing colors", () => {
    const vars = brandingToCssVars({ primary_color: "" }) as Record<string, string>;
    expect(vars["--primary"]).toBeUndefined();
  });

  it("derives a white nav foreground for dark nav bar colors", () => {
    const vars = brandingToCssVars({ nav_bar_color: "#1B1B1B" }) as Record<string, string>;
    expect(vars["--color-nav-bar"]).toBe("#1B1B1B");
    expect(vars["--color-nav-bar-foreground"]).toBe("#FFFFFF");
  });

  it("derives a dark nav foreground for light nav bar colors", () => {
    const vars = brandingToCssVars({ nav_bar_color: "#FFFFFF" }) as Record<string, string>;
    expect(vars["--color-nav-bar"]).toBe("#FFFFFF");
    expect(vars["--color-nav-bar-foreground"]).toBe("#181818");
  });

  it("omits the nav foreground when the nav color is not valid hex", () => {
    const vars = brandingToCssVars({ nav_bar_color: "tomato" }) as Record<string, string>;
    expect(vars["--color-nav-bar-foreground"]).toBeUndefined();
  });

  it("maps heading/body typography sections", () => {
    const vars = brandingToCssVars({
      main_heading: { color: "#222222", typeface: "Lobster" },
      body: { color: "#333333", typeface: "Inter" },
    }) as Record<string, string>;

    expect(vars["--color-main-heading"]).toBe("#222222");
    expect(vars["--color-body"]).toBe("#333333");
    expect(vars["--font-heading"]).toBe('"Lobster", ui-sans-serif, system-ui, sans-serif');
    expect(vars["--font-body"]).toBe('"Inter", ui-sans-serif, system-ui, sans-serif');
  });
});

describe("brandingFontFamilies", () => {
  it("returns [] for null branding", () => {
    expect(brandingFontFamilies(null)).toEqual([]);
  });

  it("collects unique heading and body typefaces", () => {
    expect(
      brandingFontFamilies({
        main_heading: { typeface: "Lobster" },
        body: { typeface: "Inter" },
      })
    ).toEqual(["Lobster", "Inter"]);

    expect(
      brandingFontFamilies({
        main_heading: { typeface: "Inter" },
        body: { typeface: "Inter" },
      })
    ).toEqual(["Inter"]);
  });
});

describe("googleFontsUrl", () => {
  it("returns null when there are no families", () => {
    expect(googleFontsUrl([])).toBeNull();
  });

  it("builds a css2 URL with plus-encoded family names", () => {
    const url = googleFontsUrl(["Open Sans"]);
    expect(url).toContain("https://fonts.googleapis.com/css2?");
    expect(url).toContain("family=Open+Sans:wght@400;500;600;700");
    expect(url).toContain("display=swap");
  });
});
