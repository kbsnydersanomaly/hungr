export function slugify(title: string, existing?: string): string {
  if (existing?.trim()) return existing.trim();
  const raw = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return raw || "article";
}
