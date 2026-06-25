"use client";

import { retrySubscriptionCheckoutAction } from "@/lib/data/billing-actions";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface RetryPaymentButtonProps extends Omit<ButtonProps, "type"> {
  subscriptionId: string;
  children: React.ReactNode;
}

export function RetryPaymentButton({
  subscriptionId,
  children,
  ...buttonProps
}: RetryPaymentButtonProps) {
  return (
    <ServerActionForm
      action={async () => retrySubscriptionCheckoutAction(subscriptionId)}
    >
      {({ isPending }) => (
        <Button type="submit" disabled={isPending} {...buttonProps}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {children}
        </Button>
      )}
    </ServerActionForm>
  );
}
