import { describe, it, expect } from "vitest";
import {
  HeadingStyleSchema,
  BodyStyleSchema,
  BrandingDraftSchema,
} from "@/lib/schemas/branding";

describe("HeadingStyleSchema", () => {
  it("parses existing rows without weight/italic", () => {
    const parsed = HeadingStyleSchema.safeParse({
      color: "#222222",
      typeface: "Lobster",
      case: "uppercase",
      size: "lg",
    });
    expect(parsed.success).toBe(true);
  });

  it("parses weight and italic", () => {
    const parsed = HeadingStyleSchema.safeParse({
      weight: "700",
      italic: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data?.weight).toBe("700");
      expect(parsed.data?.italic).toBe(true);
    }
  });

  it("rejects weights outside the offered set", () => {
    expect(HeadingStyleSchema.safeParse({ weight: "900" }).success).toBe(false);
    expect(HeadingStyleSchema.safeParse({ weight: "bold" }).success).toBe(false);
  });

  it("rejects non-boolean italic", () => {
    expect(HeadingStyleSchema.safeParse({ italic: "yes" }).success).toBe(false);
  });
});

describe("BodyStyleSchema", () => {
  it("parses weight and italic", () => {
    expect(BodyStyleSchema.safeParse({ weight: "300", italic: true }).success).toBe(true);
  });
});

describe("BrandingDraftSchema", () => {
  it("parses a draft with styled heading and body JSON", () => {
    const parsed = BrandingDraftSchema.safeParse({
      main_heading: { typeface: "Lobster", weight: "800", italic: true },
      sub_heading: { weight: "600" },
      body: { typeface: "Inter", weight: "300", italic: false },
    });
    expect(parsed.success).toBe(true);
  });

  it("parses a draft saved before weight/italic existed", () => {
    const parsed = BrandingDraftSchema.safeParse({
      primary_color: "#FE1B54",
      main_heading: { color: "#222222", typeface: "Lobster" },
      body: { color: "#333333" },
    });
    expect(parsed.success).toBe(true);
  });
});
