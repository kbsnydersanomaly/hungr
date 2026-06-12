import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/auth/active-org";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteMemberDialog } from "@/components/dashboard/team/InviteMemberDialog";
import { MemberActionsMenu } from "@/components/dashboard/team/MemberActionsMenu";
import { InvitationActions } from "@/components/dashboard/team/InvitationActions";
import { TeamMemberRow } from "@/components/dashboard/team/TeamMemberRow";
import { rel, type ProfileRef } from "@/lib/types/relations";

type Member = { role: string; joined_at?: string; profiles: unknown };
type Invitation = {
  id: string;
  email: string;
  role: string;
  restaurant_id: string | null;
  invited_by: string | null;
  expires_at: string;
  created_at: string;
  profiles: unknown;
};

export const dynamic = "force-dynamic";

export default async function TeamSettingsPage() {
  const activeOrg = await getActiveOrg();
  if (!activeOrg?.orgId) redirect("/dashboard");
  // Team management is owner/admin only.
  if (activeOrg.role !== "owner" && activeOrg.role !== "admin") {
    redirect("/settings/profile");
  }

  const supabase = await createServerClient();

  const [{ data: members }, { data: invitations }, { data: org }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select(
          "role, joined_at, profiles(id, email, first_name, last_name, display_name)"
        )
        .eq("org_id", activeOrg.orgId)
        .order("joined_at", { ascending: false }),
      supabase
        .from("invitations")
        .select(
          "id, email, role, restaurant_id, invited_by, expires_at, created_at, profiles!invited_by(display_name, email)"
        )
        .eq("org_id", activeOrg.orgId)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("organizations")
        .select("name")
        .eq("id", activeOrg.orgId)
        .single(),
    ]);

  const isOwner = activeOrg.role === "owner";
  const isAdmin = activeOrg.role === "admin" || isOwner;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Team" description={`Manage members of ${org?.name ?? "your organization"}`} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          {isAdmin && <InviteMemberDialog orgId={activeOrg.orgId} />}
        </CardHeader>
        <CardContent className="space-y-4">
          {members && members.length > 0 ? (
            <div className="divide-y">
              {members.map((m: Member) => {
                const profile = rel<ProfileRef>(m.profiles);
                return (
                  <TeamMemberRow
                    key={profile?.id}
                    profiles={m.profiles}
                    role={m.role}
                    actions={
                      isAdmin && profile?.id ? (
                        <MemberActionsMenu
                          scope="org"
                          orgId={activeOrg.orgId}
                          userId={profile.id}
                          currentRole={m.role}
                          isOwner={isOwner}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No members found.
            </p>
          )}
        </CardContent>
      </Card>

      {invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y">
              {invitations.map((inv: Invitation) => {
                const inviter = rel<ProfileRef>(inv.profiles);
                return (
                  <div key={inv.id} className="flex items-center justify-between py-4">
                    <div>
                      <p className="text-sm font-medium">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited as {inv.role} by{" "}
                        {inviter?.display_name || inviter?.email || "Unknown"} ·{" "}
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    {isAdmin && <InvitationActions invitationId={inv.id} />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
