"use client";

import { Plus } from "lucide-react";
import type { OrgRole } from "@/lib/auth/role";
import type { RestaurantBillingContext } from "@/lib/billing/pricing";
import { formatZar } from "@/lib/utils/money";
import { LinkButton } from "@/components/ui/link-button";

type AddRestaurantButtonProps = {
  role: OrgRole;
  billing: RestaurantBillingContext | null;
};

const ADMIN_ROLES = new Set<OrgRole>(["owner", "admin"]);

export function getAddRestaurantTitle(
  billing: RestaurantBillingContext | null
): string {
  if (!billing) return "Choose a plan first to add a restaurant.";

  switch (billing.state) {
    case "included":
      return "This restaurant is included in your current plan — no extra charge.";
    case "checkout": {
      const price = formatZar(billing.priceCents);
      return billing.perRestaurant
        ? `This restaurant will be billed at ${price}/month.`
        : `Start your ${billing.plan.name} subscription at ${price}/month.`;
    }
    case "limit_reached":
      return `Plan limit reached. Your plan supports up to ${billing.maxRestaurants} restaurant${billing.maxRestaurants === 1 ? "" : "s"}. Upgrade to add more.`;
    case "custom":
      return "Enterprise plans must be set up by support.";
    case "no_plan":
      return "Choose a plan first to add a restaurant.";
  }
}

export function AddRestaurantButton({ role, billing }: AddRestaurantButtonProps) {
  if (!ADMIN_ROLES.has(role)) return null;

  return (
    <LinkButton href="/restaurants/new" icon={<Plus />} title={getAddRestaurantTitle(billing)}>
      Add restaurant
    </LinkButton>
  );
}
