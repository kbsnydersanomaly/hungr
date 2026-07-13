import { describe, it, expect } from "vitest";
import {
  validateRows,
  buildSampleCsv,
  parseSpreadsheet,
  parseOptionList,
  serializeOptionList,
  resolvePairings,
  buildMenuCsv,
  BULK_COLUMNS,
  EXPORT_COLUMNS,
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

  it("parses option columns and defaults them to empty arrays", () => {
    const blank = validateRows([row()]);
    expect(blank.valid[0].preparations).toEqual([]);
    expect(blank.valid[0].variations).toEqual([]);
    expect(blank.valid[0].sides).toEqual([]);
    expect(blank.valid[0].sauces).toEqual([]);

    const { valid, errors } = validateRows([
      row({
        preparations: "Grilled:0;Fried:15.50",
        variations: "Medium;Large:25",
        sides: "Chips:15.00",
        sauces: "Peri-peri",
      }),
    ]);
    expect(errors).toHaveLength(0);
    expect(valid[0].preparations).toEqual([
      { name: "Grilled", price_cents: 0 },
      { name: "Fried", price_cents: 1550 },
    ]);
    expect(valid[0].variations).toEqual([
      { name: "Medium" },
      { name: "Large", price_cents: 2500 },
    ]);
    expect(valid[0].sides).toEqual([{ name: "Chips", price_cents: 1500 }]);
    expect(valid[0].sauces).toEqual([{ name: "Peri-peri" }]);
  });

  it("rejects rows with an invalid option price, scoped to row and column", () => {
    const { valid, errors } = validateRows([
      row({ preparations: "Grilled:abc" }),
      row({ name: "Other", sauces: "Peri-peri:-5" }),
    ]);
    expect(valid).toHaveLength(0);
    expect(errors).toContainEqual(
      expect.objectContaining({ row: 2, field: "preparations" })
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ row: 3, field: "sauces" })
    );
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

describe("parseOptionList", () => {
  it("parses entries with and without prices (happy path)", () => {
    const { options, errors } = parseOptionList(
      "Grilled:0;Fried:15.50;Extra cheese",
      "preparations",
      2
    );
    expect(errors).toHaveLength(0);
    expect(options).toEqual([
      { name: "Grilled", price_cents: 0 },
      { name: "Fried", price_cents: 1550 },
      { name: "Extra cheese" },
    ]);
  });

  it("splits on the last colon so prices stick to the suffix", () => {
    const { options, errors } = parseOptionList("House sauce: spicy:12", "sauces", 2);
    expect(errors).toHaveLength(0);
    expect(options).toEqual([{ name: "House sauce: spicy", price_cents: 1200 }]);
  });

  it("returns empty options for a blank cell", () => {
    expect(parseOptionList("", "sides", 2)).toEqual({ options: [], errors: [] });
    expect(parseOptionList("   ", "sides", 2)).toEqual({ options: [], errors: [] });
  });

  it("ignores empty entries and trailing semicolons", () => {
    const { options, errors } = parseOptionList("Chips:15;;Salad;", "sides", 4);
    expect(errors).toHaveLength(0);
    expect(options).toEqual([
      { name: "Chips", price_cents: 1500 },
      { name: "Salad" },
    ]);
  });

  it("reports bad prices with a row-scoped error", () => {
    const { options, errors } = parseOptionList(
      "Fried:abc;Baked:-1;Grilled",
      "preparations",
      7
    );
    expect(options).toEqual([{ name: "Grilled" }]);
    expect(errors).toHaveLength(2);
    for (const error of errors) {
      expect(error.row).toBe(7);
      expect(error.field).toBe("preparations");
      expect(error.reason).toMatch(/invalid price/i);
    }
  });

  it("reports a missing name before the colon", () => {
    const { options, errors } = parseOptionList(":10", "variations", 3);
    expect(options).toEqual([]);
    expect(errors).toContainEqual(
      expect.objectContaining({ row: 3, field: "variations" })
    );
  });
});

describe("serializeOptionList", () => {
  it("serializes options with and without prices (inverse of parseOptionList)", () => {
    expect(
      serializeOptionList([
        { name: "Grilled", price_cents: 0 },
        { name: "Fried", price_cents: 1550 },
        { name: "Extra cheese" },
      ])
    ).toBe("Grilled:0.00;Fried:15.50;Extra cheese");
  });

  it("emits an explicit price suffix when the name contains a colon", () => {
    // The importer splits on the LAST ":" and requires a valid price after it,
    // so a bare "House sauce: spicy" would fail to re-import. With no stored
    // price, ":0.00" is emitted (accepting the 0-vs-absent semantic).
    expect(serializeOptionList([{ name: "House sauce: spicy" }])).toBe(
      "House sauce: spicy:0.00"
    );
    expect(
      serializeOptionList([{ name: "House sauce: spicy", price_cents: 1200 }])
    ).toBe("House sauce: spicy:12.00");
  });

  it("round-trips colon-named options through the parser", () => {
    const serialized = serializeOptionList([{ name: "House sauce: spicy" }]);
    const { options, errors } = parseOptionList(serialized, "sauces", 2);
    expect(errors).toHaveLength(0);
    expect(options).toEqual([{ name: "House sauce: spicy", price_cents: 0 }]);
  });

  it("returns an empty string for no options", () => {
    expect(serializeOptionList([])).toBe("");
  });
});

describe("buildMenuCsv", () => {
  const ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const PAIRED_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("uses the export header (id plus the importer's columns)", () => {
    const csv = buildMenuCsv([]);
    expect(csv.split(/\r?\n/)[0]).toBe(EXPORT_COLUMNS.join(","));
  });

  it("round-trips a description containing a comma, a quote, and a newline", async () => {
    const description = 'Slow-cooked, "fall-off-the-bone" ribs.\nServed hot.';
    const csv = buildMenuCsv([
      {
        id: ITEM_ID,
        name: "BBQ Ribs",
        description,
        price_cents: 12950,
        category: "Mains",
        allergens: [],
        labels: [],
        image_url: null,
        preparations: [],
        variations: [],
        sides: [],
        sauces: [],
        pairings: [],
      },
    ]);

    const file = new File([csv], "menu.csv", { type: "text/csv" });
    const { rows } = await parseSpreadsheet(file);
    const { valid, errors } = validateRows(rows);
    expect(errors).toHaveLength(0);
    expect(valid[0].id).toBe(ITEM_ID);
    expect(valid[0].description).toBe(description);
    expect(valid[0].price_cents).toBe(12950);
  });

  it("serializes prices as rands, options and pairings in the importer's encoding", async () => {
    const csv = buildMenuCsv([
      {
        id: ITEM_ID,
        name: "Margherita Pizza",
        description: null,
        price_cents: 8900,
        category: "Mains",
        allergens: ["gluten", "dairy"],
        labels: ["vegetarian"],
        image_url: "https://cdn.test/pizza.png",
        preparations: [{ name: "Deep dish", price_cents: 1000 }],
        variations: [{ name: "Medium" }],
        sides: [],
        sauces: [{ name: "House sauce: spicy" }],
        pairings: ["Tiramisu"],
      },
    ]);

    const file = new File([csv], "menu.csv", { type: "text/csv" });
    const { rows } = await parseSpreadsheet(file);
    const { valid, errors } = validateRows(rows);
    expect(errors).toHaveLength(0);
    expect(valid[0]).toMatchObject({
      id: ITEM_ID,
      price_cents: 8900,
      description: null,
      image_url: "https://cdn.test/pizza.png",
      allergens: ["gluten", "dairy"],
      labels: ["vegetarian"],
      preparations: [{ name: "Deep dish", price_cents: 1000 }],
      variations: [{ name: "Medium" }],
      sauces: [{ name: "House sauce: spicy", price_cents: 0 }],
      pairings: ["Tiramisu"],
    });
    // Paired item id never leaks into the file — pairings are names.
    expect(csv).not.toContain(PAIRED_ID);
  });
});

describe("id column", () => {
  const VALID_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("accepts a valid UUID and defaults a blank id to null", () => {
    const { valid, errors } = validateRows([row({ id: VALID_ID }), row()]);
    expect(errors).toHaveLength(0);
    expect(valid[0].id).toBe(VALID_ID);
    expect(valid[1].id).toBeNull();
  });

  it("rejects a malformed id, scoped to row and column", () => {
    const { valid, errors } = validateRows([row({ id: "not-a-uuid" })]);
    expect(valid).toHaveLength(0);
    expect(errors).toContainEqual(
      expect.objectContaining({ row: 2, field: "id" })
    );
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

describe("pairings column", () => {
  it("splits the pairings cell like allergens/labels and stamps the file row", () => {
    const { valid, errors } = validateRows([
      row({ pairings: "Chocolate Brownie; House Merlot ;" }),
    ]);
    expect(errors).toHaveLength(0);
    expect(valid[0].pairings).toEqual(["Chocolate Brownie", "House Merlot"]);
    expect(valid[0].fileRow).toBe(2);
  });

  it("defaults pairings to an empty array when the column is blank", () => {
    const { valid } = validateRows([row()]);
    expect(valid[0].pairings).toEqual([]);
  });
});

describe("resolvePairings", () => {
  const ID = {
    brownie: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    merlot: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    tiramisu: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  };

  /** name (lowercased, trimmed) -> id, as built from the menu's items. */
  const nameToId = new Map([
    ["chocolate brownie", ID.brownie],
    ["house merlot", ID.merlot],
    ["tiramisu", ID.tiramisu],
  ]);

  it("resolves pairing names to item ids", () => {
    const { updates, warnings } = resolvePairings(
      [
        {
          fileRow: 2,
          name: "Chocolate Brownie",
          pairings: ["House Merlot", "Tiramisu"],
        },
      ],
      nameToId
    );
    expect(warnings).toHaveLength(0);
    expect(updates).toEqual([
      { id: ID.brownie, pairing_ids: [ID.merlot, ID.tiramisu], fileRow: 2 },
    ]);
  });

  it("matches names case- and whitespace-insensitively", () => {
    const { updates, warnings } = resolvePairings(
      [
        {
          fileRow: 2,
          name: "  chocolate BROWNIE ",
          pairings: [" house merlot", "TIRAMISU "],
        },
      ],
      nameToId
    );
    expect(warnings).toHaveLength(0);
    expect(updates).toEqual([
      { id: ID.brownie, pairing_ids: [ID.merlot, ID.tiramisu], fileRow: 2 },
    ]);
  });

  it("warns (not errors) on unresolvable names, keeping the resolvable ones", () => {
    const { updates, warnings } = resolvePairings(
      [
        {
          fileRow: 5,
          name: "Chocolate Brownie",
          pairings: ["House Merlot", "Ghost Item"],
        },
      ],
      nameToId
    );
    expect(updates).toEqual([{ id: ID.brownie, pairing_ids: [ID.merlot], fileRow: 5 }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ row: 5, field: "pairings" });
    expect(warnings[0].reason).toContain("Ghost Item");
  });

  it("excludes self-pairing", () => {
    const { updates, warnings } = resolvePairings(
      [
        {
          fileRow: 2,
          name: "Chocolate Brownie",
          pairings: ["Chocolate Brownie", "House Merlot"],
        },
      ],
      nameToId
    );
    expect(warnings).toHaveLength(0);
    expect(updates).toEqual([{ id: ID.brownie, pairing_ids: [ID.merlot], fileRow: 2 }]);
  });

  it("dedupes repeated pairing names", () => {
    const { updates } = resolvePairings(
      [
        {
          fileRow: 2,
          name: "Chocolate Brownie",
          pairings: ["House Merlot", "house merlot", " House Merlot "],
        },
      ],
      nameToId
    );
    expect(updates).toEqual([{ id: ID.brownie, pairing_ids: [ID.merlot], fileRow: 2 }]);
  });

  it("emits no update when every pairing name fails to resolve (keeps existing pairings)", () => {
    const { updates, warnings } = resolvePairings(
      [
        {
          fileRow: 4,
          name: "Chocolate Brownie",
          pairings: ["Ghost Item", "Another Ghost"],
        },
      ],
      nameToId
    );
    expect(updates).toHaveLength(0);
    expect(warnings).toHaveLength(2);
    for (const warning of warnings) {
      expect(warning).toMatchObject({ row: 4, field: "pairings" });
    }
  });

  it("emits no update when the only pairing is the item itself", () => {
    const { updates, warnings } = resolvePairings(
      [
        {
          fileRow: 2,
          name: "Chocolate Brownie",
          pairings: ["Chocolate Brownie"],
        },
      ],
      nameToId
    );
    expect(updates).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("skips rows without pairings and rows whose own item is not on the menu", () => {
    const { updates, warnings } = resolvePairings(
      [
        { fileRow: 2, name: "Chocolate Brownie", pairings: [] },
        { fileRow: 3, name: "Not On Menu", pairings: ["House Merlot"] },
      ],
      nameToId
    );
    expect(updates).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it("prefers an explicit ownId over the name lookup (rename collision)", () => {
    // The row was renamed to a name that belongs to another item in the map;
    // without ownId the update would misroute to that item.
    const { updates, warnings } = resolvePairings(
      [
        {
          fileRow: 2,
          name: "House Merlot",
          ownId: ID.brownie,
          pairings: ["Tiramisu"],
        },
      ],
      nameToId
    );
    expect(warnings).toHaveLength(0);
    expect(updates).toEqual([{ id: ID.brownie, pairing_ids: [ID.tiramisu], fileRow: 2 }]);
  });

  it("excludes self-pairing when ownId is given explicitly", () => {
    const { updates, warnings } = resolvePairings(
      [
        {
          fileRow: 2,
          name: "Renamed Brownie",
          ownId: ID.brownie,
          pairings: ["Chocolate Brownie", "Tiramisu"],
        },
      ],
      nameToId
    );
    expect(warnings).toHaveLength(0);
    expect(updates).toEqual([{ id: ID.brownie, pairing_ids: [ID.tiramisu], fileRow: 2 }]);
  });
});
