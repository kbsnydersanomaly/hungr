import { z } from "zod";

export const SpecialSchema = z.object({
  id: z.string().uuid().optional(),
  restaurant_id: z.string().uuid(),
  menu_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1, "Title is required.").max(200),
  description: z.string().max(2000).optional().nullable(),
  kind: z.enum(["item_discount", "category_discount", "combo"]),
  discount_type: z.enum(["percentage", "fixed"]).optional().nullable(),
  discount_amount_cents: z.number().int().nonnegative().optional().nullable(),
  discount_pct: z.number().min(0).max(100).optional().nullable(),
  combo_price_cents: z.number().int().nonnegative().optional().nullable(),
  date_from: z.string().optional().nullable(),
  date_to: z.string().optional().nullable(),
  time_from: z.string().optional().nullable(),
  time_to: z.string().optional().nullable(),
  selected_days: z.array(z.string()).default([]),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
  image_url: z.string().url().optional().nullable().or(z.literal("")),
});

export type SpecialInput = z.infer<typeof SpecialSchema>;
