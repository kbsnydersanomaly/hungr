import { z } from "zod";

// ── Client-safe schema (NEXT_PUBLIC_ only) ──────────────────────────────
// This file is intentionally separate from `lib/env.ts` so that "use client"
// modules never pull the server-only `env` proxy into the browser bundle —
// React Fast Refresh enumerates module exports and would otherwise trigger
// server env validation on the client.
export const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({
    message:
      "Required. For local Supabase: copy the 'API URL' from `supabase status` into .env.local",
  }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, {
    message:
      "Required. For local Supabase: copy the 'anon key' from `supabase status` into .env.local",
  }),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
});

let clientCached: z.infer<typeof clientSchema> | null = null;

// ── Browser-safe env ────────────────────────────────────────────────────
export function getClientEnv(): z.infer<typeof clientSchema> {
  if (clientCached) return clientCached;

  // Read each var individually so Next.js's bundler inlines them correctly
  const input = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  };

  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `  • ${i.path.join(".")}: ${i.message}`
    );
    console.error(
      `\n❌ Client environment validation failed\n\n${issues.join("\n")}\n`
    );
    throw new Error(
      `Client environment validation failed: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join(", ")}`
    );
  }
  clientCached = parsed.data;
  return clientCached;
}

// Lazy proxy — safe for client / "use client" code
export const clientEnv = new Proxy({} as z.infer<typeof clientSchema>, {
  get(_, prop: string) {
    return getClientEnv()[prop as keyof z.infer<typeof clientSchema>];
  },
});
