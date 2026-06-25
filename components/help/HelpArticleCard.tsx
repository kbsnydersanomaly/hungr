"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HelpArticleWithCategory } from "@/lib/data/help-actions";

interface HelpArticleCardProps {
  article: HelpArticleWithCategory;
}

export function HelpArticleCard({ article }: HelpArticleCardProps) {
  const excerpt =
    article.content.slice(0, 160).replace(/\s+/g, " ") +
    (article.content.length > 160 ? "…" : "");

  return (
    <Link href={`/help/${article.slug}`} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {article.category_name ? (
              <Badge variant="secondary">{article.category_name}</Badge>
            ) : null}
            {article.topics.slice(0, 3).map((topic) => (
              <Badge key={topic} variant="outline">
                {topic}
              </Badge>
            ))}
          </div>

          <h3 className="font-semibold text-sm">{article.title}</h3>
          {excerpt && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
              {excerpt}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
