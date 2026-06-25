"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import type { PaginationOptions } from "@/lib/utils/pagination";

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface RangeQuery<T> {
  range(from: number, to: number): PromiseLike<{
    data: T[] | null;
    error: PostgrestError | null;
    count: number | null;
  }>;
}

export async function paginatedQuery<T extends Record<string, unknown>>(
  query: RangeQuery<T>,
  opts: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("paginatedQuery error:", error);
    throw new Error("Failed to load data.", { cause: error });
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data: data ?? [],
    total,
    page,
    pageSize,
    totalPages,
  };
}
