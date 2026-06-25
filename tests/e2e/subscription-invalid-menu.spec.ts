import { test, expect } from "@playwright/test";
import {
  signUpAndVerify,
  signIn,
  createRestaurant,
  getFirstRestaurant,
  seedPublishedMenu,
  activateRestaurantSubscription,
  adminClient,
} from "./helpers";

const TEST_PASSWORD = "TestPass123!";

test.describe("Invalid subscription hides public menu", () => {
  test.setTimeout(240_000);

  test("cancelled subscription returns 404 and shows dashboard banner", async ({
    page,
  }) => {
    const runId = Date.now();
    const testEmail = `e2e-invalid-sub-${runId}@hungr.test`;
    let restaurantId: string | undefined;

    try {
      // 1. Create a fully working restaurant + menu.
      await signUpAndVerify(page, testEmail, TEST_PASSWORD, "Invalid", "Sub");
      await createRestaurant(page, `Invalid Sub ${runId}`);
      const restaurant = await getFirstRestaurant(page);
      restaurantId = restaurant.id;
      const { slug } = restaurant;
      await activateRestaurantSubscription(restaurantId);
      await seedPublishedMenu(restaurantId, "Menu", "menu", [
        { name: "Test Burger", price: "75.00" },
      ]);

      // 2. Public menu is visible while active.
      let response = await page.goto(`/m/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByText("Test Burger")).toBeVisible({ timeout: 15000 });

      // 3. Cancel the subscription directly in the database.
      const admin = adminClient();
      const now = new Date().toISOString();
      const { error } = await admin
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: now,
          updated_at: now,
        })
        .eq("scope", "restaurant")
        .eq("scope_id", restaurantId);
      expect(error).toBeNull();

      // 4. Public menu now returns 404 and must not leak menu content.
      response = await page.goto(`/m/${slug}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByText(/page not found|not found/i)).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("Test Burger")).not.toBeVisible();

      // 5. Dashboard shows the persistent banner.
      await signIn(page, testEmail, TEST_PASSWORD);
      await expect(
        page.getByText("Your subscription was cancelled")
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("link", { name: "Billing settings" })
      ).toBeVisible();
    } finally {
      // Clean up test data: remove the restaurant and the auth user.
      const admin = adminClient();
      if (restaurantId) {
        await admin.from("restaurants").delete().eq("id", restaurantId);
      }
      const { data: users } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 100,
      });
      const user = users?.find((u) => u.email === testEmail);
      if (user) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
  });
});
