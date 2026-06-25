import { describe, it, expect, vi } from "vitest";
import {
  findPendingSubscription,
  isRestaurantManagementAllowed,
  isRestaurantSubscriptionValid,
  loadRestaurantSubscriptions,
} from "@/lib/billing/subscription";
import { ForbiddenError } from "@/lib/errors";

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error(`NEXT_REDIRECT ${url}`);
    Object.assign(err, { digest: "NEXT_REDIRECT" });
    throw err;
  }),
}));

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  assertRestaurantManagementAllowed,
  requireRestaurantManagementOrRedirect,
} from "@/lib/billing/subscription";

const mockedCreateServerClient = createServerClient as unknown as ReturnType<
  typeof vi.fn
>;
const mockedRedirect = redirect as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date("2026-06-24T12:00:00Z");
const FUTURE = "2026-07-01T12:00:00Z";
const PAST = "2026-06-01T12:00:00Z";

describe("isRestaurantSubscriptionValid", () => {
  it("returns valid when an active subscription has a future period end", () => {
    expect(
      isRestaurantSubscriptionValid(
        [{ status: "active", current_period_end: FUTURE }],
        NOW
      )
    ).toEqual({ valid: true });
  });

  it("returns valid when an active subscription has a null period end", () => {
    expect(
      isRestaurantSubscriptionValid(
        [{ status: "active", current_period_end: null }],
        NOW
      )
    ).toEqual({ valid: true });
  });

  it("returns expired when an active subscription has a past period end", () => {
    expect(
      isRestaurantSubscriptionValid(
        [{ status: "active", current_period_end: PAST }],
        NOW
      )
    ).toEqual({ valid: false, reason: "expired" });
  });

  it("returns pending for pending subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [{ status: "pending", current_period_end: FUTURE }],
        NOW
      )
    ).toEqual({ valid: false, reason: "pending" });
  });

  it("returns paused for paused subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [{ status: "paused", current_period_end: FUTURE }],
        NOW
      )
    ).toEqual({ valid: false, reason: "paused" });
  });

  it("returns cancelled for cancelled subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [{ status: "cancelled", current_period_end: FUTURE }],
        NOW
      )
    ).toEqual({ valid: false, reason: "cancelled" });
  });

  it("returns failed for failed subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [{ status: "failed", current_period_end: FUTURE }],
        NOW
      )
    ).toEqual({ valid: false, reason: "failed" });
  });

  it("prefers active subscriptions over other statuses", () => {
    expect(
      isRestaurantSubscriptionValid(
        [
          { status: "paused", current_period_end: FUTURE },
          { status: "active", current_period_end: FUTURE },
        ],
        NOW
      )
    ).toEqual({ valid: true });
  });

  it("prefers expired reason over other inactive statuses", () => {
    expect(
      isRestaurantSubscriptionValid(
        [
          { status: "paused", current_period_end: FUTURE },
          { status: "active", current_period_end: PAST },
        ],
        NOW
      )
    ).toEqual({ valid: false, reason: "expired" });
  });

  it("returns no_active_subscription for an empty list", () => {
    expect(isRestaurantSubscriptionValid([], NOW)).toEqual({
      valid: false,
      reason: "no_active_subscription",
    });
  });

  it("prefers paused over pending for inactive subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [
          { status: "pending", current_period_end: FUTURE },
          { status: "paused", current_period_end: FUTURE },
        ],
        NOW
      )
    ).toEqual({ valid: false, reason: "paused" });
  });

  it("prefers cancelled over failed for inactive subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [
          { status: "failed", current_period_end: FUTURE },
          { status: "cancelled", current_period_end: FUTURE },
        ],
        NOW
      )
    ).toEqual({ valid: false, reason: "cancelled" });
  });

  it("prefers paused over cancelled for inactive subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [
          { status: "cancelled", current_period_end: FUTURE },
          { status: "paused", current_period_end: FUTURE },
        ],
        NOW
      )
    ).toEqual({ valid: false, reason: "paused" });
  });

  it("prefers paused over failed for inactive subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [
          { status: "failed", current_period_end: FUTURE },
          { status: "paused", current_period_end: FUTURE },
        ],
        NOW
      )
    ).toEqual({ valid: false, reason: "paused" });
  });

  it("prefers cancelled over pending for inactive subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [
          { status: "pending", current_period_end: FUTURE },
          { status: "cancelled", current_period_end: FUTURE },
        ],
        NOW
      )
    ).toEqual({ valid: false, reason: "cancelled" });
  });

  it("prefers failed over pending for inactive subscriptions", () => {
    expect(
      isRestaurantSubscriptionValid(
        [
          { status: "pending", current_period_end: FUTURE },
          { status: "failed", current_period_end: FUTURE },
        ],
        NOW
      )
    ).toEqual({ valid: false, reason: "failed" });
  });
});

