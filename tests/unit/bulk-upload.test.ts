import { describe, it, expect } from "vitest";
import {
  validateRows,
  buildSampleCsv,
  parseSpreadsheet,
  BULK_COLUMNS,
  MAX_ROWS,
  type RawRow,
} from "@/lib/menu/bulk-upload";

function row(overrides: Partial<RawRow> = {}): RawRow {
  return {
    name: "Burger",
    description: "Beef burger",
    price: "75.00",
    category: "Mains",
    allergens: "",
    labels: "",
    image_url: "",
    ...overrides,
  };
}

describe("validateRows", () => {
  it("accepts a valid row and converts price to cents", () => {
    const { valid, errors } = validateRows([row()]);
    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(1);
    expect(valid[0]).toMatchObject({
      name: "Burger",
      description: "Beef burger",
      price_cents: 7500,
      category: "Mains",
    });
  });

  it("rounds fractional cents like upsertItem does", () => {
    const { valid } = validateRows([row({ price: "55.555" })]);
    expect(valid[0].price_cents).toBe(5556);
  });

  it("splits semicolon-separated allergens and labels, trimming empties", () => {
    const { valid } = validateRows([
      row({ allergens: "gluten; dairy ;", labels: "vegan;spicy" }),
    ]);
    expect(valid[0].allergens).toEqual(["gluten", "dairy"]);
    expect(valid[0].labels).toEqual(["vegan", "spicy"]);
  });

  it("treats a blank description and image_url as null", () => {
    const { valid } = validateRows([row({ description: "  ", image_url: "" })]);
    expect(valid[0].description).toBeNull();
    expect(valid[0].image_url).toBeNull();
  });

  it("reports missing name with 1-based file row including header", () => {
    const { valid, errors } = validateRows([row({ name: "  " })]);
    expect(valid).toHaveLength(0);
    expect(errors).toContainEqual(
      expect.objectContaining({ row: 2, field: "name" })
    );
  });

  it("rejects non-numeric and negative prices", () => {
    const { errors } = validateRows([
      row({ name: "A", price: "abc" }),
      row({ name: "B", price: "-5" }),
    ]);
    const priceErrors = errors.filter((e) => e.field === "price");
    expect(priceErrors).toHaveLength(2);
    // second data row is file row 3
    expect(priceErrors.map((e) => e.row).sort()).toEqual([2, 3]);
  });

  it("rejects a malformed image URL but accepts a valid one", () => {
    const bad = validateRows([row({ image_url: "not-a-url" })]);
    expect(bad.errors).toContainEqual(
      expect.objectContaining({ field: "image_url" })
    );

    const good = validateRows([row({ image_url: "https://cdn.test/x.png" })]);
    expect(good.errors).toHaveLength(0);
    expect(good.valid[0].image_url).toBe("https://cdn.test/x.png");
  });

  it("requires a category", () => {
    const { errors } = validateRows([row({ category: "" })]);
    expect(errors).toContainEqual(
      expect.objectContaining({ field: "category" })
    );
  });

  it("returns nothing for an empty list", () => {
    expect(validateRows([])).toEqual({ valid: [], errors: [] });
  });
});

describe("buildSampleCsv", () => {
  it("includes every column in the header", () => {
    const csv = buildSampleCsv();
    const header = csv.split(/\r?\n/)[0];
    expect(header).toBe(BULK_COLUMNS.join(","));
  });

  it("produces sample rows that pass validation", async () => {
    const csv = buildSampleCsv();
    const file = new File([csv], "sample.csv", { type: "text/csv" });
    const { rows } = await parseSpreadsheet(file);
    const { valid, errors } = validateRows(rows);
    expect(errors).toHaveLength(0);
    expect(valid.length).toBeGreaterThan(0);
  });
});

describe("parseSpreadsheet", () => {
  it("parses CSV with case-insensitive headers", async () => {
    const csv = "Name,Price,Category\nPizza,89,Mains\n";
    const file = new File([csv], "menu.csv", { type: "text/csv" });
    const { rows } = await parseSpreadsheet(file);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Pizza");
    expect(rows[0].price).toBe("89");
    expect(rows[0].category).toBe("Mains");
  });

  it("throws for an unsupported file type", async () => {
    const file = new File(["x"], "menu.txt", { type: "text/plain" });
    await expect(parseSpreadsheet(file)).rejects.toThrow(/Unsupported/);
  });

  it("throws for a file with no data rows", async () => {
    const file = new File(["name,price,category\n"], "empty.csv", {
      type: "text/csv",
    });
    await expect(parseSpreadsheet(file)).rejects.toThrow(/no data/i);
  });

  it("throws when exceeding the row cap", async () => {
    const lines = ["name,price,category"];
    for (let i = 0; i < MAX_ROWS + 1; i++) lines.push(`Item ${i},10,Mains`);
    const file = new File([lines.join("\n")], "big.csv", { type: "text/csv" });
    await expect(parseSpreadsheet(file)).rejects.toThrow(/Too many rows/);
  });
});
