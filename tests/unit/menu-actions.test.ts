import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks for server-only dependencies -------------------------------------
// vi.mock factories are hoisted above module init, so the shared mock fns must
// be created via vi.hoisted to exist when the factories run.
const { requireRestaurantAccess, writeAudit, loadMenuById, revalidatePath } = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  writeAudit: vi.fn(),
  loadMenuById: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/utils/audit", () => ({ writeAudit }));
vi.mock("@/lib/auth/role", () => ({
  requireRestaurantAccess,
  requireCategoryAccess: vi.fn(),
  requireItemAccess: vi.fn(),
}));
vi.mock("@/lib/data/menus", () => ({ loadMenuById }));
vi.mock("@/lib/qr/generate", () => ({ generateAndStoreMenuQr: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { renameMenu, createMenu, bulkUpsertItems } from "@/lib/data/menu-actions";
import { ForbiddenError } from "@/lib/errors";

const MENU_ID = "33333333-3333-4333-8333-333333333333";
const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

const MENU = {
  id: MENU_ID,
  restaurant_id: RESTAURANT_ID,
  name: "Old Name",
  slug: "old-name",
};

/**
 * Minimal chainable Supabase stub: `update` records its payload, `maybeSingle`
 * returns the restaurant slug row, and the builder is awaitable so the
 * `.update().eq()` chain resolves to `{ error }`.
 */
function makeSupabase(updateError: unknown = null) {
  const captured: { update?: Record<string, unknown> } = {};
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    update: (payload: Record<string, unknown>) => {
      captured.update = payload;
      return builder;
    },
    maybeSingle: () => Promise.resolve({ data: { slug: "testaurant" } }),
    then: (resolve: (v: unknown) => void) => resolve({ error: updateError }),
  };
  return { builder, captured };
}

describe("renameMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadMenuById.mockResolvedValue(MENU);
    writeAudit.mockResolvedValue(undefined);
  });

  it("rejects an empty name without touching the database", async () => {
    const { builder } = makeSupabase();
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMenu(MENU_ID, "   ");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Menu name is required");
  });

  it("rejects names longer than 80 characters", async () => {
    const { builder } = makeSupabase();
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMenu(MENU_ID, "x".repeat(81));

    expect(result.ok).toBe(false);
    expect(result.message).toContain("80");
  });

  it("requires manager access to the menu's restaurant", async () => {
    requireRestaurantAccess.mockRejectedValue(new ForbiddenError());

    const result = await renameMenu(MENU_ID, "New Name");

    expect(result.ok).toBe(false);
    expect(result.code).toBe("forbidden");
    expect(requireRestaurantAccess).toHaveBeenCalledWith(RESTAURANT_ID, "manager");
  });

  it("updates only the name (never the slug) and trims whitespace", async () => {
    const { builder, captured } = makeSupabase();
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMenu(MENU_ID, "  New Name  ");

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ name: "New Name" });
    expect(captured.update).toMatchObject({ name: "New Name" });
    expect(captured.update).not.toHaveProperty("slug");
    expect(Object.keys(captured.update ?? {}).sort()).toEqual(["name", "updated_at"]);
  });

  it("revalidates the menus list, workspace and public menu paths", async () => {
    const { builder } = makeSupabase();
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    await renameMenu(MENU_ID, "New Name");

    expect(revalidatePath).toHaveBeenCalledWith(`/restaurants/${RESTAURANT_ID}/menus`);
    expect(revalidatePath).toHaveBeenCalledWith(`/restaurants/${RESTAURANT_ID}/menus/${MENU_ID}`);
    expect(revalidatePath).toHaveBeenCalledWith("/m/testaurant");
    expect(revalidatePath).toHaveBeenCalledWith("/m/testaurant/old-name");
  });

  it("wraps database failures with the underlying reason", async () => {
    const { builder } = makeSupabase({ message: "boom", code: "42P01" });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMenu(MENU_ID, "New Name");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Failed to rename menu");
    expect(result.message).toContain("boom");
  });
});

describe("createMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects names longer than 80 characters (parity with rename)", async () => {
    const { builder } = makeSupabase();
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const formData = new FormData();
    formData.append("name", "x".repeat(81));

    const result = await createMenu(RESTAURANT_ID, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("80");
  });
});

/**
 * Stateful Supabase stub for `bulkUpsertItems`: `from()` selects the canned
 * table, selects resolve to the canned rows, mutations resolve with no error,
 * and `update(...).eq("id", ...)` calls on `menu_items` are recorded. Pass
 * `pairingUpdateError` to make recorded pairing updates fail at await time.
 */
