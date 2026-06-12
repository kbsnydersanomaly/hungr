/**
 * Curated Google Fonts restaurants can pick for their public menu.
 * Keep this list short and well-tested — each choice is loaded from
 * Google Fonts on the public menu page.
 */
export const GOOGLE_FONT_OPTIONS = [
  "Poppins",
  "Figtree",
  "Inter",
  "Lato",
  "Montserrat",
  "Open Sans",
  "Nunito",
  "DM Sans",
  "Roboto",
  "Lora",
  "Playfair Display",
  "Bebas Neue",
] as const;

export type GoogleFontOption = (typeof GOOGLE_FONT_OPTIONS)[number];
