import { z } from "zod";
import { isValidSouthAfricanPhone } from "@/lib/utils/phone";

export const UpdateProfileSchema = z.object({
  display_name: z.string().trim().min(1, "Display name is required"),
  first_name: z.string().trim().optional(),
  last_name: z.string().trim().optional(),
  phone: z
    .string()
    .trim()
    .refine((v) => !v || isValidSouthAfricanPhone(v), {
      message: "Please enter a valid South African cellphone number",
    })
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
