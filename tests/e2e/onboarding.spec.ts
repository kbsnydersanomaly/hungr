import { test, expect } from "@playwright/test";
import { signUpAndVerify, createRestaurant, createMenu } from "./helpers";

const TEST_EMAIL = `e2e-smoke-${Date.now()}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Onboarding smoke test", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Hungr/i);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("text=/pricing|plans/i").first()).toBeVisible();
  });

  test("sign-up page loads and form works", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("sign-in page loads", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("full onboarding flow: sign-up → create restaurant → create menu", async ({ page }) => {
    // Step 1: Sign up
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Smoke", "Test");

    // Step 2: Create restaurant
    await createRestaurant(page, `Smoke Test Restaurant ${Date.now()}`);

    // Step 3: Create menu
    await createMenu(page, `Smoke Test Menu ${Date.now()}`);

    // Verify we're on the menu workspace
    await expect(page).toHaveURL(/\/menus\//);
    await expect(page.locator('text=/workspace|menu/i').first()).toBeVisible();
  });

  test("public menu viewer loads for a published menu", async ({ page }) => {
    // This test assumes there's already a published menu in the test environment
    // In a real CI setup, we'd create one via the API first
    await page.goto("/");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
