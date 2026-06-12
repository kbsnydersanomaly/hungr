export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function ensureUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  let slug = slugify(base);
  if (!slug) slug = "restaurant";

  if (!(await exists(slug))) return slug;

  let counter = 2;
  while (await exists(`${slug}-${counter}`)) {
    counter++;
  }
  return `${slug}-${counter}`;
}
