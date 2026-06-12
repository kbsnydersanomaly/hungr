import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { generateQrPng, generateQrSvg, getMenuQrUrl } from "@/lib/qr/generate";
import type { Database } from "@/lib/database.types";

type MenuWithRestaurant = Database["public"]["Tables"]["menus"]["Row"] & {
  restaurants: { slug: string } | null;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ menuId: string }> }
) {
  const { menuId } = await params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "png";

  const supabase = await createServerClient();

  const { data: menu, error } = await supabase
    .from("menus")
    .select("*, restaurants:restaurant_id(slug)")
    .eq("id", menuId)
    .returns<MenuWithRestaurant[]>()
    .maybeSingle();

  if (error || !menu) {
    return new NextResponse("Menu not found", { status: 404 });
  }

  const restaurantSlug = menu.restaurants?.slug ?? "";
  const url = getMenuQrUrl(restaurantSlug, menu.slug);

  if (format === "svg") {
    const svg = await generateQrSvg(url);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${menu.slug}-qr.svg"`,
      },
    });
  }

  const png = await generateQrPng(url);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${menu.slug}-qr.png"`,
    },
  });
}
