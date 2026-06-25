"use server";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { requireSuperAdmin, isSuperAdmin } from "@/lib/auth/role";
import { safeAction, ValidationError, NotFoundError } from "@/lib/errors";
import { slugify } from "@/lib/utils/slugify";
import type { Database } from "@/lib/database.types";
import {
  paginatedQuery,
  parsePaginationParams,
  type PaginationResult,
} from "@/lib/data/admin-pagination";
import type { PostgrestFilterBuilder } from "@supabase/supabase-js";

type HelpArticleRow = Database["public"]["Tables"]["help_articles"]["Row"];
type HelpCategoryRow = Database["public"]["Tables"]["help_categories"]["Row"];

export type HelpArticleWithCategory = HelpArticleRow & {
  category_name: string | null;
};

function splitListInput(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const articleFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: z.string().max(200),
  category_id: z.string().uuid().nullable().optional(),
  topics: z.array(z.string()).default([]),
  content: z.string().default(""),
  screenshots: z.array(z.string().url()).default([]),
  video_url: z.string().url().nullable().optional(),
  published: z.boolean().default(false),
});

function parseArticleForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "").trim() || null;
  const topics = splitListInput(String(formData.get("topics") ?? "")).map((t) =>
    t.toLowerCase()
  );
  const content = String(formData.get("content") ?? "").trim();
  const screenshots = splitListInput(String(formData.get("screenshots") ?? ""));
  const videoUrl = String(formData.get("video_url") ?? "").trim() || null;
  const published = String(formData.get("published")) === "on";

  const slug = slugify(title, slugInput);

  const parsed = articleFormSchema.safeParse({
    title,
    slug,
    category_id: categoryId,
    topics,
    content,
    screenshots,
    video_url: videoUrl,
    published,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ValidationError(issue?.message ?? "Invalid article data.");
  }

  return parsed.data;
}

function mapArticleWithCategory(
  row: HelpArticleRow & { help_categories: { name: string } | null }
): HelpArticleWithCategory {
  const { help_categories, ...rest } = row;
  return {
    ...rest,
    category_name: help_categories?.name ?? null,
  };
}

export async function listHelpCategories() {
  return safeAction(async () => {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("help_categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("listHelpCategories error:", error);
      throw new ValidationError("Failed to load help categories.");
    }

    return (data ?? []) as HelpCategoryRow[];
  });
}

export async function listHelpArticles(filters?: {
  categorySlug?: string;
  topic?: string;
  search?: string;
  publishedOnly?: boolean;
}) {
  return safeAction(async () => {
    const {
      categorySlug,
      topic,
      search,
      publishedOnly = true,
    } = filters ?? {};

    const supabase = await createServerClient();
    let query = supabase
      .from("help_articles")
      .select("*, help_categories(name)")
      .order("created_at", { ascending: false });

    if (publishedOnly) {
      query = query.eq("published", true);
    }

    if (categorySlug) {
      query = query.eq("help_categories.slug", categorySlug);
    }

    if (topic) {
      query = query.contains("topics", [topic.toLowerCase()]);
    }

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,topics.cs.{${q}}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("listHelpArticles error:", error);
      throw new ValidationError("Failed to load help articles.");
    }

    return ((data ?? []) as HelpArticleRow[]).map((row) =>
      mapArticleWithCategory(row as HelpArticleRow & { help_categories: { name: string } | null })
    );
  });
}

