import { test, expect } from "@playwright/test";
import {
  signUpAndVerify,
  createRestaurant,
  getFirstRestaurant,
  createMenu,
  createCategory,
  createCategoryItem,
  createSubcategory,
  createSubcategoryItem,
  publishMenu,
} from "./helpers";

const RUN_ID = Date.now();
const TEST_EMAIL = `e2e-subcat-${RUN_ID}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Sub-categories", () => {
  test.setTimeout(180_000);

  test("category → sub-category → item flows through to the public menu", async ({
    page,
  }) => {
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Sub", "Cat");
    await createRestaurant(page, `SubCat E2E ${RUN_ID}`);
    const { id: restaurantId, slug } = await getFirstRestaurant(page);
    await createMenu(page, "Dinner", restaurantId);

    // Top-level category (unique name — createMenu seeds Starters/Mains/Desserts).
    await createCategory(page, "Pizzas");

    // A direct item in the top-level category.
    await createCategoryItem(page, "Pizzas", {
      name: "Classic Margherita",
      price: "110.00",
    });

    // A sub-category under "Pizzas" with its own item.
    await createSubcategory(page, "Pizzas", "Wood-Fired");
    await createSubcategoryItem(page, "Wood-Fired", {
      name: "Spicy Diavola",
      price: "125.00",
    });

    await publishMenu(page);

    // Public menu: selecting the top-level category shows both items.
    await page.goto(`/m/${slug}`);
    await page.getByRole("button", { name: "Pizzas", exact: true }).click();
    await expect(page.getByText("Classic Margherita").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Spicy Diavola").first()).toBeVisible();

    // The sub-category pill row appears; selecting "Wood-Fired" narrows to it.
    await page.getByRole("button", { name: "Wood-Fired", exact: true }).click();
    await expect(page.getByText("Spicy Diavola").first()).toBeVisible();
    await expect(page.getByText("Classic Margherita")).toHaveCount(0);

    // "All Pizzas" restores both.
    await page.getByRole("button", { name: "All Pizzas", exact: true }).click();
    await expect(page.getByText("Classic Margherita").first()).toBeVisible();
    await expect(page.getByText("Spicy Diavola").first()).toBeVisible();
  });
});
