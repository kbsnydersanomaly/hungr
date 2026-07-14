import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { rel, type ProfileRef } from "@/lib/types/relations";

/** A restaurant-scoped membership, shown as a badge on the org team list. */
export type RestaurantAssignment = {
  restaurantId: string;
  name: string;
  role: string;
};

export function profileDisplayName(profile: ProfileRef | null): string {
  return (
    profile?.display_name ||
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    profile?.email ||
    "Unknown"
  );
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * A single team member row: avatar, name/email, role badge, and optional
 * trailing actions (e.g. a MemberActionsMenu or a "(via org)" note).
 */
export function TeamMemberRow({
  profiles,
  role,
  badgeVariant = "secondary",
  assignments,
  actions,
}: {
  /** Raw Supabase relation value; resolved via rel(). */
  profiles: unknown;
  role: string;
  badgeVariant?: "secondary" | "outline";
  /** Restaurant-scoped memberships to show as badges under the name. */
  assignments?: RestaurantAssignment[];
  actions?: React.ReactNode;
}) {
  const profile = rel<ProfileRef>(profiles);
  const displayName = profileDisplayName(profile);

  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs">
            {initialsFor(displayName)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">{profile?.email}</p>
          {assignments && assignments.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {assignments.map((a) => (
                <Badge key={a.restaurantId} variant="outline" className="font-normal">
                  {a.name} · <span className="capitalize">{a.role}</span>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={badgeVariant} className="capitalize">
          {role}
        </Badge>
        {actions}
      </div>
    </div>
  );
}
