"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface AdminListLayoutProps {
  title: string;
  total: number;
  children: React.ReactNode;
  searchPlaceholder?: string;
  extraFilters?: React.ReactNode;
}

export function AdminListLayout({
  title,
  total,
  children,
  searchPlaceholder = "Search...",
  extraFilters,
}: AdminListLayoutProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSearch = searchParams.get("search") ?? "";

  function updateSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("search", value.trim());
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold font-heading">{title}</h2>
          <p className="text-sm text-muted-foreground">{total} total</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={searchPlaceholder}
              defaultValue={currentSearch}
              onChange={(e) => updateSearch(e.target.value)}
              className="pl-9 w-[220px]"
            />
          </div>
          {currentSearch && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateSearch("")}
              disabled={isPending}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
          {extraFilters}
        </div>
      </div>

      {children}
    </div>
  );
}
