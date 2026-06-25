import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireSuperAdmin, isSuperAdmin, createServerClient } = vi.hoisted(
  () => ({
    requireSuperAdmin: vi.fn(),
    isSuperAdmin: vi.fn(),
    createServerClient: vi.fn(),
  })
);

vi.mock("@/lib/auth/role", () => ({ requireSuperAdmin, isSuperAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient }));

import { ForbiddenError } from "@/lib/errors";
import { slugify } from "@/lib/utils/slugify";
import {
  createHelpArticle,
  listHelpArticles,
} from "@/lib/data/help-actions";

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

type Result = { data?: unknown; error?: unknown; count?: number };

function makeSupabase(singleResults: Result[] = [], opts: { count?: number } = {}) {
  const captured: {
    insert?: Record<string, unknown>;
    update?: Record<string, unknown>;
    delete?: boolean;
  } = {};
  const queue = [...singleResults];
  const builder: Record<string, unknown> = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    ilike: () => builder,
    contains: () => builder,
    or: () => builder,
    order: () => builder,
    count: opts.count ?? null,
    insert: (payload: Record<string, unknown>) => {
      captured.insert = payload;
      return builder;
    },
    update: (payload: Record<string, unknown>) => {
      captured.update = payload;
      return builder;
    },
    delete: () => {
      captured.delete = true;
      return builder;
    },
    maybeSingle: () => Promise.resolve(queue.shift() ?? { data: null }),
    single: () => Promise.resolve(queue.shift() ?? { data: null }),
    then: (resolve: (value: unknown) => void) => {
      resolve(queue.shift() ?? { data: null });
    },
  };
  return { builder, captured };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("slugify", () => {
  it("generates a kebab-case slug from a title", () => {
    expect(slugify("How to Manage Menus")).toBe("how-to-manage-menus");
  });

  it("returns the provided slug when one is given", () => {
    expect(slugify("Any Title", "custom-slug")).toBe("custom-slug");
  });

  it("lowercases and strips non-alphanumeric characters", () => {
    expect(slugify("Billing & Payments!!!")).toBe("billing-payments");
  });

  it("falls back to 'article' when the slug would be empty", () => {
    expect(slugify("!!!")).toBe("article");
  });
});

describe("createHelpArticle", () => {
  it("creates an article and auto-generates a slug from the title", async () => {
    const { builder, captured } = makeSupabase(
      [
        { data: null, count: 0, error: null }, // uniqueness check: no existing slug
        { data: { id: "article-1" }, error: null }, // inserted row
      ],
      { count: 0 }
    );
    requireSuperAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      supabase: builder,
    });

    const result = await createHelpArticle(
      makeFormData({
        title: "Getting Started",
        slug: "",
        topics: " onboarding,  basics ",
        content: "Welcome!",
        screenshots: "",
        video_url: "",
      })
    );

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ id: "article-1" });
    expect(captured.insert).toMatchObject({
      title: "Getting Started",
      slug: "getting-started",
      topics: ["onboarding", "basics"],
      content: "Welcome!",
      published: false,
    });
  });

  it("returns a validation error when the title is missing", async () => {
    const { builder } = makeSupabase();
    requireSuperAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      supabase: builder,
    });

    const result = await createHelpArticle(makeFormData({ title: "" }));

    expect(result.ok).toBe(false);
    expect(result.code).toBe("validation");
  });

  it("rejects non-super-admins with a forbidden error", async () => {
    requireSuperAdmin.mockRejectedValue(new ForbiddenError());

    const result = await createHelpArticle(
      makeFormData({ title: "Secret article" })
    );

    expect(result.ok).toBe(false);
    expect(result.code).toBe("forbidden");
  });
});

describe("listHelpArticles", () => {
  it("returns published articles for public visitors", async () => {
    isSuperAdmin.mockResolvedValue(false);
    const { builder } = makeSupabase([
      {
        data: [
          {
            id: "a1",
            title: "Public article",
            slug: "public-article",
            published: true,
            content: "",
            topics: [],
            screenshots: [],
            video_url: null,
            category_id: null,
            created_at: "2026-06-24T00:00:00Z",
            updated_at: "2026-06-24T00:00:00Z",
            help_categories: null,
          },
        ],
      },
    ]);
    createServerClient.mockResolvedValue({
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: () => builder,
    });

    const result = await listHelpArticles();

    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].slug).toBe("public-article");
  });
});
