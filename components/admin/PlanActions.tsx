"use client";

import { useRouter } from "next/navigation";
import { deactivatePlan, deletePlan } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";

interface PlanActionsProps {
  planId: string;
  active: boolean;
}

export function PlanActions({ planId, active }: PlanActionsProps) {
  const router = useRouter();

  async function handleDelete() {
    const result = await deletePlan(planId);
    if (result && !result.ok) {
      throw new Error(result.message ?? "Failed to delete plan.");
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {!active && (
        <ConfirmDialog
          title="Delete plan permanently"
          description="This will permanently delete the plan. Only possible if no subscriptions use it."
          confirmLabel="Delete"
          onConfirm={handleDelete}
        >
          <Button size="sm" variant="destructive">Hard delete</Button>
        </ConfirmDialog>
      )}
      <ServerActionForm
        action={deactivatePlan.bind(null, planId)}
        onSuccess={() => router.refresh()}
        successMessage="Plan deactivated."
      >
        <SubmitButton type="submit" size="sm" variant="outline">
          Deactivate
        </SubmitButton>
      </ServerActionForm>
    </div>
  );
}
