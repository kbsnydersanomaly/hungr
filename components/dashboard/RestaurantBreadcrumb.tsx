"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, ChevronDown, Pencil, Loader2 } from "lucide-react";
import { setActiveRestaurant } from "@/lib/auth/active-restaurant";
import { renameRestaurant } from "@/lib/data/restaurant-settings-actions";
import { toast } from "sonner";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

export function RestaurantBreadcrumb({
  restaurants,
  activeRestaurant,
  orgName,
}: {
  restaurants: Restaurant[];
  activeRestaurant: Restaurant | null;
  orgName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  function openRename() {
    setRenameValue(activeRestaurant?.name ?? "");
    setRenameOpen(true);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRestaurant) return;
    setRenaming(true);
    try {
      const result = await renameRestaurant(activeRestaurant.id, renameValue);
      if (result.ok) {
        toast.success("Restaurant renamed");
        setRenameOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "Failed to rename restaurant");
      }
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Dashboard</span>
      <ChevronRight className="h-3 w-3" />
      <Link
        href="/settings/organization"
        className="text-foreground font-medium hover:underline"
      >
        {orgName}
      </Link>
      {restaurants.length > 0 && (
        <>
          <ChevronRight className="h-3 w-3" />
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-foreground font-medium outline-none hover:underline cursor-pointer">
              {activeRestaurant?.name ?? "Select restaurant"}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {restaurants.map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  onClick={() =>
                    startTransition(() =>
                      setActiveRestaurant(r.id, `/restaurants/${r.id}`)
                    )
                  }
                  disabled={isPending}
                  className="cursor-pointer"
                >
                  {r.name}
                </DropdownMenuItem>
              ))}
              {activeRestaurant && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={openRename}
                    className="cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Rename “{activeRestaurant.name}”
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename restaurant</DialogTitle>
                <DialogDescription>
                  The public menu link stays the same — only the display name
                  changes.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRename} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rename-restaurant">Restaurant name</Label>
                  <Input
                    id="rename-restaurant"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRenameOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={renaming || !renameValue.trim()}>
                    {renaming && (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    )}
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
