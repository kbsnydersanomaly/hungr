import { Page, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";

// The e2e helpers use the Supabase service role to confirm user emails
// (local auth has enable_confirmations = true) — load the app's env files.
config({ path: resolve(__dirname, "../../.env.local") });
config({ path: resolve(__dirname, "../../.env") });

/** Tiny valid 1x1 PNG used for image-upload flows. */
export const TEST_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in .env.local) for e2e tests."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Marks a user as email-confirmed via the service role (no mailbox needed). */
export async function confirmUserByEmail(email: string) {
  const admin = adminClient();
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (match) {
      const { error: updateError } = await admin.auth.admin.updateUserById(
        match.id,
        { email_confirm: true }
      );
      if (updateError) throw updateError;
      return;
    }
    if (data.users.length < perPage) {
      throw new Error(`No auth user found for ${email}`);
    }
    page += 1;
  }
}

/** Fills and submits the sign-up form; waits for the confirmation notice. */
export async function signUp(
  page: Page,
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  await page.goto("/sign-up");
  await page.waitForSelector("form");

  await page.fill('input[name="firstName"]', firstName);
  await page.fill('input[name="lastName"]', lastName);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.fill('input[name="confirmPassword"]', password);

  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check your email")).toBeVisible({ timeout: 15000 });
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.waitForSelector("form");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

const SUPER_ADMIN_EMAIL = "superadmin-e2e@example.com";
const SUPER_ADMIN_PASSWORD = "TestPassword123!";

export async function loginAsSuperAdmin(page: Page) {
  const admin = adminClient();

  // Ensure the super-admin test user exists.
  const { data: existing } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });
  const alreadyExists = existing?.users.some(
    (u) => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );

  if (!alreadyExists) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (createError) throw createError;

    // Mark as super admin in profiles.
    const { error: profileError } = await admin
      .from("profiles")
      .update({ is_super_admin: true })
      .eq("id", created.user!.id);

    if (profileError) throw profileError;
  }

  await signIn(page, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
}

/** Full flow: sign up, confirm the email via service role, then sign in. */
export async function signUpAndVerify(
  page: Page,
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  await signUp(page, email, password, firstName, lastName);
  await confirmUserByEmail(email);
  await signIn(page, email, password);
}

/**
 * Stubs PayFast so restaurant creation (which redirects new orgs to checkout)
 * never depends on the external sandbox.
 */
export async function stubPayFast(page: Page) {
  await page.route(/payfast\.co\.za/, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body><h1>PayFast checkout stub</h1></body></html>",
    })
  );
}

export async function createRestaurant(page: Page, name: string) {
  await stubPayFast(page);
  await page.goto("/restaurants/new");
  await page.waitForSelector('input[name="name"]');

  await page.fill('input[name="name"]', name);
  await page.fill('input[name="street"]', "123 Test Street");
  await page.fill('input[name="city"]', "Cape Town");

  await page.click('button[type="submit"]');

  // Starter plan redirects to PayFast checkout (stubbed); orgs with an active
  // flat plan go straight to the restaurant page. The restaurant exists in
  // the database either way.
  await page.waitForURL(
    (url) => {
      try {
        const { hostname, pathname } = new URL(url);
        if (hostname.includes("payfast.co.za")) return true;
        return /^\/restaurants\/[0-9a-f-]{36}\/?$/i.test(pathname);
      } catch {
        return false;
      }
    },
    { timeout: 20000 }
  );
}