function makeBulkSupabase(
  tables: {
    categories?: { id: string; name: string }[];
    menu_items?: { id: string; name: string; category_id?: string }[];
  },
  opts: { pairingUpdateError?: { message: string } } = {}
) {
  const pairingUpdates: { id: string; pairing_ids: string[] }[] = [];
  let table = "";
  let pendingUpdate: Record<string, unknown> | null = null;
  let pendingError: { message: string } | null = null;
  const builder: Record<string, unknown> = {
    from: (t: string) => {
      table = t;
      return builder;
    },
    select: () => builder,
    insert: () => builder,
    delete: () => builder,
    update: (payload: Record<string, unknown>) => {
      pendingUpdate = payload;
      return builder;
    },
    eq: (col: string, value: unknown) => {
      if (pendingUpdate && table === "menu_items" && col === "id") {
        pairingUpdates.push({
          id: String(value),
          ...(pendingUpdate as { pairing_ids: string[] }),
        });
        pendingUpdate = null;
        if (opts.pairingUpdateError) pendingError = opts.pairingUpdateError;
      }
      return builder;
    },
    then: (resolve: (v: unknown) => void) => {
      if (pendingError) {
        const error = pendingError;
        pendingError = null;
        resolve({ data: null, error });
        return;
      }
      resolve({ data: tables[table as keyof typeof tables] ?? null, error: null });
    },
  };
  return { builder, pairingUpdates };
}

