import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { rel, type ProfileRef } from "@/lib/types/relations";

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
  actions,
}: {
  /** Raw Supabase relation value; resolved via rel(). */
  profiles: unknown;
  role: string;
  badgeVariant?: "secondary" | "outline";
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
