import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireSession,
  requireOrgAccess,
  writeAudit,
  revalidatePath,
  redirect,
  storageList,
  storageRemove,
  rpc,
  restaurantsMaybeSingle,
  subscriptionsMaybeSingle,
} = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireOrgAccess: vi.fn(),
  writeAudit: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  storageList: vi.fn(),
  storageRemove: vi.fn(),
  rpc: vi.fn(),
  restaurantsMaybeSingle: vi.fn(),
  subscriptionsMaybeSingle: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirect(url);
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = "NEXT_REDIRECT";
    throw err;
  },
}));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } }));
vi.mock("@/lib/utils/audit", () => ({ writeAudit }));
vi.mock("@/lib/auth/session", () => ({ requireSession }));
vi.mock("@/lib/auth/role", () => ({ requireOrgAccess }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        list: (path: string, opts: unknown) => storageList(bucket, path, opts),
        remove: (paths: string[]) => storageRemove(bucket, paths),
      }),
    },
  }),
}));

import { deleteRestaurant } from "@/lib/data/restaurant-actions";

const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";

const restaurantRow = {
  id: RESTAURANT_ID,
  org_id: ORG_ID,
  name: "Layout Test 9",
  slug: "layout-test-9",
};

function makeSupabase() {
  const builders: Record<string, () => unknown> = {
    restaurants: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: restaurantsMaybeSingle }),
      }),
    }),
    subscriptions: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: subscriptionsMaybeSingle }),
          }),
        }),
      }),
    }),
  };
  return {
    from: (table: string) => builders[table](),
    rpc,
  };
}

describe("deleteRestaurant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ user: { id: USER_ID }, supabase: makeSupabase() });
    requireOrgAccess.mockResolvedValue({ user: { id: USER_ID } });
    restaurantsMaybeSingle.mockResolvedValue({ data: restaurantRow, error: null });
    subscriptionsMaybeSingle.mockResolvedValue({ data: null, error: null });
    storageList.mockResolvedValue({
      data: [
        { id: "a", name: "img1.png" },
        { id: "b", name: "menu-1.png" },
      ],
      error: null,
    });
    storageRemove.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: null });
  });

  it("blocks deletion when the restaurant has an active subscription", async () => {
    subscriptionsMaybeSingle.mockResolvedValue({ data: { id: "sub-1" }, error: null });

    const result = await deleteRestaurant(RESTAURANT_ID);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("billing");
    expect(result.message).toContain("active subscription");
    expect(result.message).toContain(`/restaurants/${RESTAURANT_ID}/billing`);
    expect(storageList).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("requires org admin access for the restaurant's org", async () => {
    await expect(deleteRestaurant(RESTAURANT_ID)).rejects.toThrow("NEXT_REDIRECT");
    expect(requireOrgAccess).toHaveBeenCalledWith(ORG_ID, "admin");
  });

  it("cleans storage under the restaurant prefix before calling the RPC", async () => {
    await expect(deleteRestaurant(RESTAURANT_ID)).rejects.toThrow("NEXT_REDIRECT");

    expect(storageList).toHaveBeenCalledWith("menu-media", `${RESTAURANT_ID}/`, {
      limit: 100,
      offset: 0,
    });
    expect(storageRemove).toHaveBeenCalledWith("menu-media", [
      `${RESTAURANT_ID}/img1.png`,
      `${RESTAURANT_ID}/menu-1.png`,
    ]);
    // Storage cleanup must happen before the cascade RPC.
    expect(storageRemove.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[0]
    );
  });

  it("calls the cascade RPC, audits the deletion and redirects to /restaurants", async () => {
    await expect(deleteRestaurant(RESTAURANT_ID)).rejects.toThrow("NEXT_REDIRECT");

    expect(rpc).toHaveBeenCalledWith("delete_restaurant_cascade", {
      p_restaurant_id: RESTAURANT_ID,
    });
    expect(writeAudit).toHaveBeenCalledWith({
      action: "restaurant.delete",
      org_id: ORG_ID,
      target_table: "restaurants",
      target_id: RESTAURANT_ID,
      diff: { name: "Layout Test 9", slug: "layout-test-9" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/restaurants");
    expect(revalidatePath).toHaveBeenCalledWith("/m/layout-test-9");
    expect(redirect).toHaveBeenCalledWith("/restaurants");
  });

  it("returns not_found when the restaurant does not exist", async () => {
    restaurantsMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await deleteRestaurant(RESTAURANT_ID);

    expect(result.ok).toBe(false);
    expect(result.code).toBe("not_found");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces an RPC failure without auditing", async () => {
    rpc.mockResolvedValue({ error: { message: "boom", code: "XX000" } });

    const result = await deleteRestaurant(RESTAURANT_ID);

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Failed to delete restaurant");
    expect(writeAudit).not.toHaveBeenCalled();
  });
});
