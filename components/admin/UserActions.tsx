"use client";

import { useRouter } from "next/navigation";
import { disableUser, enableUser, deleteUser } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";

interface UserActionsProps {
  userId: string;
  email: string;
}

export function UserActions({ userId, email }: UserActionsProps) {
  const router = useRouter();

  async function handleDelete() {
    const result = await deleteUser(userId);
    if (result && !result.ok) {
      throw new Error(result.message ?? "Failed to delete user.");
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <ServerActionForm
        action={async () => {
          await enableUser(userId);
          router.refresh();
        }}
        successMessage="User enabled."
      >
        <SubmitButton type="submit" size="sm" variant="outline">
          Enable
        </SubmitButton>
      </ServerActionForm>
      <ServerActionForm
        action={async () => {
          await disableUser(userId);
          router.refresh();
        }}
        successMessage="User disabled."
      >
        <SubmitButton type="submit" size="sm" variant="outline">
          Disable
        </SubmitButton>
      </ServerActionForm>
      <ConfirmDialog
        title="Delete user permanently"
        description={`This will permanently delete ${email} and all organizations they own. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
      >
        <Button size="sm" variant="destructive">
          Delete
        </Button>
      </ConfirmDialog>
    </div>
  );
}
