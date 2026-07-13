import { describe, it, expect, vi, beforeEach } from "vitest";

const { createServerClient, createAdminClient, headers, adminInsert, serverFrom } =
  vi.hoisted(() => ({
    createServerClient: vi.fn(),
    createAdminClient: vi.fn(),
    headers: vi.fn(),
    adminInsert: vi.fn(),
    serverFrom: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("next/headers", () => ({ headers }));

import { writeAudit } from "@/lib/utils/audit";

const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("writeAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: USER_ID } } }) },
      from: serverFrom,
    });
    createAdminClient.mockReturnValue({
      from: () => ({ insert: adminInsert }),
    });
    adminInsert.mockResolvedValue({ error: null });
    headers.mockResolvedValue({
      get: (name: string) =>
        name === "x-forwarded-for" ? "1.2.3.4" : name === "user-agent" ? "vitest" : null,
    });
  });

  it("inserts via the admin client (audit_logs RLS is read-only for users)", async () => {
    await writeAudit({
      action: "restaurant.delete",
      org_id: "org-1",
      target_table: "restaurants",
      target_id: "rest-1",
      diff: { name: "Gone Cafe" },
    });

    expect(createAdminClient).toHaveBeenCalled();
    expect(serverFrom).not.toHaveBeenCalled();
    expect(adminInsert).toHaveBeenCalledWith({
      actor_user_id: USER_ID,
      org_id: "org-1",
      restaurant_id: null,
      action: "restaurant.delete",
      target_table: "restaurants",
      target_id: "rest-1",
      diff: { name: "Gone Cafe" },
      ip: "1.2.3.4",
      user_agent: "vitest",
    });
  });

  it("still resolves the actor from the session client", async () => {
    await writeAudit({ action: "branding.publish" });

    expect(createServerClient).toHaveBeenCalled();
    expect(adminInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_user_id: USER_ID })
    );
  });

  it("never throws when the insert fails", async () => {
    adminInsert.mockRejectedValue(new Error("boom"));

    await expect(writeAudit({ action: "restaurant.delete" })).resolves.toBeUndefined();
  });
});
