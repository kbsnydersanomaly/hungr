import { z } from "zod";

export const ReviewSchema = z.object({
  menu_item_id: z.string().uuid(),
  restaurant_id: z.string().uuid(),
  customer_name: z.string().min(2, "Name must be at least 2 characters."),
  message: z.string().min(10, "Review must be at least 10 characters."),
  rating: z.coerce.number().int().min(1).max(5, "Rating must be between 1 and 5."),
});
