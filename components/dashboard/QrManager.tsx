"use client";

import { useState } from "react";
import Image from "next/image";
import { regenerateQr } from "@/lib/data/menu-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, QrCode, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MenuQr {
  id: string;
  name: string;
  slug: string;
  status: string;
  qr_assigned: boolean;
  qr_url: string | null;
}

interface QrManagerProps {
  restaurantSlug: string;
  menus: MenuQr[];
}

export function QrManager({ restaurantSlug, menus }: QrManagerProps) {
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  function downloadUrl(menuId: string, format: "png" | "svg") {
    return `/api/qr/${menuId}?format=${format}`;
  }

  const publicUrl = (menuSlug?: string) =>
    menuSlug
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/m/${restaurantSlug}/${menuSlug}`
      : `${typeof window !== "undefined" ? window.location.origin : ""}/m/${restaurantSlug}`;

  async function handleRegenerate(menuId: string) {
    setRegeneratingId(menuId);
    try {
      await regenerateQr(menuId);
      toast.success("QR code regenerated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to regenerate QR.");
    } finally {
      setRegeneratingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {menus.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No menus yet. Create a menu and publish it to generate a QR code.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {menus.map((menu) => (
            <Card key={menu.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold">{menu.name}</CardTitle>
                  <Badge variant={menu.status === "published" ? "default" : "secondary"}>
                    {menu.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {menu.qr_assigned && menu.qr_url ? (
                  <>
                    <div className="flex justify-center">
                      <Image
                        src={menu.qr_url}
                        alt={`QR code for ${menu.name}`}
                        width={160}
                        height={160}
                        className="h-40 w-40 object-contain"
                        unoptimized
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        asChild
                      >
                        <a href={downloadUrl(menu.id, "png")} download>
                          <Download className="h-4 w-4 mr-2" />
                          Download PNG
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        asChild
                      >
                        <a href={downloadUrl(menu.id, "svg")} download>
                          <Download className="h-4 w-4 mr-2" />
                          Download SVG
                        </a>
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <QrCode className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-1">
                      QR code not generated yet
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {menu.status === "published"
                        ? "Regenerate the QR code for this published menu"
                        : "Publish this menu to auto-generate a QR code"}
                    </p>
                    {menu.status === "published" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRegenerate(menu.id)}
                        disabled={regeneratingId === menu.id}
                      >
                        {regeneratingId === menu.id && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        {regeneratingId !== menu.id && (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Regenerate QR
                      </Button>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t">
                  <a
                    href={publicUrl(menu.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    {menu.slug ? `/${menu.slug}` : "/"}
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
