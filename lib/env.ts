import { z } from "zod";
import { clientSchema } from "@/lib/env.client";

export { clientSchema, getClientEnv, clientEnv } from "@/lib/env.client";

const isDev = process.env.NODE_ENV !== "production";

// ── Server-only schema ──────────────────────────────────────────────────
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, {
    message:
      "Required. For local Supabase: copy the 'service_role key' from `supabase status` into .env.local",
  }),
  PAYFAST_MERCHANT_ID: isDev
    ? z.string().min(1).optional().default("10013557")
    : z.string().min(1, "PAYFAST_MERCHANT_ID is required in production"),
  PAYFAST_MERCHANT_KEY: isDev
    ? z.string().min(1).optional().default("nn7rftlml9ki3")
    : z.string().min(1, "PAYFAST_MERCHANT_KEY is required in production"),
  PAYFAST_PASSPHRASE: z.string().optional(),
  PAYFAST_SANDBOX: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  MAIL_PROVIDER: z.enum(["brevo", "resend", "console"]).default("console"),
  MAIL_FROM: z.string().email().default("hello@hungr.app"),
  MAIL_FROM_NAME: z.string().default("Hungr"),
  BREVO_API_KEY: z
    .string()
    .optional()
    .transform((s) => (typeof s === "string" ? s.trim() : s)),
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((s) => (typeof s === "string" ? s.trim() : s)),
  INVOICE_NUMBER_PREFIX: z.string().default("HUNGR"),
  CRON_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const fullSchema = clientSchema.merge(serverSchema);

let serverCached: z.infer<typeof fullSchema> | null = null;

function reportErrors(label: string, result: { success: false; error: { issues: Array<{ path: PropertyKey[]; message: string }> } } | { success: true; data: unknown }) {
  if (result.success) return;
  const issues = result.error.issues.map(
    (i) => `  • ${i.path.join(".")}: ${i.message}`
  );
  console.error(`\n❌ ${label}\n`);
  issues.forEach((issue) => console.error(issue));
  console.error("\n📋 Quick fix:\n");
  console.error("   1. cp .env.example .env.local");
  console.error(
    "   2. For local Supabase, run `supabase status` and paste the credentials into .env.local\n"
  );
}

// ── Server env (full) ───────────────────────────────────────────────────
export function getEnv(): z.infer<typeof fullSchema> {
  if (serverCached) return serverCached;
  const parsed = fullSchema.safeParse(process.env);
  if (!parsed.success) {
    reportErrors("Server environment validation failed", parsed);
    throw new Error(
      `Server environment validation failed: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`
    );
  }
  serverCached = parsed.data;
  return serverCached;
}

// Lazy proxy — safe for server code
export const env = new Proxy({} as z.infer<typeof fullSchema>, {
  get(_, prop: string) {
    return getEnv()[prop as keyof z.infer<typeof fullSchema>];
  },
});
