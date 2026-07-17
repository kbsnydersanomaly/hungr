import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireSession,
  redirect,
  payfastCancel,
  signOut,
  deleteAuthUser,
  storageRemove,
  selectEq,
  selectIn,
  deleteEq,
} = vi.hoisted(() => ({
  requireSession: vi.fn(),
  redirect: vi.fn(),
  payfastCancel: vi.fn(),
  signOut: vi.fn(),
  deleteAuthUser: vi.fn(),
  storageRemove: vi.fn(),
  selectEq: vi.fn(),
  selectIn: vi.fn(),
  deleteEq: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirect(url);
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = "NEXT_REDIRECT";
    throw err;
  },
}));
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
}));
vi.mock("@/lib/auth/session", () => ({ requireSession }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ auth: { signOut } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => makeAdminClient(),
}));
vi.mock("@/lib/billing/payfast", () => ({
  cancelSubscription: payfastCancel,
}));

import { deleteOwnAccount } from "@/lib/data/profile-actions";

const USER_ID = "33333333-3333-4333-8333-333333333333";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const USER = { id: USER_ID, email: "owner@example.com" };

// Canned query results, re-seeded in beforeEach.
let organizationsData: unknown;
let subscriptionsData: unknown;
let mediaByOrgData: unknown;
let mediaByOwnerData: unknown;

function makeAdminClient() {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, value: unknown) => {
          selectEq(table, col, value);
          if (table === "organizations") {
            return Promise.resolve({ data: organizationsData, error: null });
          }
          if (table === "media" && col === "org_id") {
            return Promise.resolve({ data: mediaByOrgData, error: null });
          }
          if (table === "media" && col === "owner_user_id") {
            return Promise.resolve({ data: mediaByOwnerData, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        in: (col: string, values: unknown[]) => {
          selectIn(table, col, values);
          if (table === "subscriptions") {
            return Promise.resolve({ data: subscriptionsData, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      }),
      delete: () => ({
        eq: (col: string, value: unknown) => {
          deleteEq(table, col, value);
          return Promise.resolve({ error: null });
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        remove: (paths: string[]) => storageRemove(bucket, paths),
      }),
    },
    auth: {
      admin: {
        deleteUser: (id: string) => deleteAuthUser(id),
      },
    },
  };
}

describe("deleteOwnAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({ user: USER, supabase: {} });
    organizationsData = [{ id: ORG_ID }];
    subscriptionsData = [
      { id: "sub-1", payfast_token: "tok-1", status: "active" },
    ];
    mediaByOrgData = [{ bucket: "menu-media", path: `${ORG_ID}/dish.png` }];
    mediaByOwnerData = [{ bucket: "menu-media", path: "loose/avatar.png" }];
    payfastCancel.mockResolvedValue(undefined);
    storageRemove.mockResolvedValue({ error: null });
    deleteAuthUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("rejects when the confirmation email does not match the account email", async () => {
    const result = await deleteOwnAccount("someone-else@example.com");

    expect(result.ok).toBe(false);
    expect(result.code).toBe("validation");
    expect(payfastCancel).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("cancels live PayFast subscriptions, deletes owned orgs, purges storage, deletes the auth user and redirects", async () => {
    await expect(deleteOwnAccount("owner@example.com")).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(payfastCancel).toHaveBeenCalledWith("tok-1");
    // Owned org's dependent rows and the org itself are removed.
    expect(deleteEq).toHaveBeenCalledWith("subscriptions", "org_id", ORG_ID);
    expect(deleteEq).toHaveBeenCalledWith("restaurants", "org_id", ORG_ID);
    expect(deleteEq).toHaveBeenCalledWith("organizations", "id", ORG_ID);
    // Org media and remaining user media storage objects are purged.
    expect(storageRemove).toHaveBeenCalledWith("menu-media", [
      `${ORG_ID}/dish.png`,
    ]);
    expect(storageRemove).toHaveBeenCalledWith("menu-media", [
      "loose/avatar.png",
    ]);
    // The auth user is deleted, the session signed out, and we leave the app.
    expect(deleteAuthUser).toHaveBeenCalledWith(USER_ID);
    expect(deleteAuthUser.mock.invocationCallOrder[0]).toBeGreaterThan(
      deleteEq.mock.invocationCallOrder[0]
    );
    expect(signOut).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("only cancels active or paused subscriptions that have a PayFast token", async () => {
    subscriptionsData = [
      { id: "sub-pending", payfast_token: "tok-p", status: "pending" },
      { id: "sub-cancelled", payfast_token: "tok-c", status: "cancelled" },
      { id: "sub-failed", payfast_token: null, status: "failed" },
      { id: "sub-paused", payfast_token: "tok-2", status: "paused" },
    ];

    await expect(deleteOwnAccount("owner@example.com")).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(payfastCancel).toHaveBeenCalledTimes(1);
    expect(payfastCancel).toHaveBeenCalledWith("tok-2");
  });

  it("continues the deletion when a PayFast cancellation fails", async () => {
    payfastCancel.mockRejectedValue(new Error("payfast unreachable"));

    await expect(deleteOwnAccount("owner@example.com")).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(deleteAuthUser).toHaveBeenCalledWith(USER_ID);
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("still deletes the account when the user owns no organizations", async () => {
    organizationsData = [];

    await expect(deleteOwnAccount("owner@example.com")).rejects.toThrow(
      "NEXT_REDIRECT"
    );

    expect(deleteEq).not.toHaveBeenCalledWith("organizations", "id", ORG_ID);
    expect(deleteAuthUser).toHaveBeenCalledWith(USER_ID);
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("surfaces an error and does not sign out when auth user deletion fails", async () => {
    deleteAuthUser.mockResolvedValue({ error: { message: "boom" } });

    const result = await deleteOwnAccount("owner@example.com");

    expect(result.ok).toBe(false);
    expect(signOut).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