export async function listHelpArticlesAdmin(
  searchParams: { [key: string]: string | string[] | undefined }
): Promise<PaginationResult<HelpArticleWithCategory>> {
  const { supabase } = await requireSuperAdmin();
  const { page, pageSize } = parsePaginationParams(searchParams);
  const search = typeof searchParams?.search === "string" ? searchParams.search : undefined;
  const published = typeof searchParams?.published === "string" ? searchParams.published : undefined;
  const category = typeof searchParams?.category === "string" ? searchParams.category : undefined;

  let query = supabase
    .from("help_articles")
    .select("*, help_categories(name)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (published === "true") {
    query = query.eq("published", true);
  } else if (published === "false") {
    query = query.eq("published", false);
  }

  if (category) {
    query = query.eq("category_id", category);
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,topics.cs.{${q}}`);
  }

  const typedQuery = query as unknown as PostgrestFilterBuilder<
    never,
    never,
    HelpArticleRow & { help_categories: { name: string } | null },
    (HelpArticleRow & { help_categories: { name: string } | null })[],
    unknown
  >;

  const result = await paginatedQuery(typedQuery, { page, pageSize });

  return {
    ...result,
    data: result.data.map((row) => mapArticleWithCategory(row)),
  };
}

export async function getHelpArticleBySlug(slug: string) {
  return safeAction(async () => {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isAdmin = user ? await isSuperAdmin(user.id) : false;

    let query = supabase
      .from("help_articles")
      .select("*, help_categories(name)")
      .eq("slug", slug);

    if (!isAdmin) {
      query = query.eq("published", true);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      console.error("getHelpArticleBySlug error:", error);
      throw new NotFoundError("Article not found.");
    }

    return mapArticleWithCategory(data as HelpArticleRow & { help_categories: { name: string } | null });
  });
}

export async function getHelpArticleById(id: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { data, error } = await supabase
      .from("help_articles")
      .select("*, help_categories(name)")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("getHelpArticleById error:", error);
      throw new NotFoundError("Article not found.");
    }

    return mapArticleWithCategory(data as HelpArticleRow & { help_categories: { name: string } | null });
  });
}

async function ensureUniqueSlug(
  supabase: SupabaseClient<Database>,
  slug: string,
  excludeId?: string
) {
  let candidate = slug;
  let attempt = 0;
  while (attempt < 10) {
    let query = supabase.from("help_articles").select("id", { count: "exact", head: true }).eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { count } = await query;
    if (!count) return candidate;
    attempt++;
    candidate = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return candidate;
}

export async function createHelpArticle(formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();
    const fields = parseArticleForm(formData);

    const slug = await ensureUniqueSlug(supabase, fields.slug);

    const { data, error } = await supabase
      .from("help_articles")
      .insert({
        title: fields.title,
        slug,
        category_id: fields.category_id ?? null,
        topics: fields.topics,
        content: fields.content,
        screenshots: fields.screenshots,
        video_url: fields.video_url ?? null,
        published: fields.published,
      })
      .select("id")
      .single();

    if (error) {
      console.error("createHelpArticle error:", error);
      throw new ValidationError("Failed to create article.");
    }

    return { id: data?.id };
  });
}

export async function updateHelpArticle(id: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();
    const fields = parseArticleForm(formData);

    const slug = await ensureUniqueSlug(supabase, fields.slug, id);

    const { error } = await supabase
      .from("help_articles")
      .update({
        title: fields.title,
        slug,
        category_id: fields.category_id ?? null,
        topics: fields.topics,
        content: fields.content,
        screenshots: fields.screenshots,
        video_url: fields.video_url ?? null,
        published: fields.published,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("updateHelpArticle error:", error);
      throw new ValidationError("Failed to update article.");
    }

    return { updated: true };
  });
}

export async function deleteHelpArticle(id: string) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase.from("help_articles").delete().eq("id", id);

    if (error) {
      console.error("deleteHelpArticle error:", error);
      throw new ValidationError("Failed to delete article.");
    }

    return { deleted: true };
  });
}

export async function toggleHelpArticlePublished(id: string, published: boolean) {
  return safeAction(async () => {
    const { supabase } = await requireSuperAdmin();

    const { error } = await supabase
      .from("help_articles")
      .update({ published, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("toggleHelpArticlePublished error:", error);
      throw new ValidationError("Failed to update article.");
    }

    return { updated: true };
  });
}
