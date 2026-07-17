"use client";

import {
  pauseSubscriptionAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
  retrySubscriptionCheckout,
  updatePaymentMethodAction,
} from "@/lib/data/billing-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAction } from "@/lib/hooks/use-action";
import { Pause, Play, XCircle, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionActionsProps {
  subscriptionId: string;
  status: string;
  payfastToken: string | null;
  isSandbox?: boolean;
}

export function SubscriptionActions({
  subscriptionId,
  status,
  payfastToken,
  isSandbox = false,
}: SubscriptionActionsProps) {
  const resume = useAction(resumeSubscriptionAction, {
    successMessage: "Subscription resumed.",
  });
  // Retry redirects to PayFast on success, so it only resolves here on error.
  const retry = useAction(retrySubscriptionCheckout);
  const updatePaymentMethod = useAction(updatePaymentMethodAction, {
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
  });

  if (status === "pending") {
    return (
      <div className="rounded-lg border border-dashed p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Payment pending — complete checkout to activate your subscription.
        </p>
        <Button
          size="sm"
          onClick={() => retry.run(subscriptionId)}
          disabled={retry.isPending}
        >
          {retry.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          Retry payment
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {status === "active" && (
        <>
          <ConfirmDialog
            title="Pause subscription?"
            description="Pausing will skip the next billing cycle. Your menu will stay visible until the end of the current billing period."
            confirmLabel="Yes, pause"
            confirmVariant="default"
            onConfirm={async () => {
              const result = await pauseSubscriptionAction(subscriptionId);
              if (!result.ok) throw new Error(result.message || "Failed to pause.");
              toast.success("Subscription paused.");
            }}
          >
            <Button variant="outline" size="sm" disabled={!payfastToken}>
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          </ConfirmDialog>

          <ConfirmDialog
            title="Cancel subscription?"
            description="This will cancel your recurring billing. You can re-subscribe later, but you may lose any promotional pricing."
            confirmLabel="Yes, cancel"
            confirmVariant="destructive"
            onConfirm={async () => {
              const result = await cancelSubscriptionAction(subscriptionId);
              if (!result.ok) throw new Error(result.message || "Failed to cancel.");
              toast.success("Subscription cancelled.");
            }}
          >
            {/* Unlike pause/resume, cancel works without a PayFast token — the
                action then only cancels the local row (see
                cancelSubscriptionAction), which is the only way out for old
                subscriptions that never received a token. */}
            <Button variant="destructive" size="sm">
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </ConfirmDialog>
        </>
      )}

      {status === "paused" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => resume.run(subscriptionId)}
          disabled={resume.isPending || !payfastToken}
        >
          {resume.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Resume
        </Button>
      )}

      {(status === "active" || status === "paused") && payfastToken && (
        <ConfirmDialog
          title="Update payment method?"
          description="You'll be redirected to PayFast to update your card details. Your subscription stays active and no service is interrupted."
          confirmLabel="Continue"
          confirmVariant="default"
          onConfirm={async () => {
            const result = await updatePaymentMethod.execute(subscriptionId);
            if (!result.ok) {
              throw new Error(result.message || "Failed to start update.");
            }
            // onSuccess navigates to the returned PayFast URL.
          }}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={updatePaymentMethod.isPending}
          >
            {updatePaymentMethod.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4 mr-2" />
            )}
            {isSandbox ? "Update payment method" : "Update card"}
          </Button>
        </ConfirmDialog>
      )}

      {status === "failed" && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Payment failed</p>
          <p className="text-muted-foreground">
            Your last payment could not be processed. Please update your
            payment method or contact support.
          </p>
        </div>
      )}
    </div>
  );
}
