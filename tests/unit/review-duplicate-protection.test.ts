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

const REVIEW_INPUT = {
  menu_item_id: "33333333-3333-4333-8333-333333333333",
  restaurant_id: "22222222-2222-4222-8222-222222222222",
  customer_name: "Jane Doe",
  message: "Great food, friendly staff.",
  rating: 4,
};

interface DedupQuery {
  eq: Array<[string, unknown]>;
  gte: Array<[string, unknown]>;
}

/**
 * The dedup existence check runs on the ADMIN client (anon RLS only sees
 * approved reviews, so a request-scoped client would never see fresh pending
 * rows). The insert stays on the request-scoped server client.
 *
 * This stub wires both: `createServerClient` resolves to an insert-counting
 * client, `createAdminClient` returns a table dispatcher where `reviews` is
 * the dedup chain (awaitable via `then`, resolving to `dedupResult`) and any
 * other table answers the notification lookups with a null restaurant so the
 * notify block ends quietly.
 */
function makeClients(dedupResult: { data: unknown; error?: unknown } = { data: [] }) {
  const dedupQuery: DedupQuery = { eq: [], gte: [] };
  const tablesQueried: string[] = [];
  let insertCount = 0;

  const dedupBuilder: Record<string, unknown> = {
    select: () => dedupBuilder,
    eq: (col: string, val: unknown) => {
      dedupQuery.eq.push([col, val]);
      return dedupBuilder;
    },
    gte: (col: string, val: unknown) => {
      dedupQuery.gte.push([col, val]);
      return dedupBuilder;
    },
    limit: () => dedupBuilder,
    then: (resolve: (v: unknown) => void) =>
      resolve({ data: dedupResult.data, error: dedupResult.error ?? null }),
  };

  // Notification lookups: `.from(t).select(...).eq(...).single()` → null row.
  const lookupBuilder: Record<string, unknown> = {
    select: () => lookupBuilder,
    eq: () => lookupBuilder,
    in: () => lookupBuilder,
    single: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
  };

  const admin = {
    from: (table: string) => {
      tablesQueried.push(table);
      return table === "reviews" ? dedupBuilder : lookupBuilder;
    },
  };
  const server = {
    from: () => ({
      insert: () => {
        insertCount++;
        return Promise.resolve({ error: null });
      },
    }),
  };

  return { admin, server, dedupQuery, tablesQueried, getInsertCount: () => insertCount };
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMail.mockResolvedValue(undefined);
});

describe("submitReviewAction duplicate protection", () => {
  it("runs the dedup existence check on the admin client (anon RLS hides pending reviews)", async () => {
    const stub = makeClients({ data: [] });
    createServerClient.mockResolvedValue(stub.server);
    createAdminClient.mockReturnValue(stub.admin);

    await submitReviewAction(REVIEW_INPUT);

    expect(createAdminClient).toHaveBeenCalled();
    expect(stub.tablesQueried[0]).toBe("reviews");
  });

  it("returns success without inserting when an identical review exists in the last 10 minutes", async () => {
    const stub = makeClients({ data: [{ id: "rev-existing" }] });
    createServerClient.mockResolvedValue(stub.server);
    createAdminClient.mockReturnValue(stub.admin);

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ submitted: true });
    expect(stub.getInsertCount()).toBe(0);
    // A deduped replay must not re-notify managers.
    expect(stub.tablesQueried).toEqual(["reviews"]);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("fires the submit action twice with identical payloads and yields one insert, two successes", async () => {
    // Simulate a real table: the first insert lands, the second submission's
    // dedup select then sees the row.
    const stored: Array<{ id: string }> = [];
    const dedupBuilder: Record<string, unknown> = {
      select: () => dedupBuilder,
      eq: () => dedupBuilder,
      gte: () => dedupBuilder,
      limit: () => dedupBuilder,
      then: (resolve: (v: unknown) => void) => resolve({ data: stored, error: null }),
    };
    const lookupBuilder: Record<string, unknown> = {
      select: () => lookupBuilder,
      eq: () => lookupBuilder,
      in: () => lookupBuilder,
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    };
    let insertCount = 0;
    createAdminClient.mockReturnValue({
      from: (table: string) => (table === "reviews" ? dedupBuilder : lookupBuilder),
    });
    createServerClient.mockResolvedValue({
      from: () => ({
        insert: () => {
          insertCount++;
          stored.push({ id: `rev-${insertCount}` });
          return Promise.resolve({ error: null });
        },
      }),
    });

    const first = await submitReviewAction(REVIEW_INPUT);
    const second = await submitReviewAction(REVIEW_INPUT);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(insertCount).toBe(1);
  });

  it("inserts a same-text resubmission with a different rating (correction is not deduped)", async () => {
    // With rating in the dedup scope, the DB finds no match for a changed
    // rating, so the corrected review must be inserted.
    const stub = makeClients({ data: [] });
    createServerClient.mockResolvedValue(stub.server);
    createAdminClient.mockReturnValue(stub.admin);

    const result = await submitReviewAction({ ...REVIEW_INPUT, rating: 5 });

    expect(result.ok).toBe(true);
    expect(stub.getInsertCount()).toBe(1);
  });

  it("scopes the dedup check to item + name + message + rating within the last 10 minutes", async () => {
    const before = Date.now();
    const stub = makeClients({ data: [] });
    createServerClient.mockResolvedValue(stub.server);
    createAdminClient.mockReturnValue(stub.admin);

    await submitReviewAction(REVIEW_INPUT);
    const after = Date.now();

    expect(stub.dedupQuery.eq).toEqual([
      ["menu_item_id", REVIEW_INPUT.menu_item_id],
      ["customer_name", REVIEW_INPUT.customer_name],
      ["message", REVIEW_INPUT.message],
      ["rating", REVIEW_INPUT.rating],
    ]);
    const gte = stub.dedupQuery.gte.find(([col]) => col === "created_at");
    expect(gte).toBeDefined();
    const since = Date.parse(gte![1] as string);
    expect(since).toBeGreaterThanOrEqual(before - 10 * 60 * 1000);
    expect(since).toBeLessThanOrEqual(after - 10 * 60 * 1000 + 1000);
  });

  it("fails open and still inserts when the dedup check itself errors", async () => {
    const stub = makeClients({ data: null, error: { message: "connection reset" } });
    createServerClient.mockResolvedValue(stub.server);
    createAdminClient.mockReturnValue(stub.admin);

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(stub.getInsertCount()).toBe(1);
    expect(captureException).toHaveBeenCalled();
  });
});
