import { notFound, redirect } from "next/navigation";
import {
  listHelpCategories,
  getHelpArticleById,
  updateHelpArticle,
} from "@/lib/data/help-actions";
import { HelpArticleForm } from "@/components/help/HelpArticleForm";
import type { ActionResult } from "@/lib/errors";

export const dynamic = "force-dynamic";

interface EditHelpArticlePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditHelpArticlePage({
  params,
}: EditHelpArticlePageProps) {
  const { id } = await params;
  const [categoriesRes, articleRes] = await Promise.all([
    listHelpCategories(),
    getHelpArticleById(id),
  ]);

  if (!articleRes.ok || !articleRes.data) {
    notFound();
  }

  const categories = categoriesRes.ok ? categoriesRes.data ?? [] : [];
  const article = articleRes.data;

  async function updateAction(formData: FormData): Promise<ActionResult<unknown>> {
    "use server";
    const result = await updateHelpArticle(id, formData);
    if (result.ok) {
      redirect("/admin/help");
    }
    return result;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold font-heading">Edit help article</h2>
        <p className="text-sm text-muted-foreground">
          Update this help article and its settings.
        </p>
      </div>

      <HelpArticleForm
        categories={categories}
        article={article}
        action={updateAction}
        submitLabel="Save changes"
      />
    </div>
  );
}
