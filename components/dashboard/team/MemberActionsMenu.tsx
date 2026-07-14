"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  changeMemberRole,
  removeMember,
  changeRestaurantMemberRole,
  removeRestaurantMember,
  setStaffScope,
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
      /**
       * Staff only: true = access limited to assigned restaurants,
       * false = organisation-wide staff access. Enables the scope items.
       */
      restaurantScoped?: boolean;
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
  const router = useRouter();

  const roles: string[] =
    props.scope === "org"
      ? props.isOwner
        ? ["owner", "admin", "manager", "staff"]
        : ["admin", "manager", "staff"]
      : ["manager", "staff"];

  const removeTarget =
    props.scope === "org" ? "the organization" : "the restaurant";

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
    if (!result.ok) {
      toast.error(result.message ?? "Failed to change role.");
      return;
    }
    toast.success("Role updated.");
    router.refresh();
  }

  async function handleScopeChange(restaurantScoped: boolean) {
    if (props.scope !== "org") return;
    setLoading(true);
    const result = await setStaffScope(props.orgId, props.userId, restaurantScoped);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.message ?? "Failed to change access scope.");
      return;
    }
    toast.success(
      restaurantScoped
        ? "Access limited to assigned restaurants."
        : "Organisation-wide access granted."
    );
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
              onClick={() => handleRoleChange(role)}
              className="capitalize"
            >
              {role === props.currentRole ? `${role} (current)` : `Make ${role}`}
            </DropdownMenuItem>
          ))}
          {props.scope === "org" && props.currentRole === "staff" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={loading || props.restaurantScoped === false}
                onClick={() => handleScopeChange(false)}
              >
                {props.restaurantScoped === false
                  ? "Organisation-wide access (current)"
                  : "Grant organisation-wide access"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={loading || props.restaurantScoped === true}
                onClick={() => handleScopeChange(true)}
              >
                {props.restaurantScoped === true
                  ? "Assigned restaurants only (current)"
                  : "Limit to assigned restaurants"}
              </DropdownMenuItem>
            </>
          )}
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
