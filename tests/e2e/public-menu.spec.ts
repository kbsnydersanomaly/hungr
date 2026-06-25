import { test, expect } from "@playwright/test";
import {
  signUpAndVerify,
  createRestaurant,
  getFirstRestaurant,
  activateRestaurantSubscription,
  seedPublishedMenu,
  adminClient,
  collectRenderingErrors,
  TEST_PNG,
} from "./helpers";

const RUN_ID = Date.now();
const TEST_EMAIL = `e2e-public-${RUN_ID}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Public menu", () => {
  test.setTimeout(240_000);

  test("menu renders cleanly, images are contained, item detail works", async ({
    page,
  }) => {
    // Setup: published menu with two items (the second one makes the item
    // detail page render its "You might also like" recommendations, which
    // previously crashed with a server-component event-handler error).
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Public", "Viewer");
    await createRestaurant(page, `Public E2E ${RUN_ID}`);
    const { id: restaurantId, slug } = await getFirstRestaurant(page);
    await activateRestaurantSubscription(restaurantId);
    await seedPublishedMenu(restaurantId, "All Day", "all-day", [
      {
        name: "Sushi Platter",
        price: "1234.56",
        description: "Twelve-piece chef selection",
        imageUrl: `data:image/png;base64,${TEST_PNG.toString("base64")}`,
      },
      {
        name: "Miso Soup",
        price: "45.00",
      },
    ]);

    // Visit the public menu, watching for hydration / rendering errors.
    const renderingErrors = collectRenderingErrors(page);
    await page.goto(`/m/${slug}`);

    // Items render with deterministic price formatting (regression test for
    // the locale-dependent hydration mismatch).
    await expect(page.getByText("Sushi Platter")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("R 1 234.56")).toBeVisible();

    // The item image is cropped to the card instead of rendering at the
    // source image's full size.
    const card = page.locator('a[href*="/item/"]', { hasText: "Sushi Platter" });
    const image = card.locator("img").first();
    await expect(image).toBeVisible();
    const wrapperPosition = await image.evaluate(
      (el) => getComputedStyle(el.parentElement!).position
    );
    expect(wrapperPosition).toBe("relative");
    const cardBox = (await card.boundingBox())!;
    const imageBox = (await image.boundingBox())!;
    expect(imageBox.width).toBeLessThanOrEqual(cardBox.width + 1);
    expect(imageBox.height).toBeLessThanOrEqual(cardBox.height + 1);

    // The mobile menu (hamburger sheet) opens and shows navigation.
    await page.locator("header button:has(svg.lucide-menu)").click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("About")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible();

    // Navigating to an item detail page works (regression test for
    // "Event handlers cannot be passed to Client Component props").
    await card.click();
    await page.waitForURL(/\/item\//, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Sushi Platter" })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Something went wrong")).not.toBeVisible();

    // Recommendations render (server page using the client ItemCard).
    await expect(page.getByText("You might also like")).toBeVisible();
    await expect(page.getByText("Miso Soup")).toBeVisible();

    // Back to the menu via a recommended item link.
    await page.getByText("Miso Soup").click();
    await page.waitForURL(/\/item\//, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Miso Soup" })
    ).toBeVisible({ timeout: 15000 });

    expect(renderingErrors).toEqual([]);

    // Clean up.
    const admin = adminClient();
    await admin.from("restaurants").delete().eq("id", restaurantId);
    const { data: users } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });
    const user = users?.find((u) => u.email === TEST_EMAIL);
    if (user) await admin.auth.admin.deleteUser(user.id);
  });
});
