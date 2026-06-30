import { listHelpArticles, listHelpCategories } from "@/lib/data/help-actions";
import { PageHeader } from "@/components/PageHeader";
import { HelpBrowser } from "@/components/help/HelpBrowser";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const [articlesRes, categoriesRes] = await Promise.all([
    listHelpArticles({ publishedOnly: true }),
    listHelpCategories(),
  ]);

  const articles = articlesRes.ok ? articlesRes.data ?? [] : [];
  const categories = categoriesRes.ok ? categoriesRes.data ?? [] : [];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Help & FAQ"
        description="Guides and answers for getting the most out of Hungr"
      />
      <HelpBrowser
        articles={articles.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          content: a.content,
          topics: a.topics,
          category_id: a.category_id,
          category_name: a.category_name,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
