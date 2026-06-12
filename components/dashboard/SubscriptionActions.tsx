"use client";

import { useState } from "react";
import {
  pauseSubscriptionAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
} from "@/lib/data/billing-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pause, Play, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionActionsProps {
  subscriptionId: string;
  status: string;
  payfastToken: string | null;
}

export function SubscriptionActions({
  subscriptionId,
  status,
  payfastToken,
}: SubscriptionActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handlePause() {
    setLoading("pause");
    try {
      await pauseSubscriptionAction(subscriptionId);
      toast.success("Subscription paused.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pause.");
    } finally {
      setLoading(null);
    }
  }

  async function handleResume() {
    setLoading("resume");
    try {
      await resumeSubscriptionAction(subscriptionId);
      toast.success("Subscription resumed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resume.");
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    setLoading("cancel");
    try {
      await cancelSubscriptionAction(subscriptionId);
      toast.success("Subscription cancelled.");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel.");
    } finally {
      setLoading(null);
    }
  }

  if (status === "pending") {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        Waiting for first payment. Complete checkout to activate your subscription.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {status === "active" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={loading !== null || !payfastToken}
          >
            {loading === "pause" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Pause className="h-4 w-4 mr-2" />
            )}
            Pause
          </Button>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger render={<Button variant="destructive" size="sm" />}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cancel subscription?</DialogTitle>
                <DialogDescription>
                  This will cancel your recurring billing. You can re-subscribe
                  later, but you may lose any promotional pricing.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setConfirmOpen(false)}
                  disabled={loading === "cancel"}
                >
                  Never mind
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={loading === "cancel"}
                >
                  {loading === "cancel" && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Yes, cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {status === "paused" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResume}
          disabled={loading !== null || !payfastToken}
        >
          {loading === "resume" ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Resume
        </Button>
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
