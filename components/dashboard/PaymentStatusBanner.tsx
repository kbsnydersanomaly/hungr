import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Banner shown on billing pages after returning from PayFast checkout,
 * driven by the `?status=` query param.
 */
export function PaymentStatusBanner({
  status,
  cancelMessage = "Payment was cancelled.",
}: {
  status: string | string[] | undefined;
  cancelMessage?: string;
}) {
  if (status === "complete") {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
          <p className="text-sm font-medium text-green-800 dark:text-green-300">
            Payment received. Your subscription is now active.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "cancel") {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="py-4 flex items-center gap-3">
          <XCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {cancelMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
