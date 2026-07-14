"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inviteMember } from "@/lib/data/team-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const ORG_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
];

const RESTAURANT_ROLES = [
  { value: "manager", label: "Manager" },
  { value: "staff", label: "Staff" },
];

/** Sentinel for the access select: no restaurant scoping. */
const ORG_WIDE = "org-wide";

/**
 * Invite dialog for both org-level and restaurant-level teams.
 * Pass `restaurantId` to scope the invitation (and role options) to a
 * restaurant. In org mode, pass `restaurants` to offer the access choice for
 * manager/staff invites: organisation-wide, or scoped to one restaurant.
 */
export function InviteMemberDialog({
  orgId,
  restaurantId,
  restaurants,
}: {
  orgId: string;
  restaurantId?: string;
  restaurants?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState("staff");
  const [access, setAccess] = useState(ORG_WIDE);
  const router = useRouter();

  const isRestaurant = Boolean(restaurantId);
  const roles = isRestaurant ? RESTAURANT_ROLES : ORG_ROLES;

  // Restaurant scoping is only meaningful for manager/staff invites from the
  // org page; owner/admin are always organisation-wide.
  const showAccessChoice =
    !isRestaurant &&
    (role === "manager" || role === "staff") &&
    (restaurants?.length ?? 0) > 0;
  const accessItems = [
    { value: ORG_WIDE, label: "All restaurants (organisation-wide)" },
    ...(restaurants ?? []).map((r) => ({ value: r.id, label: `Only ${r.name}` })),
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await inviteMember(formData);

    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Something went wrong");
      return;
    }

    toast.success(result.data?.resent ? "Invitation updated." : "Invitation sent.");
    setOpen(false);
    router.refresh();
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setRole("staff");
      setAccess(ORG_WIDE);
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {isRestaurant ? "Invite staff" : "Invite member"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRestaurant ? "Invite staff member" : "Invite member"}
          </DialogTitle>
          <DialogDescription>
            {isRestaurant
              ? "Send an invitation to join this restaurant."
              : "Send an invitation to join your organization."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="orgId" value={orgId} />
          {restaurantId && (
            <input type="hidden" name="restaurantId" value={restaurantId} />
          )}
          {showAccessChoice && access !== ORG_WIDE && (
            <input type="hidden" name="restaurantId" value={access} />
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              placeholder={
                isRestaurant ? "chef@example.com" : "colleague@example.com"
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              name="role"
              value={role}
              onValueChange={(value) => setRole(String(value))}
              items={roles}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showAccessChoice && (
            <div className="space-y-2">
              <Label htmlFor="access">Access</Label>
              <Select
                value={access}
                onValueChange={(value) => setAccess(String(value))}
                items={accessItems}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select access" />
                </SelectTrigger>
                <SelectContent>
                  {accessItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {access === ORG_WIDE
                  ? "They will see every restaurant in the organisation."
                  : "They will only see that restaurant. You can assign more from each restaurant's Team page."}
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Send invite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
