import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const getSession = cache(async () => {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { user, supabase } : null;
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}
