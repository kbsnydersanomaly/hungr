import { describe, it, expect } from "vitest";
import {
  publicAboutHref,
  publicMenuHref,
  menuSlugFromPublicMenuHref,
} from "@/lib/menu/public-routes";

const menus = [
  { slug: "lunch", is_default: false },
  { slug: "dinner", is_default: true },
  { slug: "drinks", is_default: false },
];

describe("publicAboutHref", () => {
  it("returns the about path without a menu slug", () => {
    expect(publicAboutHref("cafe")).toBe("/m/cafe/about");
  });

  it("appends the menu query param when a menu slug is provided", () => {
    expect(publicAboutHref("cafe", "dinner")).toBe("/m/cafe/about?menu=dinner");
  });

  it("encodes special characters in the menu slug", () => {
    expect(publicAboutHref("cafe", "a b")).toBe("/m/cafe/about?menu=a%20b");
  });
});

describe("publicMenuHref", () => {
  it("uses the query menu slug when it matches a published menu", () => {
    expect(publicMenuHref("cafe", menus, "lunch")).toBe("/m/cafe/lunch");
  });

  it("ignores unknown query menu slugs", () => {
    expect(publicMenuHref("cafe", menus, "unknown")).toBe("/m/cafe/dinner");
  });

  it("falls back to the default menu when no query is provided", () => {
    expect(publicMenuHref("cafe", menus)).toBe("/m/cafe/dinner");
  });

  it("falls back to the first menu when no default is set", () => {
    const noDefault = [
      { slug: "lunch", is_default: false },
      { slug: "drinks", is_default: false },
    ];
    expect(publicMenuHref("cafe", noDefault)).toBe("/m/cafe/lunch");
  });

  it("falls back to the restaurant root when there are no menus", () => {
    expect(publicMenuHref("cafe", [])).toBe("/m/cafe");
  });
});

describe("menuSlugFromPublicMenuHref", () => {
  it("extracts the menu slug from a menu href", () => {
    expect(menuSlugFromPublicMenuHref("cafe", "/m/cafe/dinner")).toBe("dinner");
  });

  it("returns empty string for restaurant root href", () => {
    expect(menuSlugFromPublicMenuHref("cafe", "/m/cafe")).toBe("");
  });
});
