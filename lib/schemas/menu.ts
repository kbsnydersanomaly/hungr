import { z } from "zod";

export const MenuSchema = z.object({
  name: z.string().min(1, "Menu name is required."),
});

export const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Category name is required."),
});

const PreparationSchema = z.object({
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative().optional(),
});

const VariationSchema = z.object({
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative().optional(),
});

const SideSchema = z.object({
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative().optional(),
});

const SauceSchema = z.object({
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative().optional(),
});

export const ItemSchema = z.object({
  id: z.string().uuid().optional(),
  menu_id: z.string().uuid(),
  category_id: z.string().uuid(),
  name: z.string().min(1, "Item name is required."),
  description: z.string().max(2000).optional(),
  price_cents: z.number().int().nonnegative(),
  image_url: z.string().url().optional().or(z.literal("")),
  image_urls: z.array(z.string().url()).default([]),
  allergens: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  preparations: z.array(PreparationSchema).default([]),
  variations: z.array(VariationSchema).default([]),
  sides: z.array(SideSchema).default([]),
  sauces: z.array(SauceSchema).default([]),
  pairing_ids: z.array(z.string().uuid()).default([]),
  display_details: z
    .object({
      preparation: z.boolean().optional(),
      variation: z.boolean().optional(),
      side: z.boolean().optional(),
      sauce: z.boolean().optional(),
      allergen: z.boolean().optional(),
      pairing: z.boolean().optional(),
    })
    .default({}),
  custom_headings: z.record(z.string(), z.string()).optional(),
});

export type ItemInput = z.infer<typeof ItemSchema>;
