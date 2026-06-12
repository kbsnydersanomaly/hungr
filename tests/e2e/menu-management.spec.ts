import { test, expect } from "@playwright/test";
import {
  signUpAndVerify,
  createRestaurant,
  getFirstRestaurant,
  createMenu,
  createCategory,
  createMenuItem,
  openItemEditor,
  publishMenu,
} from "./helpers";

const RUN_ID = Date.now();
const TEST_EMAIL = `e2e-menu-${RUN_ID}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Menu management journey", () => {
  test.setTimeout(180_000);

  test("sign up → restaurant → menu → category → item → edit → publish → public menu", async ({
    page,
  }) => {
    // Sign up, confirm email (service role) and sign in.
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Menu", "Manager");

    // Create a restaurant (PayFast checkout is stubbed).
    await createRestaurant(page, `Menu E2E ${RUN_ID}`);
    const { id: restaurantId, slug } = await getFirstRestaurant(page);

    // Create a menu — lands on the menu workspace.
    const { menuId } = await createMenu(page, "Dinner", restaurantId);
    await expect(page).toHaveURL(new RegExp(`/menus/${menuId}`));

    // Add a category.
    await createCategory(page, "Burgers");

    // Add an item with an uploaded image.
    await createMenuItem(page, {
      name: "Classic Burger",
      price: "89.50",
      description: "Flame-grilled beef patty with cheddar",
      withImage: true,
    });

    // Edit the item: rename it and change the price.
    await openItemEditor(page, "Classic Burger");
    await page.locator("#item-name").fill("Deluxe Burger");
    await page.locator("#item-price").fill("99.00");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Deluxe Burger").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("R 99.00").first()).toBeVisible();

    // Publish the menu.
    await publishMenu(page);

    // The public menu shows the edited item.
    await page.goto(`/m/${slug}`);
    await expect(page.getByText("Deluxe Burger").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("R 99.00").first()).toBeVisible();
  });
});
