"use client";

import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env.client";
import { Database } from "@/lib/database.types";

export function createBrowserClient() {
  return createSSRBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
