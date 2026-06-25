import { test, expect } from "@playwright/test";
import {
  signUpAndVerify,
  signIn,
  createRestaurant,
  getFirstRestaurant,
  activateRestaurantSubscription,
  adminClient,
} from "./helpers";

const TEST_PASSWORD = "TestPass123!";

test.describe("Unpaid subscription dashboard access", () => {
  test.setTimeout(240_000);

  test("cancelled subscription blocks management routes but keeps billing accessible", async ({
    page,
  }) => {
    const runId = Date.now();
    const testEmail = `e2e-unpaid-${runId}@hungr.test`;
    let restaurantId: string | undefined;

    try {
      await signUpAndVerify(page, testEmail, TEST_PASSWORD, "Unpaid", "User");
      await createRestaurant(page, `Unpaid ${runId}`);
      const restaurant = await getFirstRestaurant(page);
      restaurantId = restaurant.id;
      await activateRestaurantSubscription(restaurantId);

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

      await signIn(page, testEmail, TEST_PASSWORD);
      await page.goto(`/restaurants/${restaurantId}/menus`);
      await page.waitForURL(
        new RegExp(
          `/restaurants/${restaurantId}/billing\\?reason=subscription_required`
        ),
        { timeout: 15000 }
      );

      await expect(
        page.getByText("Restaurant management is locked")
      ).toBeVisible({ timeout: 15000 });

      await page.goto(`/restaurants/${restaurantId}/billing`);
      await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible({
        timeout: 15000,
      });
    } finally {
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

  test("pending subscription allows management and shows retry banner", async ({
    page,
  }) => {
    const runId = Date.now();
    const testEmail = `e2e-pending-${runId}@hungr.test`;
    let restaurantId: string | undefined;

    try {
      await signUpAndVerify(page, testEmail, TEST_PASSWORD, "Pending", "User");
      await createRestaurant(page, `Pending ${runId}`);
      const restaurant = await getFirstRestaurant(page);
      restaurantId = restaurant.id;

      await signIn(page, testEmail, TEST_PASSWORD);
      await page.goto(`/restaurants/${restaurantId}/menus`);
      await expect(page.getByRole("heading", { name: "Menus" })).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByText("Payment pending — click here to retry")
      ).toBeVisible({ timeout: 15000 });
    } finally {
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
