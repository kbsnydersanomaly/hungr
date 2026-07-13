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
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { renameMedia } from "@/lib/data/media-actions";
import { ForbiddenError } from "@/lib/errors";

const MEDIA_ID = "33333333-3333-4333-8333-333333333333";
const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

/** Lookup client used for the initial `media` row fetch. */
function makeLookupClient(mediaRow: { id: string; restaurant_id: string } | null) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: mediaRow, error: null }),
  };
  return builder;
}

/**
 * Chainable Supabase stub for the authed client: `select` on `media` resolves
 * to the canned existing rows, `update` records its payload and target id,
 * and the builder is awaitable so the `.update().eq()` chain resolves to
 * `{ error }`.
 */
function makeAuthedSupabase(
  existing: { id: string; name: string }[],
  updateError: unknown = null
) {
  const captured: { update?: Record<string, unknown>; updateId?: unknown } = {};
  let pendingUpdate: Record<string, unknown> | null = null;
  let awaitingUpdate = false;
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    update: (payload: Record<string, unknown>) => {
      pendingUpdate = payload;
      awaitingUpdate = true;
      return builder;
    },
    eq: (col: string, value: unknown) => {
      if (pendingUpdate && col === "id") {
        captured.update = pendingUpdate;
        captured.updateId = value;
        pendingUpdate = null;
      }
      return builder;
    },
    then: (resolve: (v: unknown) => void) => {
      if (awaitingUpdate) {
        awaitingUpdate = false;
        pendingUpdate = null;
        resolve({ error: updateError });
        return;
      }
      resolve({ data: existing, error: null });
    },
  };
  return { builder, captured };
}

describe("renameMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerClient.mockResolvedValue(
      makeLookupClient({ id: MEDIA_ID, restaurant_id: RESTAURANT_ID })
    );
  });

  it("requires manager access to the media's restaurant", async () => {
    requireRestaurantAccess.mockRejectedValue(new ForbiddenError());

    const result = await renameMedia(MEDIA_ID, "new-name.png");

    expect(result.ok).toBe(false);
    expect(result.code).toBe("forbidden");
    expect(requireRestaurantAccess).toHaveBeenCalledWith(RESTAURANT_ID, "manager");
  });

  it("returns not_found when the media row does not exist", async () => {
    createServerClient.mockResolvedValue(makeLookupClient(null));

    const result = await renameMedia(MEDIA_ID, "new-name.png");

    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_found");
    expect(requireRestaurantAccess).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
  ])("rejects a %s name without touching the database", async (_label, name) => {
    const { builder } = makeAuthedSupabase([]);
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMedia(MEDIA_ID, name);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("validation");
    expect(result.message).toContain("required");
  });

  it("rejects names longer than 120 characters", async () => {
    const { builder } = makeAuthedSupabase([]);
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMedia(MEDIA_ID, "x".repeat(121));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("validation");
    expect(result.message).toContain("120");
  });

  it("updates only the name column and trims whitespace", async () => {
    const { builder, captured } = makeAuthedSupabase([]);
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMedia(MEDIA_ID, "  hero.png  ");

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ name: "hero.png" });
    expect(captured.updateId).toBe(MEDIA_ID);
    expect(Object.keys(captured.update ?? {})).toEqual(["name"]);
    expect(captured.update).toMatchObject({ name: "hero.png" });
    expect(captured.update).not.toHaveProperty("path");
    expect(captured.update).not.toHaveProperty("url");
  });

  it("dedups against other media names in the restaurant", async () => {
    const { builder, captured } = makeAuthedSupabase([
      { id: "other-1", name: "logo.png" },
      { id: "other-2", name: "1-logo.png" },
    ]);
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMedia(MEDIA_ID, "logo.png");

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ name: "2-logo.png" });
    expect(captured.update).toMatchObject({ name: "2-logo.png" });
  });

  it("excludes the media item itself from the dedup check", async () => {
    const { builder, captured } = makeAuthedSupabase([
      { id: MEDIA_ID, name: "logo.png" },
    ]);
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMedia(MEDIA_ID, "logo.png");

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ name: "logo.png" });
    expect(captured.update).toMatchObject({ name: "logo.png" });
  });

  it("revalidates the media page after renaming", async () => {
    const { builder } = makeAuthedSupabase([]);
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    await renameMedia(MEDIA_ID, "hero.png");

    expect(revalidatePath).toHaveBeenCalledWith(`/restaurants/${RESTAURANT_ID}/media`);
  });

  it("wraps database failures with the underlying reason", async () => {
    const { builder } = makeAuthedSupabase([], { message: "boom", code: "42P01" });
    requireRestaurantAccess.mockResolvedValue({ supabase: builder });

    const result = await renameMedia(MEDIA_ID, "hero.png");

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Failed to rename media");
    expect(result.message).toContain("boom");
  });
});
