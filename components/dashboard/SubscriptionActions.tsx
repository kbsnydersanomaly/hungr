"use client";

import { useState } from "react";
import {
  pauseSubscriptionAction,
  cancelSubscriptionAction,
  resumeSubscriptionAction,
} from "@/lib/data/billing-actions";
import { RetryPaymentButton } from "@/components/dashboard/RetryPaymentButton";
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

function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel,
  confirmVariant = "destructive",
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactElement;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  confirmVariant?: "destructive" | "default";
  loading: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Never mind
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  async function handlePause() {
    setLoading("pause");
    try {
      const result = await pauseSubscriptionAction(subscriptionId);
      if (!result.ok) throw new Error(result.message || "Failed to pause.");
      toast.success("Subscription paused.");
      setPauseConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to pause.");
    } finally {
      setLoading(null);
    }
  }

  async function handleResume() {
    setLoading("resume");
    try {
      const result = await resumeSubscriptionAction(subscriptionId);
      if (!result.ok) throw new Error(result.message || "Failed to resume.");
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
      const result = await cancelSubscriptionAction(subscriptionId);
      if (!result.ok) throw new Error(result.message || "Failed to cancel.");
      toast.success("Subscription cancelled.");
      setCancelConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel.");
    } finally {
      setLoading(null);
    }
  }

  if (status === "pending") {
    return (
      <div className="rounded-lg border border-dashed p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Waiting for first payment. Complete checkout to activate your
          subscription.
        </p>
        <RetryPaymentButton subscriptionId={subscriptionId} size="sm">
          Retry payment
        </RetryPaymentButton>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {status === "active" && (
        <>
          <ConfirmDialog
            open={pauseConfirmOpen}
            onOpenChange={setPauseConfirmOpen}
            trigger={
              <Button
                variant="outline"
                size="sm"
                disabled={loading !== null || !payfastToken}
              >
                {loading === "pause" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4 mr-2" />
                )}
                Pause
              </Button>
            }
            title="Pause subscription?"
            description="Pausing will skip the next billing cycle. Your menu will stay visible until the end of the current billing period."
            confirmLabel="Yes, pause"
            confirmVariant="default"
            loading={loading === "pause"}
            onConfirm={handlePause}
          />

          <ConfirmDialog
            open={cancelConfirmOpen}
            onOpenChange={setCancelConfirmOpen}
            trigger={
              <Button
                variant="destructive"
                size="sm"
                disabled={loading !== null || !payfastToken}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            }
            title="Cancel subscription?"
            description="This will cancel your recurring billing. You can re-subscribe later, but you may lose any promotional pricing."
            confirmLabel="Yes, cancel"
            confirmVariant="destructive"
            loading={loading === "cancel"}
            onConfirm={handleCancel}
          />
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
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
          <div className="text-sm">
            <p className="font-medium text-destructive">Payment failed</p>
            <p className="text-muted-foreground">
              Your last payment could not be processed. Retry checkout to
              activate your subscription.
            </p>
          </div>
          <RetryPaymentButton subscriptionId={subscriptionId} size="sm" variant="outline">
            Retry payment
          </RetryPaymentButton>
        </div>
      )}
    </div>
  );
}
