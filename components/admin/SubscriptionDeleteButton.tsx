"use client";

import { useRouter } from "next/navigation";
import { deleteSubscription } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface SubscriptionDeleteButtonProps {
  subscriptionId: string;
}

export function SubscriptionDeleteButton({ subscriptionId }: SubscriptionDeleteButtonProps) {
  const router = useRouter();

  async function handleDelete() {
    const result = await deleteSubscription(subscriptionId);
    if (result && !result.ok) {
      throw new Error(result.message ?? "Failed to delete subscription.");
    }
    router.push("/admin/subscriptions");
  }

  return (
    <ConfirmDialog
      title="Delete subscription"
      description="This will permanently delete the subscription record."
      confirmLabel="Delete"
      onConfirm={handleDelete}
    >
      <Button variant="destructive" size="sm">Delete</Button>
    </ConfirmDialog>
  );
}
