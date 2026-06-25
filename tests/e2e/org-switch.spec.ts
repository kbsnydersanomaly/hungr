import { test, expect } from "@playwright/test";
import { signUpAndVerify, adminClient } from "./helpers";

const TEST_EMAIL = `e2e-orgswitch-${Date.now()}@hungr.test`;
const TEST_PASSWORD = "TestPass123!";
const ORG_B_NAME = `Switcher Org B ${Date.now()}`;

/**
 * Creates a second organization owned by the given user and adds them as an
 * owner member, so the sidebar OrgSwitcher renders its multi-org dropdown.
 */
async function seedSecondOrg(email: string, name: string) {
  const admin = adminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (profileError || !profile) {
    throw profileError ?? new Error(`No profile for ${email}`);
  }

  const slug = `switcher-b-${Date.now()}`;
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name, slug, owner_id: profile.id })
    .select("id")
    .single();
  if (orgError || !org) {
    throw orgError ?? new Error("Failed to seed second org");
  }

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ org_id: org.id, user_id: profile.id, role: "owner" });
  if (memberError) throw memberError;

  return { orgId: org.id, name };
}

test.describe("Organisation switcher", () => {
  test("a member of two orgs can switch and the choice persists", async ({
    page,
  }) => {
    await signUpAndVerify(page, TEST_EMAIL, TEST_PASSWORD, "Switch", "Test");
    await seedSecondOrg(TEST_EMAIL, ORG_B_NAME);

    await page.goto("/dashboard");

    const sidebar = page.locator("aside");
    // The switcher trigger carries the chevrons-up-down icon once >1 org exists.
    const switcher = sidebar.locator("button:has(svg.lucide-chevrons-up-down)");
    await expect(switcher).toBeVisible();

    // Switch to org B from the dropdown.
    await switcher.click();
    await page.getByRole("menuitem").filter({ hasText: ORG_B_NAME }).click();

    // setActiveOrg redirects to /dashboard; the switcher now shows org B.
    await page.waitForURL(/\/dashboard/);
    await expect(sidebar.getByText(ORG_B_NAME)).toBeVisible();

    // The selection persists across navigation (cookie-backed).
    await page.reload();
    await expect(sidebar.getByText(ORG_B_NAME)).toBeVisible();
  });
});
