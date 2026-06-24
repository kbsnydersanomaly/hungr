"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { revokeInvitation, resendInvitation } from "@/lib/data/team-actions";
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
import type { InviteStatus } from "@/lib/team/invite-status";

export function InvitationActions({
  invitationId,
  status,
}: {
  invitationId: string;
  status: InviteStatus;
}) {
  const [revoking, setRevoking] = useState(false);
  const [resending, setResending] = useState(false);
  const [showRevoke, setShowRevoke] = useState(false);
  const router = useRouter();

  // Revoked/accepted invites are terminal — nothing to do.
  const canManage = status === "pending" || status === "expired";

  async function handleRevoke() {
    setRevoking(true);
    const result = await revokeInvitation(invitationId);
    setRevoking(false);
    if (!result.ok) {
      toast.error(result.message ?? "Failed to revoke invitation.");
      return;
    }
    toast.success("Invitation revoked.");
    setShowRevoke(false);
    router.refresh();
  }

  async function handleResend() {
    setResending(true);
    const result = await resendInvitation(invitationId);
    setResending(false);
    if (!result.ok) {
      toast.error(result.message ?? "Failed to resend invitation.");
      return;
    }
    toast.success("Invitation resent.");
    router.refresh();
  }

  if (!canManage) return null;

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={handleResend} disabled={resending}>
          {resending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Resend
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowRevoke(true)}>
          Revoke
        </Button>
      </div>

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
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Revoke
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
