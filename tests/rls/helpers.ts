import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../.env.local") });
config({ path: resolve(__dirname, "../../.env") });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// These specs create and delete users/orgs with the service-role key. With
// `pnpm env:remote` active, .env.local points at the HOSTED project — refuse
// to run there rather than write test fixtures into a shared database.
// Set RLS_ALLOW_REMOTE=1 to override deliberately.
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(URL ?? "");
if (!isLocal && process.env.RLS_ALLOW_REMOTE !== "1") {
  throw new Error(
    `RLS tests refused to run: NEXT_PUBLIC_SUPABASE_URL (${URL}) is not a local ` +
      "Supabase instance. Switch with `pnpm env:local`, or set RLS_ALLOW_REMOTE=1 " +
      "if you really mean to run against a remote database."
  );
}

export function adminClient() {
  return createClient(URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function anonClient() {
  return createClient(URL, ANON_KEY);
}

export async function createTestUser(email: string, password: string) {
  const admin = adminClient();
  // A crashed previous run (beforeAll threw before afterAll could clean up)
  // can leave this user behind — remove it so fixtures are idempotent.
  // Deleting the auth user cascades to its profile and owned organizations.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) await admin.auth.admin.deleteUser(existing.id);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!;
}

export async function signInAs(email: string, password: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export async function cleanupUser(userId: string | undefined) {
  if (!userId) return;
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}

export async function cleanupOrg(orgId: string | undefined) {
  if (!orgId) return;
  const admin = adminClient();
  await admin.from("organizations").delete().eq("id", orgId);
}
