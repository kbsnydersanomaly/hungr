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

import { renameMenu } from "@/lib/data/menu-actions";
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
