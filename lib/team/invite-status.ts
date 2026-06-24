export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

/** Fields needed to derive an invitation's display status. */
export type InviteStatusInput = {
  accepted_at: string | null;
  revoked_at: string | null;
  expires_at: string;
};

/**
 * Derive a single display status for an invitation.
 * Precedence: accepted > revoked > expired > pending. An accepted invite stays
 * "accepted" even past its expiry; revocation wins over a not-yet-accepted expiry.
 */
export function computeInviteStatus(
  inv: InviteStatusInput,
  now: Date = new Date()
): InviteStatus {
  if (inv.accepted_at) return "accepted";
  if (inv.revoked_at) return "revoked";
  if (new Date(inv.expires_at) < now) return "expired";
  return "pending";
}

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  revoked: "Revoked",
};
