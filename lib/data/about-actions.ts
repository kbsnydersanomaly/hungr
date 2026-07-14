"use server";

import { revalidatePath } from "next/cache";
import { actionError, safeAction } from "@/lib/errors";
import { requireRestaurantAccess } from "@/lib/auth/role";
import { safeJsonParse } from "@/lib/utils/safeJsonParse";
import { writeAudit } from "@/lib/utils/audit";

export async function loadAboutPage(restaurantId: string) {
  const { supabase } = await requireRestaurantAccess(restaurantId, "staff");

  const { data, error } = await supabase
    .from("about_pages")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (error) {
    console.error("loadAboutPage error:", error);
    throw actionError("Failed to load about page", error);
  }

  return data;
}

export async function saveAboutPage(restaurantId: string, formData: FormData) {
  return safeAction(async () => {
    const { supabase } = await requireRestaurantAccess(restaurantId, "manager");

    const aboutText = String(formData.get("about_text") ?? "").trim() || null;
    const businessHours = String(formData.get("business_hours") ?? "").trim() || null;
    const email = String(formData.get("email") ?? "").trim() || null;
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const mainImageUrl = String(formData.get("main_image_url") ?? "").trim() || null;
    const galleryUrls = safeJsonParse<string[]>(String(formData.get("gallery_urls") ?? ""), []);
    const showBusinessHours = String(formData.get("show_business_hours") ?? "") === "on";
    const showContact = String(formData.get("show_contact") ?? "") === "on";

    const { error } = await supabase
      .from("about_pages")
      .upsert({
        restaurant_id: restaurantId,
        about_text: aboutText,
        business_hours: businessHours,
        email,
        phone,
        main_image_url: mainImageUrl,
        gallery_urls: galleryUrls,
        show_business_hours: showBusinessHours,
        show_contact: showContact,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("saveAboutPage error:", error);
      throw actionError("Failed to save about page", error);
    }

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", restaurantId)
      .maybeSingle();

    await writeAudit({
      action: "about.update",
      target_table: "about_pages",
      target_id: restaurantId,
      diff: { about_text: aboutText, email, phone },
    });

    revalidatePath(`/restaurants/${restaurantId}/about`);
    revalidatePath(`/restaurants/${restaurantId}`);
    if (restaurant?.slug) {
      revalidatePath(`/m/${restaurant.slug}`);
      revalidatePath(`/m/${restaurant.slug}/about`);
    }

    return { saved: true };
  });
}
