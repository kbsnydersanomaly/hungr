"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { revokeInvitation } from "@/lib/data/team-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const [loading, setLoading] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const router = useRouter();

  async function handleRevoke() {
    setLoading(true);
    const result = await revokeInvitation(invitationId);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.message ?? "Failed to revoke invitation.");
      return;
    }
    toast.success("Invitation revoked.");
    setShowRevoke(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setShowRevoke(true)}>
        Revoke
      </Button>

      <Dialog open={showRevoke} onOpenChange={setShowRevoke}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this invitation? The link will no longer work.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowRevoke(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Revoke
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
