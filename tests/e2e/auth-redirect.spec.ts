import { test, expect } from "@playwright/test";

test.describe("Auth redirects", () => {
  test("unauthenticated /dashboard redirects to /sign-in with next param", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
  });

  test("legacy /sign-up redirects to /sign-in", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated /settings/profile redirects to /sign-in", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
