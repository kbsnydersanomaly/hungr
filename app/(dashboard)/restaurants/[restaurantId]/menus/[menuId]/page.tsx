import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  loadMenuById,
  loadCategoriesForMenu,
  loadSubcategoriesForMenu,
  loadMenuItemsForMenu,
  buildCategoryTree,
} from "@/lib/data/menus";
import { updateMenuStatus } from "@/lib/data/menu-actions";
import { loadRestaurantById } from "@/lib/data/restaurants";
import { requireRestaurantManagement } from "@/lib/billing/management-guard";
import { PageHeader } from "@/components/PageHeader";
import { ServerActionForm } from "@/components/forms/ServerActionForm";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddCategoryForm } from "@/components/menu/AddCategoryForm";
import { MenuWorkspace } from "@/components/menu/MenuWorkspace";
import { MenuNameEditor } from "@/components/menu/MenuNameEditor";
import { BulkUploadModal } from "@/components/menu/BulkUploadModal";
import { ExportMenuButton } from "@/components/menu/ExportMenuButton";
import { ArrowLeft, ExternalLink, Eye, EyeOff } from "lucide-react";

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
  await requireRestaurantManagement(restaurant);
  const [topCategories, subCategories] = await Promise.all([
    loadCategoriesForMenu(menuId),
    loadSubcategoriesForMenu(menuId),
  ]);
  const categories = buildCategoryTree(topCategories, subCategories);
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
        title={<MenuNameEditor menuId={menuId} name={menu.name} />}
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

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <div className="hidden lg:block">
            <BulkUploadModal menuId={menuId} restaurantId={restaurantId} />
          </div>
          <ExportMenuButton menuId={menuId} />

          {isPublished && (
            <Button variant="link" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Preview
              </a>
            </Button>
          )}

          <ServerActionForm action={updateMenuStatus.bind(null, menuId, menu.status === "published" ? "draft" : "published")}>
            <SubmitButton type="submit" size="sm" variant={isPublished ? "outline" : "default"}>
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
            </SubmitButton>
          </ServerActionForm>
        </div>
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
              <AddCategoryForm menuId={menuId} />
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
