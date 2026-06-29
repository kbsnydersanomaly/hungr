"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth/session";
import { safeAction, ValidationError } from "@/lib/errors";
import { UpdateProfileSchema } from "@/lib/schemas/profile";
import { normalizeSouthAfricanPhone } from "@/lib/utils/phone";

export async function updateProfile(formData: FormData) {
  return safeAction(async () => {
    const { user } = await requireSession();

    const raw = Object.fromEntries(formData);
    const parsedResult = UpdateProfileSchema.safeParse(raw);
    if (!parsedResult.success) {
      throw new ValidationError(parsedResult.error.issues[0].message);
    }
    const parsed = parsedResult.data;

    const normalizedPhone = parsed.phone
      ? normalizeSouthAfricanPhone(parsed.phone)
      : null;

    const supabase = await createServerClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.display_name,
        first_name: parsed.first_name ?? "",
        last_name: parsed.last_name ?? "",
        phone: normalizedPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) throw new Error(error.message);

    revalidatePath("/settings/profile");
    return { displayName: parsed.display_name };
  });
}