describe("loadRestaurantSubscriptions", () => {
  it("filters rows by restaurant and org scope", async () => {
    const rows = [
      {
        id: "s1",
        status: "active",
        current_period_end: FUTURE,
        scope: "restaurant",
        scope_id: "r1",
      },
      {
        id: "s2",
        status: "active",
        current_period_end: FUTURE,
        scope: "restaurant",
        scope_id: "r2",
      },
      {
        id: "s3",
        status: "active",
        current_period_end: FUTURE,
        scope: "org",
        scope_id: "o1",
      },
    ];

    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnThis();
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select,
        eq,
        in: vi.fn().mockResolvedValue({ data: rows, error: null }),
      }),
    };

    const result = await loadRestaurantSubscriptions(
      mockSupabase as unknown as Parameters<typeof loadRestaurantSubscriptions>[0],
      { id: "r1", org_id: "o1" }
    );

    expect(mockSupabase.from).toHaveBeenCalledWith("subscriptions");
    expect(select).toHaveBeenCalledWith(
      "id, status, current_period_end, scope, scope_id"
    );
    expect(eq).toHaveBeenCalledWith("org_id", "o1");
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.scope_id).sort()).toEqual(["o1", "r1"]);
  });
});

describe("isRestaurantManagementAllowed", () => {
  it("allows active subscriptions", () => {
    expect(
      isRestaurantManagementAllowed(
        [{ status: "active", current_period_end: FUTURE }],
        NOW
      )
    ).toBe(true);
  });

  it("allows pending subscriptions so the retry banner can be shown", () => {
    expect(
      isRestaurantManagementAllowed(
        [{ status: "pending", current_period_end: FUTURE }],
        NOW
      )
    ).toBe(true);
  });

  it("blocks failed subscriptions", () => {
    expect(
      isRestaurantManagementAllowed(
        [{ status: "failed", current_period_end: FUTURE }],
        NOW
      )
    ).toBe(false);
  });

  it("blocks cancelled subscriptions", () => {
    expect(
      isRestaurantManagementAllowed(
        [{ status: "cancelled", current_period_end: FUTURE }],
        NOW
      )
    ).toBe(false);
  });

  it("blocks paused subscriptions", () => {
    expect(
      isRestaurantManagementAllowed(
        [{ status: "paused", current_period_end: FUTURE }],
        NOW
      )
    ).toBe(false);
  });

  it("blocks expired subscriptions", () => {
    expect(
      isRestaurantManagementAllowed(
        [{ status: "active", current_period_end: PAST }],
        NOW
      )
    ).toBe(false);
  });

  it("blocks when there is no subscription", () => {
    expect(isRestaurantManagementAllowed([], NOW)).toBe(false);
  });
});

describe("findPendingSubscription", () => {
  it("prefers restaurant-scoped pending subscriptions", () => {
    const result = findPendingSubscription([
      {
        id: "org-pending",
        status: "pending",
        current_period_end: FUTURE,
        scope: "org",
        scope_id: "o1",
      },
      {
        id: "rest-pending",
        status: "pending",
        current_period_end: FUTURE,
        scope: "restaurant",
        scope_id: "r1",
      },
    ]);

    expect(result?.id).toBe("rest-pending");
  });

  it("falls back to org-scoped pending subscriptions", () => {
    const result = findPendingSubscription([
      {
        id: "org-pending",
        status: "pending",
        current_period_end: FUTURE,
        scope: "org",
        scope_id: "o1",
      },
    ]);

    expect(result?.id).toBe("org-pending");
  });

  it("returns null when no pending subscription exists", () => {
    expect(
      findPendingSubscription([
        {
          id: "s1",
          status: "active",
          current_period_end: FUTURE,
          scope: "restaurant",
          scope_id: "r1",
        },
      ])
    ).toBeNull();
  });
});

describe("assertRestaurantManagementAllowed", () => {
  it("throws when management is blocked", async () => {
    mockedCreateServerClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "restaurants") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "r1", org_id: "o1" },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: "s1",
                status: "failed",
                current_period_end: FUTURE,
                scope: "restaurant",
                scope_id: "r1",
              },
            ],
            error: null,
          }),
        };
      }),
    });

    await expect(assertRestaurantManagementAllowed("r1")).rejects.toThrow(
      ForbiddenError
    );
  });
});

describe("requireRestaurantManagementOrRedirect", () => {
  it("redirects to billing when management is blocked", async () => {
    mockedCreateServerClient.mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: "s1",
              status: "cancelled",
              current_period_end: FUTURE,
              scope: "restaurant",
              scope_id: "r1",
            },
          ],
          error: null,
        }),
      })),
    });

    await expect(
      requireRestaurantManagementOrRedirect("r1", "o1")
    ).rejects.toMatchObject({ digest: "NEXT_REDIRECT" });

    expect(mockedRedirect).toHaveBeenCalledWith(
      "/restaurants/r1/billing?reason=subscription_required"
    );
  });
});
