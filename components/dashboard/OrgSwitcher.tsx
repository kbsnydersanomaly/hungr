"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronsUpDown } from "lucide-react";
import { setActiveOrg } from "@/lib/auth/active-org-actions";
import { toast } from "sonner";

interface OrgMembership {
  orgId: string;
  name: string;
  role: string;
}

export function OrgSwitcher({
  memberships,
  activeOrgId,
  canManageOrg,
}: {
  memberships: OrgMembership[];
  activeOrgId: string | null;
  canManageOrg: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const active = memberships.find((m) => m.orgId === activeOrgId);

  // Single org and nothing to manage — keep the simple link behaviour.
  if (memberships.length <= 1 && !canManageOrg) {
    return (
      <p className="text-sm font-medium mt-1 truncate">
        {active?.name ?? "No organization"}
      </p>
    );
  }

  if (memberships.length <= 1) {
    return (
      <Link
        href="/settings/organization"
        className="text-sm font-medium mt-1 truncate block hover:underline"
      >
        {active?.name ?? "No organization"}
      </Link>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="mt-1 flex w-full items-center justify-between gap-1 text-sm font-medium outline-none hover:underline cursor-pointer"
      >
        <span className="truncate">{active?.name ?? "Select organization"}</span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your organizations</DropdownMenuLabel>
          {memberships.map((m) => (
            <DropdownMenuItem
              key={m.orgId}
              disabled={isPending}
              className="cursor-pointer"
              onClick={() =>
                startTransition(async () => {
                  const result = await setActiveOrg(m.orgId);
                  if (result && !result.ok) {
                    toast.error(result.message ?? "Failed to switch organization");
                  }
                })
              }
            >
              <span className="flex-1 truncate">{m.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
              {m.orgId === activeOrgId && <Check className="h-3.5 w-3.5 ml-1" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        {canManageOrg && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push("/settings/organization")}
              className="cursor-pointer"
            >
              Organization settings
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
