import { z } from "zod";

export const InviteSchema = z.object({
  orgId: z.string().uuid(),
  email: z.string().email().toLowerCase(),
  role: z.enum(["owner", "admin", "manager", "staff"]),
  restaurantId: z.string().uuid().optional(),
});

export type InviteInput = z.infer<typeof InviteSchema>;
