import { z } from "zod";

export const RestaurantSchema = z.object({
  name: z.string().min(1, "Restaurant name is required."),
  street: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
});
