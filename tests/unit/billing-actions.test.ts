import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
});

import {
  pauseSubscriptionAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
} from "@/lib/data/billing-actions";
import { ForbiddenError } from "@/lib/errors";
import * as payfast from "@/lib/billing/payfast";
import * as mail from "@/lib/mail";
import * as role from "@/lib/auth/role";
import * as session from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

vi.mock("@/lib/billing/payfast", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/billing/payfast")>();
  return {
    ...original,
    pauseSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    unpauseSubscription: vi.fn(),
  };
});

vi.mock("@/lib/mail", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/mail")>();
  return {
    ...original,
    sendMail: vi.fn(),
  };
});

vi.mock("next/cache", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/cache")>();
  return {
    ...original,
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/headers", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/headers")>();
  return {
    ...original,
    headers: vi.fn(),
  };
});

vi.mock("@/lib/auth/role", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/role")>();
  return {
    ...original,
    requireOrgAccess: vi.fn(),
    requireRestaurantAccess: vi.fn(),
  };
});

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...original,
    requireSession: vi.fn(),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface MockSupabaseConfig {
  selectSingle?: Record<string, unknown> | null;
  queryData?: unknown;
  updateError?: { message: string } | null;
  insertError?: { message: string } | null;
}

type MockQuery = {
  [key: string]: () => MockQuery | Promise<unknown> | { eq: () => Promise<unknown> };
} & (() => MockQuery);

function createMockSupabase(config: MockSupabaseConfig = {}) {
  const query: MockQuery = new Proxy(() => query, {
    get(_, prop) {
      if (prop === "then") {
        return (resolve: (value: unknown) => void) =>
          resolve({ data: config.queryData ?? null, error: null });
      }
      return () => {
        if (prop === "single") {
          return Promise.resolve({
            data: config.selectSingle ?? null,
            error: null,
          });
        }
        if (prop === "maybeSingle") {
          return Promise.resolve({
            data: config.selectSingle ?? null,
            error: null,
          });
        }
        if (prop === "update") {
          return {
            eq: () => Promise.resolve({ error: config.updateError ?? null }),
          };
        }
        if (prop === "insert") {
          return Promise.resolve({ error: config.insertError ?? null });
        }
        return query;
      };
    },
  }) as MockQuery;

  return {
    from: () => query,
  };
}

const mockedPayfast = payfast as unknown as {
  pauseSubscription: ReturnType<typeof vi.fn>;
  cancelSubscription: ReturnType<typeof vi.fn>;
  unpauseSubscription: ReturnType<typeof vi.fn>;
};

const mockedMail = mail as unknown as { sendMail: ReturnType<typeof vi.fn> };
const mockedRole = role as unknown as {
  requireOrgAccess: ReturnType<typeof vi.fn>;
  requireRestaurantAccess: ReturnType<typeof vi.fn>;
};
const mockedSession = session as unknown as {
  requireSession: ReturnType<typeof vi.fn>;
};
const mockedHeaders = headers as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidatePath = revalidatePath as unknown as ReturnType<
  typeof vi.fn
>;
const mockedCreateServerClient = createServerClient as unknown as ReturnType<
  typeof vi.fn
>;
const mockedCreateAdminClient = createAdminClient as unknown as ReturnType<
  typeof vi.fn
>;

