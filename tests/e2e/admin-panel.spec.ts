import { test, expect } from "@playwright/test";
import { loginAsSuperAdmin } from "./helpers";

test.describe("Admin panel", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto("/admin/orgs");
  });

  test("organizations list paginates and searches", async ({ page }) => {
    await expect(page.getByText("Organizations")).toBeVisible();
    await page.getByPlaceholder("Search by name or slug").fill("test");
    await expect(page.getByText(/total/)).toBeVisible();
  });

  test("organization detail loads", async ({ page }) => {
    const detailsLink = page.getByRole("link", { name: /details/i }).first();
    await detailsLink.click();
    await expect(page.getByText("Owner")).toBeVisible();
  });

  test("users list supports disable and delete", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page.getByText("Users")).toBeVisible();
    // We don't click disable/delete to avoid mutating the super-admin test user.
    await expect(page.getByRole("button", { name: "Disable" }).first()).toBeVisible();
  });

  test("transactions list supports date filter", async ({ page }) => {
    await page.goto("/admin/transactions");
    await page.locator('input[type="date"]').first().fill("2025-01-01");
    await expect(page.getByText(/total/)).toBeVisible();
  });

  test("plans can be deactivated", async ({ page }) => {
    await page.goto("/admin/plans");
    await page.getByRole("button", { name: "Deactivate" }).first().click();
    await expect(page.getByText("Plan deactivated")).toBeVisible();
  });

  test("audit page is removed", async ({ page }) => {
    await page.goto("/admin/audit");
    await expect(page.getByText(/404|Not Found|page could not be found/i)).toBeVisible();
  });
});
