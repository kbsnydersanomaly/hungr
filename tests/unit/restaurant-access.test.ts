import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks for server-only dependencies -------------------------------------
// vi.mock factories are hoisted above module init, so the shared mock fns must be
// created via vi.hoisted to exist when the factories run.
const { createServerClient, createAdminClient, requireSession } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/auth/session", () => ({ requireSession }));

import { loadRestaurantsForUser } from "@/lib/data/restaurants";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { ForbiddenError } from "@/lib/errors";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "11111111-1111-4111-8111-111111111111";
const REST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const restaurantA = { id: REST_A, org_id: ORG_ID, name: "Cafe A" };
const restaurantB = { id: REST_B, org_id: ORG_ID, name: "Cafe B" };

type Result = { data?: unknown; error?: unknown };

/**
 * Per-table Supabase stub. `from(table)` records the access and returns a
 * chainable, awaitable builder that resolves to the result configured for that
 * table (via `.maybeSingle()`, `.single()`, or a bare `await` after `.order()`).
 */
function makeSupabase(results: Record<string, Result>) {
  const fromCalls: string[] = [];
  function builderFor(table: string) {
    const resolveResult = () => results[table] ?? { data: null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      maybeSingle: () => Promise.resolve(resolveResult()),
      single: () => Promise.resolve(resolveResult()),
      then: (onFulfilled: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolveResult()).then(onFulfilled, onRejected),
    };
    return builder;
  }
  const root = {
    from: (table: string) => {
      fromCalls.push(table);
      return builderFor(table);
    },
  };
  return { root, fromCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadRestaurantsForUser", () => {
  it("returns only assigned restaurants for org 'staff' and never queries the org-wide list", async () => {
    const { root, fromCalls } = makeSupabase({
      organization_members: { data: { role: "staff" } },
      restaurant_members: {
        data: [{ restaurants: restaurantA }, { restaurants: null }],
      },
      restaurants: { data: [restaurantA, restaurantB] },
    });
    createServerClient.mockResolvedValue(root);

    const result = await loadRestaurantsForUser(USER_ID, ORG_ID);

    expect(result).toEqual([restaurantA]);
    expect(fromCalls).not.toContain("restaurants");
  });

  it("returns only assigned restaurants when the user has no org membership row", async () => {
    const { root, fromCalls } = makeSupabase({
      organization_members: { data: null },
      restaurant_members: { data: [{ restaurants: restaurantA }] },
      restaurants: { data: [restaurantA, restaurantB] },
    });
    createServerClient.mockResolvedValue(root);

    const result = await loadRestaurantsForUser(USER_ID, ORG_ID);

    expect(result).toEqual([restaurantA]);
    expect(fromCalls).not.toContain("restaurants");
  });

  it("merges org restaurants with assignments (deduped) for org admins", async () => {
    const { root } = makeSupabase({
      organization_members: { data: { role: "admin" } },
      restaurant_members: { data: [{ restaurants: restaurantA }] },
      restaurants: { data: [restaurantA, restaurantB] },
    });
    createServerClient.mockResolvedValue(root);

    const result = await loadRestaurantsForUser(USER_ID, ORG_ID);

    expect(result).toEqual([restaurantA, restaurantB]);
  });
});

describe("requireRestaurantAccess", () => {
  function mockSession(results: Record<string, Result>, adminResults: Record<string, Result> = {}) {
    const { root } = makeSupabase(results);
    const { root: adminRoot } = makeSupabase(adminResults);
    requireSession.mockResolvedValue({ user: { id: USER_ID }, supabase: root });
    createAdminClient.mockReturnValue(adminRoot);
  }

  it("allows an org 'staff' user with a restaurant_members row", async () => {
    mockSession({
      restaurants: { data: { org_id: ORG_ID } },
      organization_members: { data: { role: "staff" } },
      restaurant_members: { data: { role: "manager" } },
    });

    await expect(requireRestaurantAccess(REST_A, "manager")).resolves.toBeDefined();
  });

  it("denies an org 'staff' user with no restaurant_members row", async () => {
    mockSession(
      {
        restaurants: { data: { org_id: ORG_ID } },
        organization_members: { data: { role: "staff" } },
        restaurant_members: { data: null },
      },
      { profiles: { data: { is_super_admin: false } } }
    );

    await expect(requireRestaurantAccess(REST_A, "staff")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows an org admin without a restaurant_members row", async () => {
    mockSession({
      restaurants: { data: { org_id: ORG_ID } },
      organization_members: { data: { role: "admin" } },
      restaurant_members: { data: null },
    });

    await expect(requireRestaurantAccess(REST_A, "staff")).resolves.toBeDefined();
  });

  it("denies a restaurant 'staff' member when 'manager' is required", async () => {
    mockSession(
      {
        restaurants: { data: { org_id: ORG_ID } },
        organization_members: { data: null },
        restaurant_members: { data: { role: "staff" } },
      },
      { profiles: { data: { is_super_admin: false } } }
    );

    await expect(requireRestaurantAccess(REST_A, "manager")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows a super admin with no membership rows", async () => {
    mockSession(
      {
        restaurants: { data: { org_id: ORG_ID } },
        organization_members: { data: null },
        restaurant_members: { data: null },
      },
      { profiles: { data: { is_super_admin: true } } }
    );

    await expect(requireRestaurantAccess(REST_A, "manager")).resolves.toBeDefined();
  });

  it("denies access to a restaurant that does not exist", async () => {
    mockSession({ restaurants: { data: null } });

    await expect(requireRestaurantAccess(REST_A, "staff")).rejects.toBeInstanceOf(ForbiddenError);
  });
});
