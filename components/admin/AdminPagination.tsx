"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminPaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

export function AdminPagination({
  page,
  pageSize,
  totalPages,
  total,
}: AdminPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    if (key !== "page") params.set("page", "1");
    router.push(`?${params.toString()}`, { scroll: false });
  }

  if (totalPages <= 1 && pageSize === 25) {
    return (
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} total</span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => setParam("pageSize", v ?? "25")}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        {total} total · page {page} of {totalPages}
      </span>

      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(v) => setParam("pageSize", v ?? "25")}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam("page", String(page - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setParam("page", String(page + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
