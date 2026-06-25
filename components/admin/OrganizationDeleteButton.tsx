"use client";

import { useRouter } from "next/navigation";
import { deleteOrganization } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface OrganizationDeleteButtonProps {
  orgId: string;
  orgName: string;
}

export function OrganizationDeleteButton({ orgId, orgName }: OrganizationDeleteButtonProps) {
  const router = useRouter();

  async function handleDelete() {
    const result = await deleteOrganization(orgId);
    if (result && !result.ok) {
      throw new Error(result.message ?? "Failed to delete organization.");
    }
    router.push("/admin/orgs");
  }

  return (
    <ConfirmDialog
      title="Delete organization"
      description={`This will permanently delete ${orgName} and all of its restaurants, members, subscriptions and transactions.`}
      confirmLabel="Delete"
      onConfirm={handleDelete}
    >
      <Button size="sm" variant="destructive">Delete</Button>
    </ConfirmDialog>
  );
}
