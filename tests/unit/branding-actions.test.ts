import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRestaurantAccess, writeAudit } = vi.hoisted(() => ({
  requireRestaurantAccess: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/utils/audit", () => ({ writeAudit }));
vi.mock("@/lib/auth/role", () => ({ requireRestaurantAccess }));

import { saveDraftAction } from "@/lib/data/branding-actions";

const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

/**
 * Minimal Supabase stub: `upsert` records its payload and resolves to the
 * configured `{ error }`.
 */
function makeSupabase(upsertError: unknown = null) {
  const captured: { upsert?: Record<string, unknown> } = {};
  const builder = {
    from: () => builder,
    upsert: (payload: Record<string, unknown>) => {
      captured.upsert = payload;
      return Promise.resolve({ error: upsertError });
    },
  };
  return { builder, captured };
}

describe("saveDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { ok: false } when the upsert fails", async () => {
    const { builder } = makeSupabase({ message: "boom" });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await saveDraftAction(RESTAURANT_ID, {
      primary_color: "#FE1B54",
    });

    expect(result.ok).toBe(false);
  });

  it("strips invalid hex colors before persisting", async () => {
    const { builder, captured } = makeSupabase();
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await saveDraftAction(RESTAURANT_ID, {
      primary_color: "#FE1B54", // valid
      secondary_color: "#GGGGGG", // invalid hex → dropped
      accent_color: "#12", // half-typed → dropped
    });

    expect(result.ok).toBe(true);
    expect(captured.upsert).toMatchObject({
      primary_color: "#FE1B54",
      secondary_color: null,
      accent_color: null,
    });
  });
});
