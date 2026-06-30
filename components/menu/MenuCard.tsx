"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteMenu } from "@/lib/data/menu-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";
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
  const router = useRouter();

  async function handleDelete() {
    const result = await deleteMenu(menu.id);
    if (!result.ok) throw new Error(result.message ?? "Failed to delete menu.");
    toast.success("Menu deleted.");
    router.refresh();
  }

  return (
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
          <Button variant="link" size="sm" className="px-0 h-auto" asChild>
            <Link href={`/restaurants/${restaurantId}/menus/${menu.id}`}>
              <Pencil className="h-3.5 w-3.5 mr-1" />
              Edit menu
            </Link>
          </Button>

          <ConfirmDialog
            title="Delete menu"
            description={`Are you sure you want to delete "${menu.name}"? This action is permanent and will also remove its categories, items, specials, and analytics data.`}
            confirmLabel="Delete"
            onConfirm={handleDelete}
          >
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </ConfirmDialog>
        </div>
      </CardContent>
    </Card>
  );
}
