import { createServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

/** Row shape returned by `get_invitation_by_token` RPC (matches prior join select). */
export type InvitationByToken = Database["public"]["Tables"]["invitations"]["Row"] & {
  organizations?: { name: string } | null;
};

export async function loadInvitationByToken(token: string): Promise<InvitationByToken | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("get_invitation_by_token", { p_token: token });

  if (error || data == null || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return data as InvitationByToken;
}
