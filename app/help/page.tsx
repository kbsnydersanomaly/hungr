import { listHelpCategories, listHelpArticles } from "@/lib/data/help-actions";
import { HelpSearch } from "@/components/help/HelpSearch";
import { HelpArticleCard } from "@/components/help/HelpArticleCard";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const search = typeof sp.search === "string" ? sp.search : undefined;
  const categorySlug =
    typeof sp.category === "string" ? sp.category : undefined;
  const topic = typeof sp.topic === "string" ? sp.topic : undefined;

  const [categoriesRes, articlesRes] = await Promise.all([
    listHelpCategories(),
    listHelpArticles({
      search,
      categorySlug,
      topic,
      publishedOnly: true,
    }),
  ]);

  const categories = categoriesRes.ok ? categoriesRes.data ?? [] : [];
  const articles = articlesRes.ok ? articlesRes.data ?? [] : [];

  const allTopics = Array.from(
    new Set(articles.flatMap((article) => article.topics))
  ).sort();

  return (
    <div className="container max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold font-heading">Help Center</h1>
        <p className="text-muted-foreground">
          Search our help articles or browse by category and topic.
        </p>
      </div>

      <HelpSearch
        categories={categories}
        topics={allTopics}
        search={search}
        categorySlug={categorySlug}
        topic={topic}
      />

      {articles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No articles match your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {articles.map((article) => (
            <HelpArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
