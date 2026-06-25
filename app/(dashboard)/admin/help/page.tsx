import Link from "next/link";
import { listHelpCategories, listHelpArticles } from "@/lib/data/help-actions";
import { AdminArticleActions } from "@/components/help/AdminArticleActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminHelpPage() {
  const [categoriesRes, articlesRes] = await Promise.all([
    listHelpCategories(),
    listHelpArticles({ publishedOnly: false }),
  ]);

  const categories = categoriesRes.ok ? categoriesRes.data ?? [] : [];
  const articles = articlesRes.ok ? articlesRes.data ?? [] : [];

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold font-heading">Help Articles</h2>
          <p className="text-sm text-muted-foreground">
            Manage public help content.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/help/new">
            <Plus className="h-4 w-4 mr-2" />
            New article
          </Link>
        </Button>
      </div>

      {articles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No help articles yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {articles.map((article) => {
            const category = article.category_id
              ? categoryById.get(article.category_id)
              : null;

            return (
              <Card key={article.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">
                          {article.title}
                        </h3>
                        <Badge
                          variant={article.published ? "default" : "secondary"}
                        >
                          {article.published ? "Published" : "Draft"}
                        </Badge>
                        {category && (
                          <Badge variant="outline">{category.name}</Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        /help/{article.slug}
                      </p>

                      {article.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {article.topics.map((topic) => (
                            <span
                              key={topic}
                              className="text-xs text-muted-foreground"
                            >
                              #{topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <AdminArticleActions article={article} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
