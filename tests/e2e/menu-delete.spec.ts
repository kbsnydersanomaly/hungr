import { test, expect } from "@playwright/test";
import {
  signUpAndVerify,
  createRestaurant,
  getFirstRestaurant,
  createMenu,
} from "./helpers";

const RUN_ID = Date.now();
const TEST_EMAIL = `e2e-delete-menu-${RUN_ID}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Menu deletion", () => {
  test.setTimeout(180_000);

  test("deleting a published menu removes it from the dashboard and its public URL returns 404", async ({
    page,
  }) => {
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Delete", "Menu");
    await createRestaurant(page, `Delete Menu E2E ${RUN_ID}`);
    const { id: restaurantId, slug: restaurantSlug } = await getFirstRestaurant(page);

    const restaurantName = `Delete Menu E2E ${RUN_ID}`;
    const menuName = `Menu To Delete ${RUN_ID}`;
    await createMenu(page, menuName, restaurantId);

    // Publish the menu with a longer timeout for the workspace action to refresh.
    const publishButton = page.getByRole("button", { name: "Publish", exact: true });
    await publishButton.waitFor({ state: "visible", timeout: 15000 });
    await publishButton.click();
    await expect(
      page.getByRole("button", { name: "Unpublish", exact: true })
    ).toBeVisible({ timeout: 30000 });

    // Read the menu slug from the dashboard card.
    await page.goto(`/restaurants/${restaurantId}/menus`);
    const menuCard = page.locator('[data-testid="menu-card"]', {
      hasText: menuName,
    });
    const slugLabel = await menuCard.locator("p.text-muted-foreground").textContent();
    const menuSlug = slugLabel?.replace("/", "").trim() ?? "";
    expect(menuSlug).not.toBe("");

    // The menu-specific public URL is reachable while published.
    await page.goto(`/m/${restaurantSlug}/${menuSlug}`);
    await expect(page.getByRole("heading", { name: restaurantName })).toBeVisible({
      timeout: 15000,
    });

    // Delete the menu from the dashboard list.
    await page.goto(`/restaurants/${restaurantId}/menus`);
    const menuCardForDelete = page.locator('[data-testid="menu-card"]', {
      hasText: menuName,
    });
    await menuCardForDelete.getByRole("button", { name: "Delete" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("This action is permanent")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(menuCardForDelete).not.toBeVisible({ timeout: 15000 });

    // The menu-specific public URL now renders the not-found page.
    await page.goto(`/m/${restaurantSlug}/${menuSlug}`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible({
      timeout: 15000,
    });
  });
});
