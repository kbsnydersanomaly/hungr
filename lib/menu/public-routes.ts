type PublishedMenu = {
  slug: string;
  is_default?: boolean | null;
};

export function publicAboutHref(restaurantSlug: string, menuSlug?: string): string {
  const base = `/m/${restaurantSlug}/about`;
  if (!menuSlug) return base;
  return `${base}?menu=${encodeURIComponent(menuSlug)}`;
}

export function publicMenuHref(
  restaurantSlug: string,
  menus: PublishedMenu[],
  menuSlugFromQuery?: string | null
): string {
  if (menuSlugFromQuery && menus.some((m) => m.slug === menuSlugFromQuery)) {
    return `/m/${restaurantSlug}/${menuSlugFromQuery}`;
  }

  const defaultMenu = menus.find((m) => m.is_default) ?? menus[0];
  if (defaultMenu) {
    return `/m/${restaurantSlug}/${defaultMenu.slug}`;
  }

  return `/m/${restaurantSlug}`;
}

export function menuSlugFromPublicMenuHref(
  restaurantSlug: string,
  href: string
): string {
  const prefix = `/m/${restaurantSlug}/`;
  if (!href.startsWith(prefix)) return "";
  const remainder = href.slice(prefix.length);
  return remainder.includes("/") ? "" : remainder;
}
