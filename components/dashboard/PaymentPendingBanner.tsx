import { createServerClient } from "@/lib/supabase/server";
import { Clock } from "lucide-react";
import {
  findPendingSubscription,
  isRestaurantSubscriptionValid,
  loadRestaurantSubscriptions,
  type SubscriptionRow,
} from "@/lib/billing/subscription";
import { RetryPaymentButton } from "@/components/dashboard/RetryPaymentButton";

interface PaymentPendingBannerProps {
  restaurantId: string;
  orgId: string;
  /** Whether the viewer can act on billing (owner/admin). Managers get an info-only note. */
  canManageBilling?: boolean;
  /** Pre-loaded subscriptions; when omitted the banner loads them itself. */
  subscriptions?: SubscriptionRow[];
}

export async function PaymentPendingBanner({
  restaurantId,
  orgId,
  canManageBilling = true,
  subscriptions: subscriptionsProp,
}: PaymentPendingBannerProps) {
  const subscriptions =
    subscriptionsProp ??
    (await loadRestaurantSubscriptions(await createServerClient(), {
      id: restaurantId,
      org_id: orgId,
    }));
  const validity = isRestaurantSubscriptionValid(subscriptions);

  if (validity.valid || validity.reason !== "pending") {
    return null;
  }

  const pendingSub = findPendingSubscription(subscriptions);
  if (!pendingSub) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
      <div className="flex items-center justify-between max-w-7xl mx-auto gap-4">
        <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            Payment pending — click here to retry
          </span>
          <span className="text-amber-700 dark:text-amber-400 hidden sm:inline">
            Your public menu is hidden until payment completes.
          </span>
        </div>
        {canManageBilling ? (
          <RetryPaymentButton
            subscriptionId={pendingSub.id}
            variant="outline"
            size="sm"
            className="border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900 shrink-0"
          >
            Retry payment
          </RetryPaymentButton>
        ) : (
          <span className="text-amber-700 dark:text-amber-400 text-sm shrink-0">
            Contact your account owner to complete payment.
          </span>
        )}
      </div>
    </div>
  );
}
