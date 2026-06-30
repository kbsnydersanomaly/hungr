import Link from "next/link";
import { listHelpCategories, listHelpArticlesAdmin } from "@/lib/data/help-actions";
import { AdminListLayout } from "@/components/admin/AdminListLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { StatusFilter } from "@/components/admin/StatusFilter";
import { AdminArticleActions } from "@/components/help/AdminArticleActions";
import { HelpCategoryManager } from "@/components/help/HelpCategoryManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, ImageIcon } from "lucide-react";

const PUBLISHED_OPTIONS = [
  { value: "true", label: "Published" },
  { value: "false", label: "Draft" },
];

export const dynamic = "force-dynamic";

export default async function AdminHelpPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const [categoriesRes, { data: articles, total, page, pageSize, totalPages }] =
    await Promise.all([listHelpCategories(), listHelpArticlesAdmin(sp)]);

  const categories = categoriesRes.ok ? categoriesRes.data ?? [] : [];
  if (!categoriesRes.ok) {
    console.error("Failed to load help categories:", categoriesRes.message);
  }
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <AdminListLayout
      title="Help Articles"
      total={total}
      searchPlaceholder="Search by title, content or topics..."
      extraFilters={
        <>
          <StatusFilter
            options={PUBLISHED_OPTIONS}
            paramName="published"
            placeholder="Filter by status"
          />
          <StatusFilter
            options={categoryOptions}
            paramName="category"
            placeholder="Filter by category"
          />
        </>
      }
    >
      <div className="flex items-center justify-end gap-2">
        <HelpCategoryManager categories={categories} />
        <Button asChild size="sm" variant="outline">
          <Link href="/admin/help/media">
            <ImageIcon className="h-4 w-4 mr-2" />
            Manage media
          </Link>
        </Button>
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
        <>
          <div className="grid gap-4">
            {articles.map((article) => (
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
                        {article.category_name && (
                          <Badge variant="outline">{article.category_name}</Badge>
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
            ))}
          </div>
          <AdminPagination page={page} pageSize={pageSize} totalPages={totalPages} total={total} />
        </>
      )}
    </AdminListLayout>
  );
}
