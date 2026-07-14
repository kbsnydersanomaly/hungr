import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/auth/active-org";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteMemberDialog } from "@/components/dashboard/team/InviteMemberDialog";
import { MemberActionsMenu } from "@/components/dashboard/team/MemberActionsMenu";
import { InvitationList, type InvitationRow } from "@/components/dashboard/team/InvitationList";
import { TeamMemberRow, type RestaurantAssignment } from "@/components/dashboard/team/TeamMemberRow";
import { rel, type ProfileRef, type RestaurantRef } from "@/lib/types/relations";
import { OrgTeamHelpBox } from "@/components/help/OrgTeamHelpBox";

type Member = {
  role: string;
  restaurant_scoped: boolean;
  joined_at?: string;
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

  const [
    { data: members },
    { data: invitations },
    { data: org },
    { data: restaurants },
    { data: restaurantMemberships },
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select(
        "role, restaurant_scoped, joined_at, profiles(id, email, first_name, last_name, display_name)"
      )
      .eq("org_id", activeOrg.orgId)
      .order("joined_at", { ascending: false }),
    supabase
      .from("invitations")
      .select(
        "id, email, role, restaurant_id, invited_by, expires_at, accepted_at, revoked_at, created_at, profiles!invited_by(display_name, email)"
      )
      .eq("org_id", activeOrg.orgId)
      .order("created_at", { ascending: false }),
    supabase
      .from("organizations")
      .select("name")
      .eq("id", activeOrg.orgId)
      .single(),
    supabase
      .from("restaurants")
      .select("id, name")
      .eq("org_id", activeOrg.orgId)
      .order("name"),
    supabase
      .from("restaurant_members")
      .select("user_id, role, restaurants!inner(id, name)")
      .eq("restaurants.org_id", activeOrg.orgId),
  ]);

  // Restaurant-scoped memberships grouped by user, so the org team list shows
  // at a glance who is assigned to which restaurant and in what role.
  const assignmentsByUser = new Map<string, RestaurantAssignment[]>();
  for (const rm of restaurantMemberships ?? []) {
    const restaurant = rel<RestaurantRef>(rm.restaurants);
    if (!restaurant?.id || !restaurant.name) continue;
    const list = assignmentsByUser.get(rm.user_id) ?? [];
    list.push({ restaurantId: restaurant.id, name: restaurant.name, role: rm.role });
    assignmentsByUser.set(rm.user_id, list);
  }

  const isOwner = activeOrg.role === "owner";
  const isAdmin = activeOrg.role === "admin" || isOwner;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Team" description={`Manage members of ${org?.name ?? "your organization"}`} />

      {restaurants && restaurants.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Want someone to manage only one restaurant? Invite them from that
          restaurant&apos;s Team page:{" "}
          {restaurants.map((r, i) => (
            <Fragment key={r.id}>
              {i > 0 && ", "}
              <Link
                href={`/restaurants/${r.id}/team`}
                className="underline underline-offset-2 hover:text-foreground"
              >
                {r.name}
              </Link>
            </Fragment>
          ))}
        </p>
      )}

      <OrgTeamHelpBox />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          {isAdmin && (
            <InviteMemberDialog orgId={activeOrg.orgId} restaurants={restaurants ?? []} />
          )}
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
                    restaurantScoped={m.restaurant_scoped}
                    assignments={profile?.id ? assignmentsByUser.get(profile.id) : undefined}
                    actions={
                      isAdmin && profile?.id ? (
                        <MemberActionsMenu
                          scope="org"
                          orgId={activeOrg.orgId}
                          userId={profile.id}
                          currentRole={m.role}
                          isOwner={isOwner}
                          restaurantScoped={m.restaurant_scoped}
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
            <CardTitle>Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InvitationList
              invitations={invitations as InvitationRow[]}
              isAdmin={isAdmin}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
