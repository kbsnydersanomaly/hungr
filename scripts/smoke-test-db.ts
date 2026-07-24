/**
 * Runtime smoke tests for a freshly bootstrapped database (roadmap P0-E1c;
 * design docs/superpowers/specs/2026-07-24-database-bootstrap-design.md §7).
 *
 * A schema diff cannot see the non-public objects the squashed baseline carries
 * (§1.4): the auth.users provisioning trigger, the populated review_stats
 * matview, and the five storage buckets with their policies. Each of those is
 * exercised here against the real API, as the real role, so a baseline that
 * silently dropped one fails loudly.
 *
 * Local-only: it creates and deletes users, organisations, and storage objects.
 *
 * Usage: pnpm db:smoke   (after `pnpm db:bootstrap`)
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl } from "./supabase-local";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const PASSWORD = "smoke-password-123";
const PREFIX = "db-smoke";
/** A 1x1 transparent PNG — smallest payload that storage treats as an image. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

const results: { name: string; ok: boolean; detail?: string }[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
}

function admin(): SupabaseClient {
  return createClient(URL_, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Create a confirmed user, replacing any leftover from a crashed run. */
async function createUser(email: string): Promise<string> {
  const db = admin();
  const { data: existing } = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) await db.auth.admin.deleteUser(existing.id);

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL_, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

