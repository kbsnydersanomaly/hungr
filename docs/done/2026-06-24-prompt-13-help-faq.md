# Prompt 13 — Super-admin editable Help/FAQ section

## Summary
Implemented a searchable, category-based help center with super-admin management.

## Files created

- `supabase/migrations/20260624140000_help_faq_schema.sql`
  - Creates `help_categories` and `help_articles` tables (if not present).
  - Adds an `is_super_admin(uuid)` helper overload for RLS.
  - Enables RLS: public read for published articles and all categories; super admins have full access.
  - Adds required indexes: `help_articles_slug_idx`, `help_articles_category_id_idx`, `help_categories_slug_idx`.

- `lib/data/help-actions.ts`
  - `listHelpCategories()` — public.
  - `listHelpArticles({ categorySlug?, topic?, search?, publishedOnly? })` — public, returns articles with category name.
  - `getHelpArticleBySlug(slug)` — public, respects published unless caller is super admin.
  - `getHelpArticleById(id)` — super admin only.
  - `createHelpArticle(formData)`, `updateHelpArticle(id, formData)`, `deleteHelpArticle(id)`, `toggleHelpArticlePublished(id, published)` — super admin only.
  - Zod validation, topic/screenshot parsing; slug generated via `lib/utils/slugify.ts`.

- `lib/utils/slugify.ts` — shared slugify helper (extracted from server actions so the server-action file only exports async functions).

- `components/help/HelpArticleCard.tsx` — public card with title, category, topics, excerpt.
- `components/help/HelpArticleForm.tsx` — shared new/edit form using `ServerActionForm` and `SubmitButton`.
- `components/help/HelpSearch.tsx` — search + category/topic filter chips for `/help`.
- `components/help/HelpArticleContent.tsx` — simple markdown renderer (headings, lists, links).
- `components/help/AdminArticleActions.tsx` — publish toggle, edit link, delete confirmation dialog.

- `app/help/page.tsx` — public help listing.
- `app/help/[slug]/page.tsx` — public article detail with screenshots and video iframe.
- `app/(dashboard)/admin/help/page.tsx` — admin list with create/edit/delete/toggle.
- `app/(dashboard)/admin/help/new/page.tsx` — create article.
- `app/(dashboard)/admin/help/[id]/page.tsx` — edit article.

- `tests/unit/help-actions.test.ts` — slug generation, validation, super-admin enforcement.
- `tests/components/HelpArticleCard.test.tsx` — card render assertions.

## Files changed

- `app/(dashboard)/admin/layout.tsx` — added "Help" tab to `adminNav`.
- `components/dashboard/TabNav.tsx` — registered `help-circle` icon.
- `lib/database.types.ts` — already contained `help_articles` and `help_categories` definitions from a previous migration, so no manual changes were required.

## Verification

Verification run after implementation:

```bash
npx tsc --noEmit   # passed
pnpm test --run    # 170 passed
pnpm lint          # passed
pnpm build         # passed
```

All checks passed.
