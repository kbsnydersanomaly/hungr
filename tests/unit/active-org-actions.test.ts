import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks for server-only dependencies -------------------------------------
const { cookieSet, cookieDelete, redirect, requireSession } = vi.hoisted(() => ({
  cookieSet: vi.fn(),
  cookieDelete: vi.fn(),
  redirect: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ set: cookieSet, delete: cookieDelete }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ requireSession }));

import { setActiveOrg } from "@/lib/auth/active-org-actions";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";

/** Supabase stub whose membership lookup resolves to `membership`. */
function makeSupabase(membership: unknown) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: membership }),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setActiveOrg", () => {
  it("sets the active_org cookie and redirects for a member", async () => {
    requireSession.mockResolvedValue({
      user: { id: USER_ID },
      supabase: makeSupabase({ org_id: ORG_ID }),
    });

    await setActiveOrg(ORG_ID);

    expect(cookieSet).toHaveBeenCalledWith(
      "active_org",
      ORG_ID,
      expect.objectContaining({ path: "/" })
    );
    // The previous org's restaurant selection is cleared on switch.
    expect(cookieDelete).toHaveBeenCalledWith("active_restaurant");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects switching to an org the user does not belong to", async () => {
    requireSession.mockResolvedValue({
      user: { id: USER_ID },
      supabase: makeSupabase(null),
    });

    const result = await setActiveOrg(ORG_ID);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not a member/i);
    expect(cookieSet).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
