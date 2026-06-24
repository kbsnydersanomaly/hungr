import { Badge } from "@/components/ui/badge";
import { InvitationActions } from "@/components/dashboard/team/InvitationActions";
import {
  computeInviteStatus,
  INVITE_STATUS_LABEL,
  type InviteStatus,
} from "@/lib/team/invite-status";
import { rel, type ProfileRef } from "@/lib/types/relations";

export type InvitationRow = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  profiles: unknown;
};

const STATUS_VARIANT: Record<InviteStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  accepted: "default",
  expired: "outline",
  revoked: "destructive",
};

export function InvitationList({
  invitations,
  isAdmin,
}: {
  invitations: InvitationRow[];
  isAdmin: boolean;
}) {
  return (
    <div className="divide-y">
      {invitations.map((inv) => {
        const inviter = rel<ProfileRef>(inv.profiles);
        const status = computeInviteStatus(inv);
        return (
          <div key={inv.id} className="flex items-center justify-between py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{inv.email}</p>
                <Badge variant={STATUS_VARIANT[status]}>
                  {INVITE_STATUS_LABEL[status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Invited as {inv.role} by{" "}
                {inviter?.display_name || inviter?.email || "Unknown"} ·{" "}
                {status === "accepted" ? "accepted" : "expires"}{" "}
                {new Date(
                  status === "accepted" && inv.accepted_at
                    ? inv.accepted_at
                    : inv.expires_at
                ).toLocaleDateString()}
              </p>
            </div>
            {isAdmin && <InvitationActions invitationId={inv.id} status={status} />}
          </div>
        );
      })}
    </div>
  );
}