describe("bulkUpsertItems pairing pass", () => {
  const BROWNIE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const MERLOT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  beforeEach(() => {
    vi.clearAllMocks();
    loadMenuById.mockResolvedValue(MENU);
    writeAudit.mockResolvedValue(undefined);
  });

  it("resolves pairing names to ids after insert and warns on unknown names", async () => {
    const { builder, pairingUpdates } = makeBulkSupabase({
      categories: [{ id: "cat-1", name: "Desserts" }],
      menu_items: [
        { id: BROWNIE_ID, name: "Chocolate Brownie" },
        { id: MERLOT_ID, name: "House Merlot" },
      ],
    });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "replace",
      rows: [
        {
          name: "Chocolate Brownie",
          price: "55.00",
          category: "Desserts",
          pairings: "House Merlot;Ghost Item",
        },
        { name: "House Merlot", price: "80.00", category: "Desserts", pairings: "" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.data?.added).toBe(2);
    expect(pairingUpdates).toEqual([{ id: BROWNIE_ID, pairing_ids: [MERLOT_ID] }]);
    expect(result.data?.warnings).toHaveLength(1);
    expect(result.data?.warnings[0]).toMatchObject({ row: 2, field: "pairings" });
    expect(result.data?.warnings[0].reason).toContain("Ghost Item");
  });

  it("runs no pairing queries when no row declares pairings", async () => {
    const { builder, pairingUpdates } = makeBulkSupabase({
      categories: [{ id: "cat-1", name: "Desserts" }],
    });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "replace",
      rows: [{ name: "Tiramisu", price: "55.00", category: "Desserts" }],
    });

    expect(result.ok).toBe(true);
    expect(result.data?.warnings).toEqual([]);
    expect(pairingUpdates).toHaveLength(0);
  });

  it("still applies pairings for items skipped in add mode because they exist", async () => {
    const { builder, pairingUpdates } = makeBulkSupabase({
      categories: [{ id: "cat-1", name: "Desserts" }],
      menu_items: [
        { id: BROWNIE_ID, name: "Chocolate Brownie", category_id: "cat-1" },
        { id: MERLOT_ID, name: "House Merlot", category_id: "cat-1" },
      ],
    });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "add",
      rows: [
        {
          name: "Chocolate Brownie",
          price: "55.00",
          category: "Desserts",
          pairings: "House Merlot",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.data?.skipped).toBe(1);
    expect(result.data?.added).toBe(0);
    expect(pairingUpdates).toEqual([{ id: BROWNIE_ID, pairing_ids: [MERLOT_ID] }]);
    expect(result.data?.warnings).toEqual([]);
  });

  it("degrades pairing-write failures to warnings without failing the upload", async () => {
    const { builder } = makeBulkSupabase(
      {
        categories: [{ id: "cat-1", name: "Desserts" }],
        menu_items: [
          { id: BROWNIE_ID, name: "Chocolate Brownie" },
          { id: MERLOT_ID, name: "House Merlot" },
        ],
      },
      { pairingUpdateError: { message: "boom" } }
    );
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "replace",
      rows: [
        {
          name: "Chocolate Brownie",
          price: "55.00",
          category: "Desserts",
          pairings: "House Merlot",
        },
        { name: "House Merlot", price: "80.00", category: "Desserts", pairings: "" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.data?.added).toBe(2);
    expect(result.data?.warnings).toHaveLength(1);
    expect(result.data?.warnings[0]).toMatchObject({ row: 2, field: "pairings" });
    expect(result.data?.warnings[0].reason).toMatch(/Failed to save pairings/);
  });
});

describe("bulkUpsertItems id column", () => {
  const BROWNIE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const MERLOT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const GHOST_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  beforeEach(() => {
    vi.clearAllMocks();
    loadMenuById.mockResolvedValue(MENU);
    writeAudit.mockResolvedValue(undefined);
  });

  it("updates the item targeted by id even when the name changed (modify mode)", async () => {
    const { builder, pairingUpdates } = makeBulkSupabase({
      categories: [{ id: "cat-1", name: "Desserts" }],
      menu_items: [{ id: BROWNIE_ID, name: "Old Brownie Name", category_id: "cat-1" }],
    });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "modify",
      rows: [
        {
          id: BROWNIE_ID,
          name: "Chocolate Brownie",
          price: "60.00",
          category: "Desserts",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.data?.updated).toBe(1);
    expect(result.data?.skipped).toBe(0);
    expect(result.data?.added).toBe(0);
    expect(pairingUpdates).toHaveLength(1);
    expect(pairingUpdates[0].id).toBe(BROWNIE_ID);
    expect(pairingUpdates[0].pairing_ids).toBeUndefined();
    expect(pairingUpdates[0]).toMatchObject({ name: "Chocolate Brownie", price_cents: 6000 });
  });

  it("takes precedence over add-mode skipping when the id exists", async () => {
    const { builder, pairingUpdates } = makeBulkSupabase({
      categories: [{ id: "cat-1", name: "Desserts" }],
      menu_items: [{ id: BROWNIE_ID, name: "Chocolate Brownie", category_id: "cat-1" }],
    });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "add",
      rows: [
        {
          id: BROWNIE_ID,
          name: "Chocolate Brownie",
          price: "60.00",
          category: "Desserts",
        },
      ],
    });

    expect(result.ok).toBe(true);
    // Add mode would normally skip an existing name; the explicit id wins.
    expect(result.data?.updated).toBe(1);
    expect(result.data?.skipped).toBe(0);
    expect(pairingUpdates.map((u) => u.id)).toEqual([BROWNIE_ID]);
  });

  it("errors the row when the id does not belong to this menu", async () => {
    const { builder, pairingUpdates } = makeBulkSupabase({
      categories: [{ id: "cat-1", name: "Desserts" }],
      menu_items: [{ id: BROWNIE_ID, name: "Chocolate Brownie", category_id: "cat-1" }],
    });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "modify",
      rows: [
        { id: GHOST_ID, name: "Ghost", price: "10.00", category: "Desserts" },
        { name: "Chocolate Brownie", price: "55.00", category: "Desserts" },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.data?.failed).toBe(1);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0]).toMatchObject({ row: 2, field: "id" });
    // The name-matched row still updates normally.
    expect(result.data?.updated).toBe(1);
    expect(pairingUpdates).toHaveLength(1);
  });

  it("errors the second row when the same id appears twice", async () => {
    const { builder, pairingUpdates } = makeBulkSupabase({
      categories: [{ id: "cat-1", name: "Desserts" }],
      menu_items: [{ id: BROWNIE_ID, name: "Chocolate Brownie", category_id: "cat-1" }],
    });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "modify",
      rows: [
        { id: BROWNIE_ID, name: "Brownie A", price: "55.00", category: "Desserts" },
        { id: BROWNIE_ID, name: "Brownie B", price: "60.00", category: "Desserts" },
      ],
    });

    expect(result.ok).toBe(true);
    // The first row proceeds; the duplicate is rejected, not double-written.
    expect(result.data?.updated).toBe(1);
    expect(result.data?.failed).toBe(1);
    expect(result.data?.errors).toHaveLength(1);
    expect(result.data?.errors[0]).toMatchObject({ row: 3, field: "id" });
    expect(result.data?.errors[0].reason).toContain("row 2");
    expect(pairingUpdates).toHaveLength(1);
    expect(pairingUpdates[0]).toMatchObject({ id: BROWNIE_ID, name: "Brownie A" });
  });

  it("routes pairings by the row's id even when its new name collides with another item", async () => {
    const TIRAMISU_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const { builder, pairingUpdates } = makeBulkSupabase({
      categories: [{ id: "cat-1", name: "Desserts" }],
      menu_items: [
        { id: BROWNIE_ID, name: "Chocolate Brownie", category_id: "cat-1" },
        { id: MERLOT_ID, name: "House Merlot", category_id: "cat-1" },
        { id: TIRAMISU_ID, name: "Tiramisu", category_id: "cat-1" },
      ],
    });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await bulkUpsertItems(MENU_ID, {
      mode: "modify",
      rows: [
        {
          id: BROWNIE_ID,
          // Renamed to a name that already belongs to another item — the
          // name-based own-id lookup would misroute to MERLOT_ID.
          name: "House Merlot",
          price: "55.00",
          category: "Desserts",
          pairings: "Tiramisu",
        },
      ],
    });

    expect(result.ok).toBe(true);
    const pairingUpdate = pairingUpdates.find((u) => u.pairing_ids !== undefined);
    expect(pairingUpdate).toEqual({ id: BROWNIE_ID, pairing_ids: [TIRAMISU_ID] });
  });
});
