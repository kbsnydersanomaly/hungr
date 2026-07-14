import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  vi.stubEnv("PAYFAST_MERCHANT_ID", "10000100");
  vi.stubEnv("PAYFAST_MERCHANT_KEY", "46f0cd694581a");
  vi.stubEnv("PAYFAST_PASSPHRASE", "jt7NOE43FZPn");
  vi.stubEnv("PAYFAST_SANDBOX", "true");
});

import { updatePaymentMethodAction } from "@/lib/data/billing-actions";
import * as role from "@/lib/auth/role";
import * as session from "@/lib/auth/session";

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

const actor = {
  id: "user-123",
  email: "owner@example.com",
};

const mockedSession = session as unknown as {
  requireSession: ReturnType<typeof vi.fn>;
};
const mockedRole = role as unknown as {
  requireRestaurantAccess: ReturnType<typeof vi.fn>;
};
const mockedCreateServerClient = createServerClient as unknown as ReturnType<
  typeof vi.fn
>;
const mockedCreateAdminClient = createAdminClient as unknown as ReturnType<
  typeof vi.fn
>;

describe("updatePaymentMethodAction sandbox fallback", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockedSession.requireSession.mockResolvedValue({ user: actor });
    mockedCreateServerClient.mockReturnValue(
      createMockSupabase({ selectSingle: restaurantSub })
    );
    mockedCreateAdminClient.mockReturnValue(createMockSupabase());
    mockedRole.requireRestaurantAccess.mockResolvedValue({});
  });

  it("returns a replacement checkout URL in sandbox mode", async () => {
    const result = await updatePaymentMethodAction(restaurantSub.id);

    expect(result.ok).toBe(true);
    expect(result.data?.url).toContain("sandbox.payfast.co.za");
    expect(result.data?.url).toContain("m_payment_id=replace%3A");
  });
});
