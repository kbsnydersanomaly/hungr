import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function generateQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: 800,
    margin: 2,
    color: {
      dark: "#181818",
      light: "#FFFFFF",
    },
  });
}

export async function generateQrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 2,
    color: {
      dark: "#181818",
      light: "#FFFFFF",
    },
  });
}

export function getMenuQrUrl(restaurantSlug: string, menuSlug?: string): string {
  const base = env.NEXT_PUBLIC_APP_URL;
  return menuSlug
    ? `${base}/m/${restaurantSlug}/${menuSlug}`
    : `${base}/m/${restaurantSlug}`;
}

type MenuForQr = {
  id: string;
  restaurant_id: string;
  slug: string;
};

export async function generateAndStoreMenuQr(
  menu: MenuForQr,
  restaurantSlug: string
): Promise<{ qrUrl: string }> {
  const url = getMenuQrUrl(restaurantSlug, menu.slug);
  const png = await generateQrPng(url);
  const path = `${menu.restaurant_id}/${menu.id}.png`;

  const adminClient = createAdminClient();
  const { error: uploadError } = await adminClient.storage
    .from("menu-media")
    .upload(path, png, { contentType: "image/png", upsert: true });

  if (uploadError) {
    throw new Error(`Failed to upload QR code: ${uploadError.message}`);
  }

  const { data: publicUrlData } = adminClient.storage.from("menu-media").getPublicUrl(path);
  return { qrUrl: publicUrlData.publicUrl };
}
