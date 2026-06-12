import { z } from "zod";

export const AboutPageSchema = z.object({
  about_text: z.string().max(5000).optional().nullable(),
  business_hours: z.string().max(2000).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(50).optional().nullable().or(z.literal("")),
  main_image_url: z.string().url().optional().nullable().or(z.literal("")),
  gallery_urls: z.array(z.string().url()).default([]),
  show_business_hours: z.boolean().default(true),
  show_contact: z.boolean().default(true),
});

export type AboutPageInput = z.infer<typeof AboutPageSchema>;
