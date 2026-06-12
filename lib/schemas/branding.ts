import { z } from "zod";

export const BrandingColorSchema = z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/, "Invalid hex color").optional().nullable();

export const ButtonStyleSchema = z.object({
  main_color: z.string().optional(),
  text_color: z.string().optional(),
  typeface: z.string().optional(),
  case: z.string().optional(),
}).optional().nullable();

export const HeadingStyleSchema = z.object({
  color: z.string().optional(),
  typeface: z.string().optional(),
  case: z.string().optional(),
  size: z.string().optional(),
}).optional().nullable();

export const BodyStyleSchema = z.object({
  color: z.string().optional(),
  typeface: z.string().optional(),
  case: z.string().optional(),
  size: z.string().optional(),
}).optional().nullable();

export const BrandingDraftSchema = z.object({
  primary_color: BrandingColorSchema,
  secondary_color: BrandingColorSchema,
  accent_color: BrandingColorSchema,
  nav_bar_color: BrandingColorSchema,
  background_color: BrandingColorSchema,
  logo_media_id: z.string().uuid().optional().nullable(),
  primary_button: ButtonStyleSchema,
  secondary_button: ButtonStyleSchema,
  main_heading: HeadingStyleSchema,
  sub_heading: HeadingStyleSchema,
  body: BodyStyleSchema,
});
