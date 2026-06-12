/**
 * Mark a Supabase Auth user as email-confirmed without sending mail.
 * Uses the service role key — run only in trusted environments.
 *
 * Usage:
 *   pnpm db:confirm-user <email@example.com>
 *   pnpm db:confirm-user <auth-user-uuid>
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findUserIdByEmail(email: string): Promise<string | null> {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const arg = process.argv[2]?.trim();
  if (!arg) {
    console.error("Usage: pnpm db:confirm-user <email|user-uuid>");
    process.exit(1);
  }

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
    process.exit(1);
  }

  let userId: string;
  if (UUID_RE.test(arg)) {
    userId = arg;
  } else {
    console.log(`Looking up user by email: ${arg}`);
    const id = await findUserIdByEmail(arg);
    if (!id) {
      console.error("No auth user found with that email.");
      process.exit(1);
    }
    userId = id;
  }

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });

  if (error) {
    console.error("Failed to confirm user:", error.message);
    process.exit(1);
  }

  console.log("Email confirmed for:", data.user.email ?? userId);
}

main();