async function main(): Promise<void> {
  if (!URL_ || !ANON_KEY || !SERVICE_KEY) {
    throw new Error(
      "db:smoke requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  assertLocalSupabaseUrl(URL_, "NEXT_PUBLIC_SUPABASE_URL");

  const db = admin();
  const stamp = Date.now().toString(36);
  const managerEmail = `${PREFIX}-manager-${stamp}@hungr.test`;
  const outsiderEmail = `${PREFIX}-outsider-${stamp}@hungr.test`;
  const superEmail = `${PREFIX}-super-${stamp}@hungr.test`;

  let orgId: string | undefined;
  let restaurantId: string | undefined;
  const userIds: string[] = [];
  const objects: { bucket: string; path: string }[] = [];

  try {
    // 1. auth.users provisioning trigger — a new signup must produce a profile.
    const managerId = await createUser(managerEmail);
    userIds.push(managerId);
    const { data: profile } = await db
      .from("profiles")
      .select("id, email")
      .eq("id", managerId)
      .maybeSingle();
    check(
      "signup creates a profiles row (auth.users trigger)",
      profile?.email === managerEmail,
      profile ? `email was ${profile.email}` : "no profiles row"
    );

    // Fixtures for everything below.
    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({
        name: "DB Smoke Org",
        slug: `${PREFIX}-org-${stamp}`,
        owner_id: managerId,
      })
      .select("id")
      .single();
    if (orgError) throw orgError;
    orgId = org.id;
    await db
      .from("organization_members")
      .insert({ org_id: orgId, user_id: managerId, role: "owner" });

    const { data: restaurant, error: restaurantError } = await db
      .from("restaurants")
      .insert({
        org_id: orgId,
        name: "DB Smoke Restaurant",
        slug: `${PREFIX}-restaurant-${stamp}`,
      })
      .select("id")
      .single();
    if (restaurantError) throw restaurantError;
    restaurantId = restaurant.id;

    const { data: menu, error: menuError } = await db
      .from("menus")
      .insert({
        restaurant_id: restaurantId,
        name: "Smoke Menu",
        slug: `${PREFIX}-menu-${stamp}`,
      })
      .select("id")
      .single();
    if (menuError) throw menuError;

    const { data: category, error: categoryError } = await db
      .from("categories")
      .insert({ menu_id: menu.id, name: "Smoke Category" })
      .select("id")
      .single();
    if (categoryError) throw categoryError;

    const { data: item, error: itemError } = await db
      .from("menu_items")
      .insert({
        menu_id: menu.id,
        category_id: category.id,
        name: "Smoke Item",
        price_cents: 1000,
      })
      .select("id")
      .single();
    if (itemError) throw itemError;

    // 2. review_stats must be populated, or the reviews_after_change statement
    //    trigger's CONCURRENT refresh aborts every write touching reviews.
    const publicClient = createClient(URL_, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: reviewError } = await publicClient.from("reviews").insert({
      restaurant_id: restaurantId,
      menu_item_id: item.id,
      customer_name: "Smoke Tester",
      message: "Bootstrap smoke test review.",
      rating: 5,
    });
    check(
      "public review insert succeeds (review_stats populated)",
      !reviewError,
      reviewError?.message
    );

    // 3. menu-media bucket + manager policy.
    const manager = await signIn(managerEmail);
    const menuMediaPath = `${restaurantId}/${PREFIX}-${stamp}.png`;
    const { error: menuMediaError } = await manager.storage
      .from("menu-media")
      .upload(menuMediaPath, PNG, { contentType: "image/png" });
    if (!menuMediaError) objects.push({ bucket: "menu-media", path: menuMediaPath });
    check(
      "restaurant manager uploads to menu-media",
      !menuMediaError,
      menuMediaError?.message
    );

    const outsiderId = await createUser(outsiderEmail);
    userIds.push(outsiderId);
    const outsider = await signIn(outsiderEmail);
    const { error: outsiderUploadError } = await outsider.storage
      .from("menu-media")
      .upload(`${restaurantId}/${PREFIX}-outsider-${stamp}.png`, PNG, {
        contentType: "image/png",
      });
    check(
      "non-member is refused by the menu-media policy",
      Boolean(outsiderUploadError),
      "upload unexpectedly succeeded"
    );

    // 4. help-media bucket + super-admin policy. This is the object the squash
    //    was most likely to drop (design §1.4), so it is proven, not inspected.
    const superId = await createUser(superEmail);
    userIds.push(superId);
    await db.from("profiles").update({ is_super_admin: true }).eq("id", superId);
    const superAdmin = await signIn(superEmail);
    const helpMediaPath = `${PREFIX}-help-${stamp}.png`;
    const { error: helpMediaError } = await superAdmin.storage
      .from("help-media")
      .upload(helpMediaPath, PNG, { contentType: "image/png" });
    if (!helpMediaError) objects.push({ bucket: "help-media", path: helpMediaPath });
    check(
      "super admin uploads a help-article image to help-media",
      !helpMediaError,
      helpMediaError?.message
    );

    const { error: nonSuperHelpError } = await manager.storage
      .from("help-media")
      .upload(`${PREFIX}-help-denied-${stamp}.png`, PNG, {
        contentType: "image/png",
      });
    check(
      "non-super-admin is refused by the help-media policy",
      Boolean(nonSuperHelpError),
      "upload unexpectedly succeeded"
    );

    // 5. invoices bucket: written by the service role, read by an org admin.
    const invoicePath = `${orgId}/${PREFIX}-invoice-${stamp}.pdf`;
    const { error: invoiceWriteError } = await db.storage
      .from("invoices")
      .upload(invoicePath, Buffer.from("%PDF-1.4 smoke test\n"), {
        contentType: "application/pdf",
      });
    if (!invoiceWriteError) objects.push({ bucket: "invoices", path: invoicePath });
    check(
      "service role writes an invoice PDF",
      !invoiceWriteError,
      invoiceWriteError?.message
    );

    const { data: invoiceBlob, error: invoiceReadError } = await manager.storage
      .from("invoices")
      .download(invoicePath);
    check(
      "org admin downloads the invoice (invoices read policy)",
      !invoiceReadError && (invoiceBlob?.size ?? 0) > 0,
      invoiceReadError?.message ?? "empty download"
    );

    const { error: outsiderInvoiceError } = await outsider.storage
      .from("invoices")
      .download(invoicePath);
    check(
      "non-member is refused the invoice download",
      Boolean(outsiderInvoiceError),
      "download unexpectedly succeeded"
    );
  } finally {
    for (const object of objects) {
      await db.storage.from(object.bucket).remove([object.path]);
    }
    if (orgId) await db.from("organizations").delete().eq("id", orgId);
    for (const id of userIds) await db.auth.admin.deleteUser(id);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\ndb:smoke: ${results.length - failed.length}/${results.length} checks passed.`
  );
  if (failed.length > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      `\ndb:smoke failed: ${error instanceof Error ? error.message : error}`
    );
    process.exit(1);
  });
}
