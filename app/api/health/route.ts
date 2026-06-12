import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function GET() {
  const checks: Record<string, string> = {};
  let ok = true;

  // DB check
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("organizations").select("id").limit(1);
    checks.db = error ? `fail: ${error.message}` : "ok";
    if (error) ok = false;
  } catch (e) {
    checks.db = `fail: ${e instanceof Error ? e.message : "unknown"}`;
    ok = false;
  }

  // Brevo check (if configured)
  if (env.MAIL_PROVIDER === "brevo" && env.BREVO_API_KEY) {
    try {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": env.BREVO_API_KEY },
      });
      let detail = "";
      if (!res.ok) {
        const raw = await res.text();
        try {
          const body = JSON.parse(raw) as { message?: string; code?: string };
          detail = [body.code, body.message].filter(Boolean).join(": ");
        } catch {
          detail = raw.slice(0, 120);
        }
      }
      checks.brevo = res.ok ? "ok" : `fail: ${res.status}${detail ? ` — ${detail}` : ""}`;
      if (!res.ok) ok = false;
    } catch (e) {
      checks.brevo = `fail: ${e instanceof Error ? e.message : "unknown"}`;
      ok = false;
    }
  } else {
    checks.brevo = "skipped";
  }

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
