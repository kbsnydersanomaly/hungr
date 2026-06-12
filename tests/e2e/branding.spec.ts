import { test, expect } from "@playwright/test";
import {
  signUpAndVerify,
  createRestaurant,
  getFirstRestaurant,
  createMenu,
  createMenuItem,
  publishMenu,
  setBrandingColor,
  collectRenderingErrors,
} from "./helpers";

const RUN_ID = Date.now();
const TEST_EMAIL = `e2e-branding-${RUN_ID}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";

test.describe("Branding editor", () => {
  test.setTimeout(240_000);

  test("grouped controls, nav icon contrast in live preview, publish", async ({
    page,
  }) => {
    const renderingErrors = collectRenderingErrors(page);

    // Setup: account, restaurant and a published menu (the preview iframe
    // renders the public menu, which needs a published menu to show a header).
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Brand", "Owner");
    await createRestaurant(page, `Branding E2E ${RUN_ID}`);
    const { id: restaurantId, slug } = await getFirstRestaurant(page);
    await createMenu(page, "Main Menu", restaurantId);
    await createMenuItem(page, { name: "Test Dish", price: "1234.56" });
    await publishMenu(page);

    // Open the branding page.
    await page.goto(`/restaurants/${restaurantId}/branding`);

    // Controls are grouped: nav + logo together, typography together.
    await expect(page.getByText("Nav bar & logo")).toBeVisible();
    await expect(page.getByText("Colors", { exact: true })).toBeVisible();
    await expect(page.getByText("Typography")).toBeVisible();
    await expect(page.getByText("Heading font")).toBeVisible();
    await expect(page.getByText("Body font")).toBeVisible();

    const preview = page.frameLocator('iframe[title="Menu preview"]');
    const header = preview.locator("header");
    await expect(header).toBeVisible({ timeout: 30000 });

    // Dark nav bar color → white icons/text in the preview.
    await setBrandingColor(page, "Nav bar", "#111111");
    await expect(header).toHaveCSS("background-color", "rgb(17, 17, 17)", {
      timeout: 15000,
    });
    await expect(header).toHaveCSS("color", "rgb(255, 255, 255)");

    // Light nav bar color → near-black icons/text.
    await setBrandingColor(page, "Nav bar", "#F7F7F7");
    await expect(header).toHaveCSS("background-color", "rgb(247, 247, 247)", {
      timeout: 15000,
    });
    await expect(header).toHaveCSS("color", "rgb(24, 24, 24)");

    // Switch back to dark and publish.
    await setBrandingColor(page, "Nav bar", "#111111");
    await expect(header).toHaveCSS("background-color", "rgb(17, 17, 17)", {
      timeout: 15000,
    });
    await page.getByRole("button", { name: "Publish changes" }).click();
    await expect(page.getByText("Branding published")).toBeVisible({
      timeout: 15000,
    });

    // The published (server-rendered) public menu uses the dark nav bar with
    // white foreground — no client-side override needed.
    await page.goto(`/m/${slug}`);
    const liveHeader = page.locator("header");
    await expect(liveHeader).toHaveCSS("background-color", "rgb(17, 17, 17)", {
      timeout: 15000,
    });
    await expect(liveHeader).toHaveCSS("color", "rgb(255, 255, 255)");

    // No hydration or server-component errors anywhere along the way
    // (includes console output from the preview iframe).
    expect(renderingErrors).toEqual([]);
  });
});
