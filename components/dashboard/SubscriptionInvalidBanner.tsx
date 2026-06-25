import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isRestaurantSubscriptionValid,
  loadRestaurantSubscriptions,
  type SubscriptionValidity,
} from "@/lib/billing/subscription";

interface SubscriptionInvalidBannerProps {
  restaurantId: string;
  orgId: string;
  billingHref: string;
}

const messages: Record<
  Exclude<SubscriptionValidity, { valid: true }>["reason"],
  string
> = {
  no_active_subscription: "No active subscription found.",
  expired: "Your subscription has expired.",
  paused: "Your subscription is paused.",
  cancelled: "Your subscription was cancelled.",
  failed: "Your last payment failed.",
  pending: "Your subscription payment is still pending.",
};

export async function SubscriptionInvalidBanner({
  restaurantId,
  orgId,
  billingHref,
}: SubscriptionInvalidBannerProps) {
  const supabase = await createServerClient();
  const subscriptions = await loadRestaurantSubscriptions(supabase, {
    id: restaurantId,
    org_id: orgId,
  });
  const validity = isRestaurantSubscriptionValid(subscriptions);

  if (validity.valid) {
    return null;
  }

  return (
    <div className="bg-rose-50 dark:bg-rose-950/30 border-b border-rose-200 dark:border-rose-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto gap-4">
        <div className="flex items-center gap-2 text-sm text-rose-800 dark:text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="font-medium">{messages[validity.reason]}</span>
          <span className="text-rose-600 dark:text-rose-400 hidden sm:inline">
            Your public menu is hidden from visitors.
          </span>
        </div>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900 shrink-0"
        >
          <Link href={billingHref}>Billing settings</Link>
        </Button>
      </div>
    </div>
  );
}
