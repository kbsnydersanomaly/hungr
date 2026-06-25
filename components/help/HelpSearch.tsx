"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import type { Database } from "@/lib/database.types";

type HelpCategoryRow = Database["public"]["Tables"]["help_categories"]["Row"];

interface HelpSearchProps {
  categories: HelpCategoryRow[];
  topics: string[];
  search?: string;
  categorySlug?: string;
  topic?: string;
}

function buildQueryString(
  params: URLSearchParams,
  changes: Record<string, string | undefined>
) {
  const next = new URLSearchParams(params.toString());
  for (const [key, value] of Object.entries(changes)) {
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

export function HelpSearch({
  categories,
  topics,
  search = "",
  categorySlug = "",
  topic = "",
}: HelpSearchProps) {
  const router = useRouter();
  const params = useSearchParams();

  function update(changes: Record<string, string | undefined>) {
    router.push(`/help${buildQueryString(params, changes)}`);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search help articles…"
          defaultValue={search}
          onChange={(e) => update({ search: e.target.value })}
          className="pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => update({ search: undefined })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={categorySlug === "" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => update({ category: undefined })}
        >
          All categories
        </Badge>
        {categories.map((category) => (
          <Badge
            key={category.id}
            variant={categorySlug === category.slug ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => update({ category: category.slug })}
          >
            {category.name}
          </Badge>
        ))}
      </div>

      {topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={topic === "" ? "secondary" : "ghost"}
            className="cursor-pointer"
            onClick={() => update({ topic: undefined })}
          >
            All topics
          </Badge>
          {topics.map((t) => (
            <Badge
              key={t}
              variant={topic === t ? "secondary" : "ghost"}
              className="cursor-pointer"
              onClick={() => update({ topic: t })}
            >
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
