import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks for server-only dependencies -------------------------------------
// vi.mock factories are hoisted above module init, so the shared mock fns must be
// created via vi.hoisted to exist when the factories run.
const { sendMail, writeAudit, requireOrgAccess, requireRestaurantAccess, createServerClient } =
  vi.hoisted(() => ({
    sendMail: vi.fn(),
    writeAudit: vi.fn(),
    requireOrgAccess: vi.fn(),
    requireRestaurantAccess: vi.fn(),
    createServerClient: vi.fn(),
  }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendMail }));
vi.mock("@/lib/utils/audit", () => ({ writeAudit }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } }));
vi.mock("@/lib/auth/role", () => ({ requireOrgAccess, requireRestaurantAccess }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));

import { inviteMember, resendInvitation } from "@/lib/data/team-actions";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

type Result = { data?: unknown; error?: unknown };

/**
 * Minimal chainable Supabase stub. Non-terminal methods return `this`; the
 * builder is awaitable (for `.update().eq()` / `.insert()` chains) and pops
 * queued results for `.maybeSingle()` / `.single()` in call order. `update` and
 * `insert` record their payloads on `captured` for assertions.
 */
function makeSupabase(singleResults: Result[]) {
  const captured: { update?: Record<string, unknown>; insert?: Record<string, unknown> } = {};
  const queue = [...singleResults];
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    ilike: () => builder,
    is: () => builder,
    update: (payload: Record<string, unknown>) => {
      captured.update = payload;
      return builder;
    },
    insert: (payload: Record<string, unknown>) => {
      captured.insert = payload;
      return builder;
    },
    maybeSingle: () => Promise.resolve(queue.shift() ?? { data: null }),
    single: () => Promise.resolve(queue.shift() ?? { data: null }),
  };
  return { builder, captured };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMail.mockResolvedValue(undefined);
});

describe("inviteMember", () => {
  it("updates an existing invite and reports resent: true", async () => {
    const { builder, captured } = makeSupabase([
      { data: null }, // no existing profile
      { data: { id: "invite-1" } }, // existing pending invite
      { data: { name: "Acme" } }, // org name
    ]);
    requireOrgAccess.mockResolvedValue({
      user: { id: "user-1", email: "admin@acme.test", user_metadata: {} },
      supabase: builder,
    });

    const result = await inviteMember(
      makeFormData({ orgId: ORG_ID, email: "New@Acme.test", role: "staff" })
    );

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ invited: true, resent: true });
    expect(captured.update).toBeDefined();
    expect(captured.insert).toBeUndefined();
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("inserts a new invite and reports resent: false", async () => {
    const { builder, captured } = makeSupabase([
      { data: null }, // no existing profile
      { data: null }, // no existing invite
      { data: { name: "Acme" } }, // org name
    ]);
    requireOrgAccess.mockResolvedValue({
      user: { id: "user-1", email: "admin@acme.test", user_metadata: {} },
      supabase: builder,
    });

    const result = await inviteMember(
      makeFormData({ orgId: ORG_ID, email: "new@acme.test", role: "staff" })
    );

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ invited: true, resent: false });
    expect(captured.insert).toMatchObject({ email: "new@acme.test", role: "staff" });
  });

  it("rejects inviting someone who is already a member", async () => {
    const { builder } = makeSupabase([
      { data: { id: "existing-user" } }, // existing profile
      { data: { role: "staff" } }, // existing membership
    ]);
    requireOrgAccess.mockResolvedValue({
      user: { id: "user-1", email: "admin@acme.test", user_metadata: {} },
      supabase: builder,
    });

    const result = await inviteMember(
      makeFormData({ orgId: ORG_ID, email: "member@acme.test", role: "staff" })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already a member/i);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("resendInvitation", () => {
  it("regenerates token + expiry, clears revoked_at, and re-sends the email", async () => {
    const { builder, captured } = makeSupabase([
      // invitation lookup
      {
        data: {
          email: "invitee@acme.test",
          org_id: ORG_ID,
          restaurant_id: null,
          role: "staff",
          accepted_at: null,
        },
      },
      { data: { name: "Acme" } }, // org name
    ]);
    createServerClient.mockResolvedValue(builder);
    requireOrgAccess.mockResolvedValue({
      user: { id: "user-1", email: "admin@acme.test", user_metadata: {} },
    });

    const result = await resendInvitation("invite-1");

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ resent: true });
    expect(captured.update).toMatchObject({ revoked_at: null });
    expect(captured.update?.token).toEqual(expect.any(String));
    expect(captured.update?.expires_at).toEqual(expect.any(String));
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it("rejects resending an already-accepted invitation", async () => {
    const { builder } = makeSupabase([
      {
        data: {
          email: "invitee@acme.test",
          org_id: ORG_ID,
          restaurant_id: null,
          role: "staff",
          accepted_at: "2026-06-20T00:00:00Z",
        },
      },
    ]);
    createServerClient.mockResolvedValue(builder);

    const result = await resendInvitation("invite-1");

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/already been accepted/i);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
