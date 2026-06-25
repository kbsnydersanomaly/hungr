import { redirect } from "next/navigation";
import { listHelpCategories, createHelpArticle } from "@/lib/data/help-actions";
import { HelpArticleForm } from "@/components/help/HelpArticleForm";
import type { ActionResult } from "@/lib/errors";

export const dynamic = "force-dynamic";

export default async function NewHelpArticlePage() {
  const categoriesRes = await listHelpCategories();
  const categories = categoriesRes.ok ? categoriesRes.data ?? [] : [];

  async function createAction(formData: FormData): Promise<ActionResult<unknown>> {
    "use server";
    const result = await createHelpArticle(formData);
    if (result.ok) {
      redirect("/admin/help");
    }
    return result;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-semibold font-heading">New help article</h2>
        <p className="text-sm text-muted-foreground">
          Create a new help article for the public help center.
        </p>
      </div>

      <HelpArticleForm
        categories={categories}
        action={createAction}
        submitLabel="Create article"
      />
    </div>
  );
}
