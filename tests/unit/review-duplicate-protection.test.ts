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
 * Server-client stub where the dedup select resolves to `dedupResult` and
 * `insert` records how many times it ran. Awaiting the select chain resolves
 * via `then`; `insert` returns its own promise, so one builder serves both.
 */
function makeServerClient(dedupResult: { data: unknown; error?: unknown } = { data: [] }) {
  const dedupQuery: DedupQuery = { eq: [], gte: [] };
  let insertCount = 0;
  const resolved = { data: dedupResult.data, error: dedupResult.error ?? null };
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      dedupQuery.eq.push([col, val]);
      return builder;
    },
    gte: (col: string, val: unknown) => {
      dedupQuery.gte.push([col, val]);
      return builder;
    },
    limit: () => builder,
    insert: () => {
      insertCount++;
      return Promise.resolve({ error: null });
    },
    then: (resolve: (v: unknown) => void) => resolve(resolved),
  };
  return { client: { from: () => builder }, dedupQuery, getInsertCount: () => insertCount };
}

beforeEach(() => {
  vi.clearAllMocks();
  sendMail.mockResolvedValue(undefined);
});

describe("submitReviewAction duplicate protection", () => {
  it("returns success without inserting when an identical review exists in the last 10 minutes", async () => {
    const stub = makeServerClient({ data: [{ id: "rev-existing" }] });
    createServerClient.mockResolvedValue(stub.client);

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ submitted: true });
    expect(stub.getInsertCount()).toBe(0);
    // A deduped replay must not re-notify managers.
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("fires the submit action twice with identical payloads and yields one insert, two successes", async () => {
    // Simulate a real table: the first insert lands, the second submission's
    // dedup select then sees the row.
    const stored: Array<{ id: string }> = [];
    const dedupQuery: DedupQuery = { eq: [], gte: [] };
    let insertCount = 0;
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        dedupQuery.eq.push([col, val]);
        return builder;
      },
      gte: () => builder,
      limit: () => builder,
      insert: () => {
        insertCount++;
        stored.push({ id: `rev-${insertCount}` });
        return Promise.resolve({ error: null });
      },
      then: (resolve: (v: unknown) => void) => resolve({ data: stored, error: null }),
    };
    createServerClient.mockResolvedValue({ from: () => builder });
    // The first submission proceeds past the insert into notification lookups;
    // a null restaurant ends notification quietly.
    createAdminClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) });

    const first = await submitReviewAction(REVIEW_INPUT);
    const second = await submitReviewAction(REVIEW_INPUT);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(insertCount).toBe(1);
  });

  it("inserts when no matching review exists (different visit / outside the window)", async () => {
    const stub = makeServerClient({ data: [] });
    createServerClient.mockResolvedValue(stub.client);
    createAdminClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) });

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(stub.getInsertCount()).toBe(1);
  });

  it("scopes the dedup check to item + name + message within the last 10 minutes (not rating)", async () => {
    const before = Date.now();
    const stub = makeServerClient({ data: [] });
    createServerClient.mockResolvedValue(stub.client);
    createAdminClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) });

    await submitReviewAction(REVIEW_INPUT);
    const after = Date.now();

    expect(stub.dedupQuery.eq).toEqual([
      ["menu_item_id", REVIEW_INPUT.menu_item_id],
      ["customer_name", REVIEW_INPUT.customer_name],
      ["message", REVIEW_INPUT.message],
    ]);
    const gte = stub.dedupQuery.gte.find(([col]) => col === "created_at");
    expect(gte).toBeDefined();
    const since = Date.parse(gte![1] as string);
    expect(since).toBeGreaterThanOrEqual(before - 10 * 60 * 1000);
    expect(since).toBeLessThanOrEqual(after - 10 * 60 * 1000 + 1000);
  });

  it("fails open and still inserts when the dedup check itself errors", async () => {
    const stub = makeServerClient({ data: null, error: { message: "connection reset" } });
    createServerClient.mockResolvedValue(stub.client);
    createAdminClient.mockReturnValue({ from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) });

    const result = await submitReviewAction(REVIEW_INPUT);

    expect(result.ok).toBe(true);
    expect(stub.getInsertCount()).toBe(1);
    expect(captureException).toHaveBeenCalled();
  });
});
