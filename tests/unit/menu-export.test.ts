import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted above module init, so the shared mock fns must
// be created via vi.hoisted to exist when the factories run.
const { requireRestaurantAccess, loadMenuById } = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  loadMenuById: vi.fn(),
}));

vi.mock("@/lib/auth/role", () => ({ requireRestaurantAccess }));
vi.mock("@/lib/data/menus", () => ({ loadMenuById }));

import { exportMenuCsv } from "@/lib/data/menu-export-actions";
import { ForbiddenError } from "@/lib/errors";
import { validateRows, parseSpreadsheet, EXPORT_COLUMNS } from "@/lib/menu/bulk-upload";

const MENU_ID = "33333333-3333-4333-8333-333333333333";
const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";
const PIZZA_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TIRAMISU_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_MENU_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const MENU = {
  id: MENU_ID,
  restaurant_id: RESTAURANT_ID,
  name: "Dinner",
  slug: "dinner",
};

const CATEGORIES = [
  { id: "cat-mains", name: "Mains" },
  { id: "cat-desserts", name: "Desserts" },
];

const ITEMS = [
  {
    id: PIZZA_ID,
    name: "Margherita Pizza",
    description: 'Tomato, "fresh" mozzarella,\nbasil',
    price_cents: 8900,
    category_id: "cat-mains",
    image_url: "https://cdn.test/pizza.png",
    allergens: ["gluten", "dairy"],
    labels: ["vegetarian"],
    preparations: [{ name: "Deep dish", price_cents: 1000 }],
    variations: [],
    sides: [],
    sauces: [{ name: "House sauce: spicy" }],
    pairing_ids: [TIRAMISU_ID, OTHER_MENU_ID],
  },
  {
    id: TIRAMISU_ID,
    name: "Tiramisu",
    description: null,
    price_cents: 5550,
    category_id: "cat-desserts",
    image_url: null,
    allergens: [],
    labels: [],
    preparations: [],
    variations: [],
    sides: [],
    sauces: [],
    pairing_ids: [],
  },
];

/** Chainable stub resolving canned rows per table (one builder per query). */
function makeSupabase() {
  return {
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data: table === "categories" ? CATEGORIES : ITEMS,
            error: null,
          }),
      };
      return builder;
    },
  };
}

describe("exportMenuCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadMenuById.mockResolvedValue(MENU);
    requireRestaurantAccess.mockResolvedValue({ supabase: makeSupabase() });
  });

  it("requires manager access to the menu's restaurant", async () => {
    requireRestaurantAccess.mockRejectedValue(new ForbiddenError());

    const result = await exportMenuCsv(MENU_ID);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("forbidden");
    expect(requireRestaurantAccess).toHaveBeenCalledWith(RESTAURANT_ID, "manager");
  });

  it("returns the menu slug and a CSV with the export header", async () => {
    const result = await exportMenuCsv(MENU_ID);

    expect(result.ok).toBe(true);
    expect(result.data?.slug).toBe("dinner");
    expect(result.data?.csv.split(/\r?\n/)[0]).toBe(EXPORT_COLUMNS.join(","));
  });

  it("serializes rows that re-validate in the importer, with prices in rands", async () => {
    const result = await exportMenuCsv(MENU_ID);
    expect(result.ok).toBe(true);

    const file = new File([result.data!.csv], "dinner.csv", { type: "text/csv" });
    const { rows } = await parseSpreadsheet(file);
    const { valid, errors } = validateRows(rows);

    expect(errors).toHaveLength(0);
    expect(valid).toHaveLength(2);
    const pizza = valid.find((r) => r.id === PIZZA_ID)!;
    expect(pizza).toMatchObject({
      name: "Margherita Pizza",
      price_cents: 8900,
      category: "Mains",
      description: 'Tomato, "fresh" mozzarella,\nbasil',
      image_url: "https://cdn.test/pizza.png",
      allergens: ["gluten", "dairy"],
      labels: ["vegetarian"],
      preparations: [{ name: "Deep dish", price_cents: 1000 }],
      // Colon-named sauce gets an explicit :0.00 suffix (0-vs-absent semantic).
      sauces: [{ name: "House sauce: spicy", price_cents: 0 }],
    });
  });

  it("serializes pairings as names, dropping ids from other menus", async () => {
    const result = await exportMenuCsv(MENU_ID);
    expect(result.ok).toBe(true);

    const file = new File([result.data!.csv], "dinner.csv", { type: "text/csv" });
    const { rows } = await parseSpreadsheet(file);
    const { valid } = validateRows(rows);

    const pizza = valid.find((r) => r.id === PIZZA_ID)!;
    expect(pizza.pairings).toEqual(["Tiramisu"]);
    expect(result.data?.csv).not.toContain(OTHER_MENU_ID);
  });
});