const restaurantSub = {
  id: "sub-rest-123",
  scope: "restaurant",
  scope_id: "rest-123",
  org_id: "org-123",
  plan_id: "plan-123",
  status: "active",
  amount_cents: 9900,
  billing_period: "monthly",
  payfast_token: "pf-token-rest" as string | null,
  m_payment_id: "mp-123",
  started_at: null,
  current_period_end: null,
  next_billing_date: null,
  paused_at: null,
  cancelled_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const orgSub = {
  ...restaurantSub,
  id: "sub-org-123",
  scope: "org",
  scope_id: "org-123",
  payfast_token: "pf-token-org",
};

const actor = {
  id: "user-123",
  email: "owner@example.com",
};

function setupSuccessMocks(sub: typeof restaurantSub) {
  mockedSession.requireSession.mockResolvedValue({ user: actor });
  mockedCreateServerClient.mockReturnValue(
    createMockSupabase({ selectSingle: sub })
  );
  mockedCreateAdminClient.mockReturnValue(
    createMockSupabase({
      queryData: [{ user_id: "admin-1" }, { user_id: "admin-2" }],
    })
  );
  mockedHeaders.mockReturnValue(
    new Headers({
      "x-forwarded-for": "127.0.0.1",
      "user-agent": "test-agent",
    })
  );
  mockedPayfast.pauseSubscription.mockResolvedValue({});
  mockedPayfast.cancelSubscription.mockResolvedValue({});
  mockedPayfast.unpauseSubscription.mockResolvedValue({});
  mockedMail.sendMail.mockResolvedValue(undefined);
  mockedRevalidatePath.mockReturnValue(undefined);
  mockedRole.requireOrgAccess.mockResolvedValue({});
  mockedRole.requireRestaurantAccess.mockResolvedValue({});
}

describe("billing actions", () => {
  beforeAll(() => {
    // silence console.error in tests for expected error paths
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("pauseSubscriptionAction", () => {
    it("pauses a restaurant subscription and sends email", async () => {
      setupSuccessMocks(restaurantSub);

      const result = await pauseSubscriptionAction(restaurantSub.id);

      expect(result.ok).toBe(true);
      expect(mockedPayfast.pauseSubscription).toHaveBeenCalledWith(
        restaurantSub.payfast_token
      );
      expect(mockedMail.sendMail).toHaveBeenCalledWith(
        "subscription-paused",
        actor.email,
        expect.objectContaining({
          restaurant_name: expect.any(String),
          billing_url: `http://localhost:3000/restaurants/${restaurantSub.scope_id}/billing`,
        })
      );
      expect(mockedRevalidatePath).toHaveBeenCalledWith(
        `/restaurants/${restaurantSub.scope_id}/billing`
      );
      expect(mockedRevalidatePath).toHaveBeenCalledWith("/settings/billing");
    });

    it("pauses an org subscription for an admin", async () => {
      setupSuccessMocks(orgSub);

      const result = await pauseSubscriptionAction(orgSub.id);

      expect(result.ok).toBe(true);
      expect(mockedRole.requireOrgAccess).toHaveBeenCalledWith(
        orgSub.org_id,
        "admin"
      );
      expect(mockedMail.sendMail).toHaveBeenCalledWith(
        "subscription-paused",
        actor.email,
        expect.objectContaining({
          billing_url: "http://localhost:3000/settings/billing",
        })
      );
    });

    it("returns not_found when subscription does not exist", async () => {
      mockedSession.requireSession.mockResolvedValue({ user: actor });
      mockedCreateServerClient.mockReturnValue(
        createMockSupabase({ selectSingle: null })
      );

      const result = await pauseSubscriptionAction("missing-id");

      expect(result.ok).toBe(false);
      expect(result.code).toBe("not_found");
    });

    it("rejects users without required access", async () => {
      mockedSession.requireSession.mockResolvedValue({ user: actor });
      mockedCreateServerClient.mockReturnValue(
        createMockSupabase({ selectSingle: orgSub })
      );
      mockedRole.requireOrgAccess.mockRejectedValue(new ForbiddenError());

      const result = await pauseSubscriptionAction(orgSub.id);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("forbidden");
    });

    it("returns error when PayFast API fails without updating the DB", async () => {
      mockedSession.requireSession.mockResolvedValue({ user: actor });
      mockedCreateServerClient.mockReturnValue(
        createMockSupabase({ selectSingle: restaurantSub })
      );
      mockedRole.requireRestaurantAccess.mockResolvedValue({});
      mockedPayfast.pauseSubscription.mockRejectedValue(
        new Error("PayFast failed")
      );

      const result = await pauseSubscriptionAction(restaurantSub.id);

      expect(result.ok).toBe(false);
    });
  });

  describe("cancelSubscriptionAction", () => {
    it("cancels a subscription with a token and sends email", async () => {
      setupSuccessMocks(restaurantSub);

      const result = await cancelSubscriptionAction(restaurantSub.id);

      expect(result.ok).toBe(true);
      expect(mockedPayfast.cancelSubscription).toHaveBeenCalledWith(
        restaurantSub.payfast_token
      );
      expect(mockedMail.sendMail).toHaveBeenCalledWith(
        "subscription-cancelled",
        actor.email,
        expect.objectContaining({ billing_url: expect.any(String) })
      );
    });

    it("cancels locally when no PayFast token exists", async () => {
      const subWithoutToken = { ...restaurantSub, payfast_token: null };
      setupSuccessMocks(subWithoutToken);

      const result = await cancelSubscriptionAction(subWithoutToken.id);

      expect(result.ok).toBe(true);
      expect(mockedPayfast.cancelSubscription).not.toHaveBeenCalled();
      expect(mockedMail.sendMail).toHaveBeenCalled();
    });

    it("rejects non-admins on org subscriptions", async () => {
      mockedSession.requireSession.mockResolvedValue({ user: actor });
      mockedCreateServerClient.mockReturnValue(
        createMockSupabase({ selectSingle: orgSub })
      );
      mockedRole.requireOrgAccess.mockRejectedValue(new ForbiddenError());

      const result = await cancelSubscriptionAction(orgSub.id);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("forbidden");
    });
  });

  describe("resumeSubscriptionAction", () => {
    it("resumes a paused subscription", async () => {
      setupSuccessMocks({ ...restaurantSub, status: "paused" });

      const result = await resumeSubscriptionAction(restaurantSub.id);

      expect(result.ok).toBe(true);
      expect(mockedPayfast.unpauseSubscription).toHaveBeenCalledWith(
        restaurantSub.payfast_token
      );
      expect(mockedMail.sendMail).not.toHaveBeenCalled();
    });

    it("rejects when token is missing", async () => {
      mockedSession.requireSession.mockResolvedValue({ user: actor });
      mockedCreateServerClient.mockReturnValue(
        createMockSupabase({
          selectSingle: { ...restaurantSub, payfast_token: null },
        })
      );
      mockedRole.requireRestaurantAccess.mockResolvedValue({});

      const result = await resumeSubscriptionAction(restaurantSub.id);

      expect(result.ok).toBe(false);
      expect(result.code).toBe("validation");
    });
  });
});
