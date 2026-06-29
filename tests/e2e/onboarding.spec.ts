import { test, expect } from "@playwright/test";
import { signUpAndVerify, createRestaurant, createMenu } from "./helpers";

const TEST_EMAIL = `e2e-smoke-${Date.now()}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Onboarding smoke test", () => {
  test("unauthenticated root redirects to /sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated /pricing redirects to /sign-in", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("sign-in page loads and sign-up mode is accessible", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await page.getByRole("button", { name: /sign up/i }).click();
    await expect(page.locator('input[name="phone"]')).toBeVisible();
  });

  test("full onboarding flow: sign-up → create restaurant → create menu", async ({ page }) => {
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Smoke", "Test");
    await createRestaurant(page, `Smoke Test Restaurant ${Date.now()}`);
    await createMenu(page, `Smoke Test Menu ${Date.now()}`);
    await expect(page).toHaveURL(/\/menus\//);
    await expect(page.locator('text=/workspace|menu/i').first()).toBeVisible();
  });

});
