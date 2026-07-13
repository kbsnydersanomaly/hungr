import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks for server-only dependencies -------------------------------------
// vi.mock factories are hoisted above module init, so the shared mock fns must
// be created via vi.hoisted to exist when the factories run.
const { requireRestaurantAccess, createServerClient, revalidatePath } = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  createServerClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/role", () => ({ requireRestaurantAccess }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));

import { setSpecialActive } from "@/lib/data/special-actions";
import { ForbiddenError } from "@/lib/errors";

const SPECIAL_ID = "44444444-4444-4444-8444-444444444444";
const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Minimal chainable Supabase stub: `update` records its payload and the
 * builder is awaitable so the `.update().eq()` chain resolves to `{ error }`.
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
    maybeSingle: () => Promise.resolve({ data: { restaurant_id: RESTAURANT_ID } }),
    then: (resolve: (v: unknown) => void) => resolve({ error: updateError }),
  };
  return { builder, captured };
}

describe("setSpecialActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // loadSpecialRestaurantId uses its own server client to resolve the
    // special's restaurant before the access check. Must not reuse the
    // thenable update stub: a thenable would be adopted by the awaited
    // promise and resolve to `{ error }` instead of the client.
    createServerClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { restaurant_id: RESTAURANT_ID } }),
          }),
        }),
      }),
    });
  });

  it("requires manager access to the special's restaurant", async () => {
    requireRestaurantAccess.mockRejectedValue(new ForbiddenError());

    const result = await setSpecialActive(SPECIAL_ID, true);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("forbidden");
    expect(requireRestaurantAccess).toHaveBeenCalledWith(RESTAURANT_ID, "manager");
  });

  it("updates only the active flag", async () => {
    const { builder, captured } = makeSupabase();
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await setSpecialActive(SPECIAL_ID, false);

    expect(result.ok).toBe(true);
    expect(captured.update).toMatchObject({ active: false });
    expect(Object.keys(captured.update ?? {}).sort()).toEqual(["active", "updated_at"]);
  });

  it("revalidates the specials list path", async () => {
    const { builder } = makeSupabase();
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    await setSpecialActive(SPECIAL_ID, true);

    expect(revalidatePath).toHaveBeenCalledWith(`/restaurants/${RESTAURANT_ID}/specials`);
  });

  it("wraps database failures with the underlying reason", async () => {
    const { builder } = makeSupabase({ message: "boom", code: "42P01" });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await setSpecialActive(SPECIAL_ID, true);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Failed to update special");
    expect(result.message).toContain("boom");
  });
});
