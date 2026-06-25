export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export function parsePaginationParams(
  sp: Record<string, string | string[] | undefined>
): PaginationOptions {
  const rawPage = Number(sp?.page);
  const rawPageSize = Number(sp?.pageSize);
  return {
    page: Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage,
    pageSize: Number.isNaN(rawPageSize)
      ? 25
      : Math.min(100, Math.max(1, rawPageSize)),
  };
}
