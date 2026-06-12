import { notFound } from "next/navigation";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteMemberDialog } from "@/components/dashboard/team/InviteMemberDialog";
import { MemberActionsMenu } from "@/components/dashboard/team/MemberActionsMenu";
import { TeamMemberRow } from "@/components/dashboard/team/TeamMemberRow";
import { rel, type ProfileRef } from "@/lib/types/relations";

type TeamMember = {
  role: string;
  joined_at?: string;
  profiles: unknown;
};

export const dynamic = "force-dynamic";

export default async function RestaurantTeamPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("name, org_id")
    .eq("id", restaurantId)
    .single();

  if (!restaurant) notFound();

  const [{ data: restaurantMembers }, { data: orgMembers }] = await Promise.all([
    supabase
      .from("restaurant_members")
      .select(
        "role, joined_at, profiles(id, email, first_name, last_name, display_name)"
      )
      .eq("restaurant_id", restaurantId)
      .order("joined_at", { ascending: false }),
    supabase
      .from("organization_members")
      .select("role, profiles(id, email, first_name, last_name, display_name)")
      .eq("org_id", restaurant.org_id)
      .order("joined_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Team"
        description={`Manage team members for ${restaurant.name}`}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Members</CardTitle>
          <InviteMemberDialog restaurantId={restaurantId} orgId={restaurant.org_id} />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Org members shown as read-only */}
          {orgMembers && orgMembers.length > 0 && (
            <div className="divide-y">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-2">
                Organization members
              </p>
              {orgMembers.map((m: TeamMember) => {
                const profile = rel<ProfileRef>(m.profiles);
                return (
                  <TeamMemberRow
                    key={profile?.id}
                    profiles={m.profiles}
                    role={m.role}
                    badgeVariant="outline"
                    actions={
                      <span className="text-xs text-muted-foreground">(via org)</span>
                    }
                  />
                );
              })}
            </div>
          )}

          {/* Restaurant-specific members */}
          <div className="divide-y">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider py-2">
              Restaurant-specific members
            </p>
            {restaurantMembers && restaurantMembers.length > 0 ? (
              restaurantMembers.map((m: TeamMember) => {
                const profile = rel<ProfileRef>(m.profiles);
                return (
                  <TeamMemberRow
                    key={profile?.id}
                    profiles={m.profiles}
                    role={m.role}
                    actions={
                      profile?.id ? (
                        <MemberActionsMenu
                          scope="restaurant"
                          restaurantId={restaurantId}
                          userId={profile.id}
                          currentRole={m.role}
                        />
                      ) : undefined
                    }
                  />
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No restaurant-specific members yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
