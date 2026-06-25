"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  changeMemberRole,
  removeMember,
  changeRestaurantMemberRole,
  removeRestaurantMember,
} from "@/lib/data/team-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { OrgRole, RestaurantRole } from "@/lib/auth/role";

type MemberActionsMenuProps =
  | {
      scope: "org";
      orgId: string;
      userId: string;
      currentRole: string;
      /** Owners can also assign the owner role. */
      isOwner: boolean;
    }
  | {
      scope: "restaurant";
      restaurantId: string;
      userId: string;
      currentRole: string;
    };

/**
 * Role-change / remove dropdown for both org-level and restaurant-level
 * team members.
 */
export function MemberActionsMenu(props: MemberActionsMenuProps) {
  const [loading, setLoading] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  // Owner-impacting role changes (promote to / demote from owner) require an
  // explicit confirmation; pendingRole holds the target role until confirmed.
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const router = useRouter();

  const roles: string[] =
    props.scope === "org"
      ? props.isOwner
        ? ["owner", "admin", "manager", "staff"]
        : ["admin", "manager", "staff"]
      : ["manager", "staff"];

  const removeTarget =
    props.scope === "org" ? "the organization" : "the restaurant";

  /** Promotion to owner, or demotion of an existing owner, is high-impact. */
  function isOwnerImpacting(role: string): boolean {
    if (props.scope !== "org") return false;
    return role === "owner" || (props.currentRole === "owner" && role !== "owner");
  }

  function selectRole(role: string) {
    if (isOwnerImpacting(role)) {
      setPendingRole(role);
      return;
    }
    handleRoleChange(role);
  }

  async function handleRoleChange(role: string) {
    setLoading(true);
    const result =
      props.scope === "org"
        ? await changeMemberRole(props.orgId, props.userId, role as OrgRole)
        : await changeRestaurantMemberRole(
            props.restaurantId,
            props.userId,
            role as RestaurantRole
          );
    setLoading(false);
    setPendingRole(null);
    if (!result.ok) {
      toast.error(result.message ?? "Failed to change role.");
      return;
    }
    toast.success("Role updated.");
    router.refresh();
  }

  async function handleRemove() {
    setLoading(true);
    const result =
      props.scope === "org"
        ? await removeMember(props.orgId, props.userId)
        : await removeRestaurantMember(props.restaurantId, props.userId);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.message ?? "Failed to remove member.");
      return;
    }
    toast.success("Member removed.");
    setShowRemove(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Member actions"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted cursor-pointer"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {roles.map((role) => (
            <DropdownMenuItem
              key={role}
              disabled={loading || role === props.currentRole}
              onClick={() => selectRole(role)}
              className="capitalize"
            >
              {role === props.currentRole ? `${role} (current)` : `Make ${role}`}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={loading}
            onClick={() => setShowRemove(true)}
            className="text-destructive focus:text-destructive"
          >
            Remove member
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={pendingRole !== null}
        onOpenChange={(open) => !open && setPendingRole(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingRole === "owner" ? "Make owner" : "Remove owner role"}
            </DialogTitle>
            <DialogDescription>
              {pendingRole === "owner"
                ? "Make this member an owner? Owners have full control, including billing and deleting the organization."
                : "Remove this member's owner role? They will lose owner-level access to the organization."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingRole(null)}>
              Cancel
            </Button>
            <Button
              variant={pendingRole === "owner" ? "default" : "destructive"}
              onClick={() => pendingRole && handleRoleChange(pendingRole)}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {pendingRole === "owner" ? "Make owner" : "Remove owner role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRemove} onOpenChange={setShowRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this member from {removeTarget}?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowRemove(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
