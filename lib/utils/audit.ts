"use server";

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import type { Json } from "@/lib/database.types";

interface AuditEntry {
  action: string;
  target_table?: string;
  target_id?: string;
  diff?: Record<string, unknown>;
  org_id?: string;
  restaurant_id?: string;
}

export async function writeAudit(entry: AuditEntry) {
  try {
    // The actor comes from the user's session; the insert goes through the
    // admin client because audit_logs RLS is read-only for users (SELECT
    // policy only) — audit writes are service-side bookkeeping. Every caller
    // is a server action that has already performed its own authorization.
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") ?? headersList.get("x-real-ip") ?? null;
    const userAgent = headersList.get("user-agent") ?? null;

    const adminClient = createAdminClient();
    await adminClient.from("audit_logs").insert({
      actor_user_id: user?.id ?? null,
      org_id: entry.org_id ?? null,
      restaurant_id: entry.restaurant_id ?? null,
      action: entry.action,
      target_table: entry.target_table ?? null,
      target_id: entry.target_id ?? null,
      diff: (entry.diff ?? null) as Json,
      ip,
      user_agent: userAgent,
    });
  } catch (err) {
    // Audit logs should never break the user experience
    console.error("writeAudit failed:", err);
  }
}
