import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  loadMenuById,
  loadCategoriesForMenu,
  loadMenuItemsForMenu,
} from "@/lib/data/menus";
import { updateMenuStatus, upsertCategory } from "@/lib/data/menu-actions";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MenuWorkspace } from "@/components/menu/MenuWorkspace";
import { ArrowLeft, ExternalLink, Plus, Eye, EyeOff } from "lucide-react";

export default async function MenuWorkspacePage({
  params,
}: {
  params: Promise<{ restaurantId: string; menuId: string }>;
}) {
  const { restaurantId, menuId } = await params;

  let menu;
  try {
    menu = await loadMenuById(menuId);
  } catch {
    notFound();
  }

  const restaurant = await loadRestaurantById(restaurantId);
  const categories = await loadCategoriesForMenu(menuId);
  const rawItems = await loadMenuItemsForMenu(menuId);
  const items = rawItems.map((item) => ({
    ...item,
    preparations: (item.preparations ?? []) as { name: string; price_cents?: number }[],
    variations: (item.variations ?? []) as { name: string; price_cents?: number }[],
    sides: (item.sides ?? []) as { name: string; price_cents?: number }[],
    sauces: (item.sauces ?? []) as { name: string; price_cents?: number }[],
    image_urls: (item.image_urls ?? []) as string[],
    allergens: (item.allergens ?? []) as string[],
    labels: (item.labels ?? []) as string[],
  }));

  const isPublished = menu.status === "published";
  const publicUrl = menu.slug
    ? `/m/${restaurant.slug}/${menu.slug}`
    : `/m/${restaurant.slug}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={menu.name}
        description={`Menu workspace for ${restaurant.name}`}
        action={
          <Button variant="ghost" asChild>
            <Link href={`/restaurants/${restaurantId}/menus`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={isPublished ? "default" : "secondary"}>{menu.status}</Badge>
        <span className="text-sm text-muted-foreground">/{menu.slug}</span>

        {isPublished && (
          <Button variant="link" size="sm" className="ml-auto" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Preview
            </a>
          </Button>
        )}

        <form action={updateMenuStatus.bind(null, menuId, menu.status === "published" ? "draft" : "published")}>
          <Button type="submit" size="sm" variant={isPublished ? "outline" : "default"}>
            {isPublished ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Unpublish
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Publish
              </>
            )}
          </Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <MenuWorkspace
          menuId={menuId}
          restaurantId={restaurantId}
          initialCategories={categories}
          initialItems={items}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Add category</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={upsertCategory.bind(null, menuId)} className="flex gap-2">
                <Input name="name" placeholder="Category name" required className="flex-1" />
                <Button type="submit" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {menu.qr_assigned && menu.qr_url && (
            <Card>
              <CardContent className="flex justify-center pt-6">
                <Image
                  src={menu.qr_url}
                  alt="Menu QR Code"
                  width={128}
                  height={128}
                  className="w-32 h-32"
                  unoptimized
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