/** Reads the first restaurant's id and public slug from the dashboard list. */
export async function getFirstRestaurant(
  page: Page
): Promise<{ id: string; slug: string }> {
  await page.goto("/restaurants");

  const link = page.locator('a[href^="/restaurants/"]').first();
  await link.waitFor({ timeout: 10000 });
  const href = await link.getAttribute("href");
  const id = href?.match(/\/restaurants\/([0-9a-f-]{36})/i)?.[1];
  if (!id) throw new Error("Could not find restaurant ID on /restaurants");

  const slugText = await page.getByText(/Slug: \/m\//).first().textContent();
  const slug = slugText?.match(/Slug: \/m\/(\S+)/)?.[1];
  if (!slug) throw new Error("Could not find restaurant slug on /restaurants");

  return { id, slug };
}

/** Creates a menu and returns its workspace ids. */
export async function createMenu(
  page: Page,
  menuName: string,
  restaurantId?: string
): Promise<{ restaurantId: string; menuId: string }> {
  const rid = restaurantId ?? (await getFirstRestaurant(page)).id;

  await page.goto(`/restaurants/${rid}/menus/new`);
  await page.waitForSelector('input[name="name"]');
  await page.fill('input[name="name"]', menuName);
  await page.getByRole("button", { name: "Create menu" }).click();

  await page.waitForURL(/\/menus\/[0-9a-f-]{36}/i, { timeout: 15000 });
  const menuId = page.url().match(/\/menus\/([0-9a-f-]{36})/i)![1];
  return { restaurantId: rid, menuId };
}

/** Adds a category from the menu-workspace sidebar card. */
export async function createCategory(page: Page, name: string) {
  const input = page.getByPlaceholder("Category name");
  await input.fill(name);
  await input.locator("xpath=following-sibling::button").click();
  await expect(page.getByText(name, { exact: true })).toBeVisible({
    timeout: 10000,
  });
}

interface NewItem {
  name: string;
  price: string;
  description?: string;
  withImage?: boolean;
}

/**
 * Adds a menu item via the first "Add item" button on the workspace page
 * (i.e. into the first category). Optionally uploads an image through the
 * media library dialog.
 */
export async function createMenuItem(page: Page, item: NewItem) {
  await page.getByRole("button", { name: "Add item" }).first().click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Fill in the item details below.")).toBeVisible();

  await page.locator("#item-name").fill(item.name);
  await page.locator("#item-price").fill(item.price);
  if (item.description) {
    await page.locator("#item-desc").fill(item.description);
  }

  if (item.withImage) {
    const imageName = `e2e-item-${Date.now()}.png`;
    await sheet.getByRole("button", { name: "Add image" }).click();

    const mediaDialog = page
      .getByRole("dialog")
      .filter({ hasText: "Choose an image from your media library." });
    await mediaDialog.locator('input[type="file"]').setInputFiles({
      name: imageName,
      mimeType: "image/png",
      buffer: TEST_PNG,
    });

    // Uploaded image appears in the library; select it (click the tile —
    // the image itself is covered by a hover overlay) and confirm.
    const uploaded = mediaDialog.getByAltText(imageName);
    await expect(uploaded).toBeVisible({ timeout: 15000 });
    await mediaDialog
      .locator("div.cursor-pointer", { has: page.getByAltText(imageName) })
      .click();
    await mediaDialog.getByRole("button", { name: "Add image" }).click();
    await expect(mediaDialog).not.toBeVisible();
  }

  await sheet.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(sheet).not.toBeVisible({ timeout: 15000 });
  await expect(page.getByText(item.name).first()).toBeVisible({ timeout: 10000 });
}

/** Opens the edit sheet for an item row on the menu workspace. */
export async function openItemEditor(page: Page, itemName: string) {
  const row = page.locator("div.group", { hasText: itemName }).first();
  await row.hover();
  await row.locator("button:has(svg.lucide-pencil)").click();
  await expect(
    page.getByRole("dialog").getByText("Update the item details below.")
  ).toBeVisible();
}

/**
 * Sets a branding color through the editor's hex text input (next to the
 * color picker labeled "{roleLabel} color").
 */
export async function setBrandingColor(
  page: Page,
  roleLabel: string,
  hex: string
) {
  const colorInput = page.locator(`input[aria-label="${roleLabel} color"]`);
  const hexInput = colorInput.locator("xpath=following-sibling::input");
  await hexInput.fill(hex);
}

/** Publishes the menu from the workspace toolbar. */
export async function publishMenu(page: Page) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unpublish", exact: true })
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Marks the restaurant's subscription as active and restores the restaurant
 * status. Use this after createRestaurant in tests that need a public menu.
 */
export async function activateRestaurantSubscription(restaurantId: string) {
  const admin = adminClient();
  const now = new Date();
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: subError } = await admin
    .from("subscriptions")
    .update({
      status: "active",
      started_at: now.toISOString(),
      current_period_end: future.toISOString(),
      next_billing_date: future.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("scope", "restaurant")
    .eq("scope_id", restaurantId);

  if (subError) throw subError;

  const { error: restaurantError } = await admin
    .from("restaurants")
    .update({ status: "active", updated_at: now.toISOString() })
    .eq("id", restaurantId);

  if (restaurantError) throw restaurantError;
}

/**
 * Collects console errors that indicate React/Next.js rendering problems
 * (hydration mismatches, server-component event-handler errors, etc.).
 */
export function collectRenderingErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (
      /hydration|hydrating|didn't match|did not match|Event handlers cannot be passed/i.test(
        text
      )
    ) {
      errors.push(text);
    }
  });
  page.on("pageerror", (err) => {
    if (
      /hydration|didn't match|did not match|Event handlers cannot be passed/i.test(
        err.message
      )
    ) {
      errors.push(err.message);
    }
  });
  return errors;
}
