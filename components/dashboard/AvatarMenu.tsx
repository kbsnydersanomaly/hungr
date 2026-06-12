"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/lib/auth/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut } from "lucide-react";

export function AvatarMenu({ email }: { email?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary cursor-pointer outline-none focus:ring-2 focus:ring-primary/20"
      >
        {email?.charAt(0).toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => router.push("/settings/profile")}
          className="cursor-pointer"
        >
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => startTransition(() => signOutAction())}
          disabled={isPending}
          variant="destructive"
          className="cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
