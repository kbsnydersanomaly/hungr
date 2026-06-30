"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, X, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  content: string;
  topics: string[];
  category_id: string | null;
  category_name: string | null;
}

interface HelpCategory {
  id: string;
  name: string;
}

function excerpt(content: string, max = 140): string {
  const text = content.trim().replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function HelpBrowser({
  articles,
  categories,
}: {
  articles: HelpArticle[];
  categories: HelpCategory[];
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((article) => {
      if (categoryId !== "all" && article.category_id !== categoryId) return false;
      if (!q) return true;
      return (
        article.title.toLowerCase().includes(q) ||
        article.content.toLowerCase().includes(q) ||
        article.topics.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [articles, search, categoryId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search help articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search help articles"
          />
          {search && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {categories.length > 0 && (
          <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "all")}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LifeBuoy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No help articles match your search.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((article) => (
            <Link key={article.id} href={`/help/${article.slug}`} className="block">
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm">{article.title}</h3>
                    {article.category_name && (
                      <Badge variant="outline" className="shrink-0">
                        {article.category_name}
                      </Badge>
                    )}
                  </div>
                  {article.content && (
                    <p className="text-xs text-muted-foreground">
                      {excerpt(article.content)}
                    </p>
                  )}
                  {article.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {article.topics.map((topic) => (
                        <span key={topic} className="text-xs text-muted-foreground">
                          #{topic}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
