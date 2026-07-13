import { describe, it, expect } from "vitest";
import {
  COMMON_ALLERGENS,
  addCustomAllergen,
  customAllergens,
  normalizeAllergen,
} from "@/lib/menu/allergens";

describe("normalizeAllergen", () => {
  it("trims and lowercases", () => {
    expect(normalizeAllergen("  PineApple  ")).toBe("pineapple");
  });
});

describe("addCustomAllergen", () => {
  it("appends a new allergen, normalized", () => {
    expect(addCustomAllergen([], " Pineapple ")).toEqual(["pineapple"]);
  });

  it("returns the same array for empty or whitespace-only input", () => {
    const allergens = ["gluten"];
    expect(addCustomAllergen(allergens, "")).toBe(allergens);
    expect(addCustomAllergen(allergens, "   ")).toBe(allergens);
  });

  it("does not duplicate a common allergen, case-insensitively", () => {
    const allergens = ["gluten"];
    expect(addCustomAllergen(allergens, "Peanuts")).toBe(allergens);
    expect(addCustomAllergen(allergens, " GLUTEN ")).toBe(allergens);
  });

  it("does not duplicate an existing custom allergen, case-insensitively", () => {
    const allergens = ["pineapple"];
    expect(addCustomAllergen(allergens, "PINEAPPLE")).toBe(allergens);
  });

  it("appends alongside existing common and custom allergens", () => {
    expect(addCustomAllergen(["gluten", "pineapple"], "kiwi")).toEqual([
      "gluten",
      "pineapple",
      "kiwi",
    ]);
  });
});

describe("customAllergens", () => {
  it("returns only entries not in the common list", () => {
    expect(customAllergens(["gluten", "pineapple", "sesame", "kiwi"])).toEqual([
      "pineapple",
      "kiwi",
    ]);
  });

  it("treats common allergens case-insensitively", () => {
    expect(customAllergens(["Peanuts"])).toEqual([]);
  });

  it("returns an empty list when everything is common", () => {
    expect(customAllergens([...COMMON_ALLERGENS])).toEqual([]);
  });
});
