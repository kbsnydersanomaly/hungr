"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteMenu } from "@/lib/data/menu-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MenuCardProps {
  menu: {
    id: string;
    name: string;
    slug: string;
    status: string;
    is_default: boolean;
    qr_assigned?: boolean | null;
    qr_url?: string | null;
  };
  restaurantId: string;
}

export function MenuCard({ menu, restaurantId }: MenuCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    setLoading(true);
    const result = await deleteMenu(menu.id);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message ?? "Failed to delete menu.");
      return;
    }

    toast.success("Menu deleted.");
    setShowDelete(false);
    router.refresh();
  }

  return (
    <>
      <Card
        data-testid="menu-card"
        data-menu-id={menu.id}
        data-menu-name={menu.name}
        data-menu-slug={menu.slug}
      >
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{menu.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">/{menu.slug}</p>
            </div>
            <Badge variant={menu.status === "published" ? "default" : "secondary"}>
              {menu.status}
            </Badge>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <Button variant="link" size="sm" className="px-0 h-auto text-foreground" asChild>
              <Link href={`/restaurants/${restaurantId}/menus/${menu.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit menu
              </Link>
            </Button>

            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete menu</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{menu.name}</strong>? This action is
              permanent and will also remove its categories, items, specials, and analytics
              data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDelete(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
