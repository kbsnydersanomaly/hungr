"use server";

import type { PostgrestFilterBuilder } from "@supabase/supabase-js";

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export async function paginatedQuery<T extends Record<string, unknown>>(
  query: PostgrestFilterBuilder<any, any, T, any, any>,
  opts: PaginationOptions = {}
): Promise<PaginationResult<T>> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query.range(from, to).limit(pageSize);

  if (error) {
    console.error("paginatedQuery error:", error);
    throw new Error("Failed to load data.");
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    data: (data ?? []) as T[],
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function parsePaginationParams(
  sp: Record<string, string | string[] | undefined>
) {
  const rawPage = Number(sp?.page);
  const rawPageSize = Number(sp?.pageSize);
  return {
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
    pageSize: Number.isNaN(rawPageSize) ? 25 : Math.min(100, rawPageSize),
  };
}
