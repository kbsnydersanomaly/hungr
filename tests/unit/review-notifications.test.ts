import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted, so shared mock fns must be created via vi.hoisted.
const { sendMail, captureException, createServerClient, createAdminClient } = vi.hoisted(
  () => ({
    sendMail: vi.fn(),
    captureException: vi.fn(),
    createServerClient: vi.fn(),
    createAdminClient: vi.fn(),
  })
);

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/mail", () => ({ sendMail }));
vi.mock("@sentry/nextjs", () => ({ captureException }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } }));

import { submitReviewAction } from "@/lib/data/review-actions";

const RESTAURANT_ID = "22222222-2222-4222-8222-222222222222";
const REVIEW_INPUT = {
  menu_item_id: "33333333-3333-4333-8333-333333333333",
  restaurant_id: RESTAURANT_ID,
  customer_name: "Jane Doe",
  message: "Great food, friendly staff.",
  rating: 4,
};

type TableResult = { data: unknown; error?: unknown };

/**
 * Table-aware admin-client stub: `from(table)` returns a chainable builder that
 * resolves to the configured result for that table (and `.single()` for lookups).
 * `reviews` is the pre-insert dedup check (select/eq/gte/limit chain); the rest
 * are notification lookups.
 */
function makeAdmin(tables: {
  reviews?: TableResult;
  menu_items?: TableResult;
  restaurants?: TableResult;
  organization_members?: TableResult;
  restaurant_members?: TableResult;
  profiles?: TableResult;
}) {
  const builders: Record<string, Record<string, unknown>> = {};
  for (const table of [
    "reviews",
    "menu_items",
    "restaurants",
    "organization_members",
    "restaurant_members",
    "profiles",
  ]) {
    const result: TableResult = (tables as Record<string, TableResult>)[table] ?? {
      // menu_items is the pre-insert ownership check — default to "item found".
      data:
        table === "restaurants" ? null : table === "menu_items" ? { id: "item-1" } : [],
      error: null,
    };
    const resolved = { data: result.data, error: result.error ?? null };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      gte: () => builder,
      limit: () => builder,
      single: () => Promise.resolve(resolved),
      maybeSingle: () => Promise.resolve(resolved),
      then: (resolve: (v: unknown) => void) => resolve(resolved),
    };
    builders[table] = builder;
  }
  return { from: (table: string) => builders[table] };
}

function makeServerClient() {
  const builder: Record<string, unknown> = {
    insert: () => Promise.resolve({ error: null }),
  };
  return { from: () => builder };
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMail.mockResolvedValue(undefined);
  createServerClient.mockResolvedValue(makeServerClient());
});

describe("submitReviewAction review notifications", () => {
  it("sends one email per opted-in manager (org + restaurant)", async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        restaurants: { data: { name: "The Hungry Fox", org_id: "org-1" } },
        organization_members: { data: [{ user_id: "owner-1" }, { user_id: "staff-1" }] },
        restaurant_members: { data: [{ user_id: "mgr-1" }] },
        profiles: {
          data: [
            { email: "owner@fox.test", notification_prefs: { review_emails: true } },
            { email: "mgr@fox.test", notification_prefs: { review_emails: true } },
          ],
        },
      })
    );

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenCalledWith(
      "review-pending",
      "owner@fox.test",
      expect.objectContaining({
        restaurant_name: "The Hungry Fox",
        rating: 4,
        reviewer_name: "Jane Doe",
        message_excerpt: "Great food, friendly staff.",
        reviews_url: `http://localhost:3000/restaurants/${RESTAURANT_ID}/reviews`,
      })
    );
    expect(sendMail).toHaveBeenCalledWith("review-pending", "mgr@fox.test", expect.anything());
  });

  it("skips users who opted out of review emails", async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        restaurants: { data: { name: "The Hungry Fox", org_id: "org-1" } },
        organization_members: { data: [{ user_id: "owner-1" }, { user_id: "owner-2" }] },
        profiles: {
          data: [
            { email: "in@fox.test", notification_prefs: { review_emails: true } },
            { email: "out@fox.test", notification_prefs: { review_emails: false } },
          ],
        },
      })
    );

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith("review-pending", "in@fox.test", expect.anything());
  });

  it("defaults to opt-in when notification_prefs are missing", async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        restaurants: { data: { name: "The Hungry Fox", org_id: "org-1" } },
        organization_members: { data: [{ user_id: "owner-1" }] },
        profiles: { data: [{ email: "noprefs@fox.test", notification_prefs: null }] },
      })
    );

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(sendMail).toHaveBeenCalledWith("review-pending", "noprefs@fox.test", expect.anything());
  });

  it("still returns success when the mail send throws", async () => {
    sendMail.mockRejectedValue(new Error("RESEND_API_KEY invalid"));
    createAdminClient.mockReturnValue(
      makeAdmin({
        restaurants: { data: { name: "The Hungry Fox", org_id: "org-1" } },
        organization_members: { data: [{ user_id: "owner-1" }] },
        profiles: {
          data: [{ email: "owner@fox.test", notification_prefs: { review_emails: true } }],
        },
      })
    );

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ submitted: true });
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("sends only one email when a user is both an org member and restaurant manager", async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        restaurants: { data: { name: "The Hungry Fox", org_id: "org-1" } },
        organization_members: { data: [{ user_id: "mgr-1" }] },
        restaurant_members: { data: [{ user_id: "mgr-1" }] },
        profiles: {
          data: [{ email: "mgr@fox.test", notification_prefs: { review_emails: true } }],
        },
      })
    );

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith("review-pending", "mgr@fox.test", expect.anything());
  });

  it("returns success without sending when the restaurant lookup fails", async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        restaurants: { data: null, error: { message: "connection reset" } },
      })
    );

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("returns success without sending when the profile lookup fails", async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        restaurants: { data: { name: "The Hungry Fox", org_id: "org-1" } },
        organization_members: { data: [{ user_id: "owner-1" }] },
        profiles: { data: null, error: { message: "permission denied" } },
      })
    );

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("captures a membership lookup error but still emails members from the other source", async () => {
    createAdminClient.mockReturnValue(
      makeAdmin({
        restaurants: { data: { name: "The Hungry Fox", org_id: "org-1" } },
        organization_members: { data: null, error: { message: "timeout" } },
        restaurant_members: { data: [{ user_id: "mgr-1" }] },
        profiles: {
          data: [{ email: "mgr@fox.test", notification_prefs: { review_emails: true } }],
        },
      })
    );

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(captureException).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith("review-pending", "mgr@fox.test", expect.anything());
  });
});
