# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public-menu.spec.ts >> Public menu >> menu renders cleanly, images are contained, item detail works
- Location: tests/e2e/public-menu.spec.ts:20:7

# Error details

```
Test timeout of 240000ms exceeded.
```

```
Error: locator.click: Test timeout of 240000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Add item' }).first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Hungr" [ref=e5] [cursor=pointer]:
        - /url: /
        - img "Hungr" [ref=e6]
      - navigation [ref=e7]:
        - link "Overview" [ref=e8] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4
          - img [ref=e9]
          - text: Overview
        - link "Insights" [ref=e14] [cursor=pointer]:
          - /url: /insights
          - img [ref=e15]
          - text: Insights
        - link "Menus" [ref=e17] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/menus
          - img [ref=e18]
          - text: Menus
        - link "Specials" [ref=e23] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/specials
          - img [ref=e24]
          - text: Specials
        - link "Branding" [ref=e26] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/branding
          - img [ref=e27]
          - text: Branding
        - link "About" [ref=e33] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/about
          - img [ref=e34]
          - text: About
        - link "QR Codes" [ref=e36] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/qr
          - img [ref=e37]
          - text: QR Codes
        - link "Reviews" [ref=e43] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/reviews
          - img [ref=e44]
          - text: Reviews
        - link "Media" [ref=e46] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/media
          - img [ref=e47]
          - text: Media
        - link "Team" [ref=e51] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/team
          - img [ref=e52]
          - text: Team
        - link "Billing" [ref=e57] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/billing
          - img [ref=e58]
          - text: Billing
        - link "Settings" [ref=e60] [cursor=pointer]:
          - /url: /restaurants/90d68a31-172e-4fec-858e-35b898f3b0b4/settings
          - img [ref=e61]
          - text: Settings
      - generic [ref=e65]:
        - paragraph [ref=e66]: Organization
        - link "Public Viewer's Organization" [ref=e67] [cursor=pointer]:
          - /url: /settings/organization
    - generic [ref=e68]:
      - banner [ref=e69]:
        - generic [ref=e70]:
          - generic [ref=e71]: Dashboard
          - img [ref=e72]
          - link "Public Viewer's Organization" [ref=e74] [cursor=pointer]:
            - /url: /settings/organization
          - img [ref=e75]
          - button "Public E2E 1782298458765" [ref=e77] [cursor=pointer]:
            - text: Public E2E 1782298458765
            - img [ref=e78]
        - generic [ref=e80]:
          - button "Notifications" [ref=e81] [cursor=pointer]:
            - img [ref=e82]
          - button "Account menu" [ref=e85] [cursor=pointer]: E
      - main [ref=e86]:
        - generic [ref=e87]:
          - heading "Something went wrong" [level=2] [ref=e88]
          - paragraph [ref=e89]: "Functions are not valid as a child of Client Components. This may happen if you return children instead of <children /> from render. Or maybe you meant to call this function rather than return it. <... action=... children={function children}> ^^^^^^^^^^^^^^^^^^^"
          - button "Try again" [ref=e90]
  - region "Notifications alt+T"
  - generic [ref=e95] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e96]:
      - img [ref=e97]
    - generic [ref=e100]:
      - button "Open issues overlay" [ref=e101]:
        - generic [ref=e102]:
          - generic [ref=e103]: "0"
          - generic [ref=e104]: "1"
        - generic [ref=e105]: Issue
      - button "Collapse issues badge" [ref=e106]:
        - img [ref=e107]
  - alert [ref=e109]
```

# Test source

```ts
  100 |  * Stubs PayFast so restaurant creation (which redirects new orgs to checkout)
  101 |  * never depends on the external sandbox.
  102 |  */
  103 | export async function stubPayFast(page: Page) {
  104 |   await page.route(/payfast\.co\.za/, (route) =>
  105 |     route.fulfill({
  106 |       contentType: "text/html",
  107 |       body: "<html><body><h1>PayFast checkout stub</h1></body></html>",
  108 |     })
  109 |   );
  110 | }
  111 | 
  112 | export async function createRestaurant(page: Page, name: string) {
  113 |   await stubPayFast(page);
  114 |   await page.goto("/restaurants/new");
  115 |   await page.waitForSelector('input[name="name"]');
  116 | 
  117 |   await page.fill('input[name="name"]', name);
  118 |   await page.fill('input[name="street"]', "123 Test Street");
  119 |   await page.fill('input[name="city"]', "Cape Town");
  120 | 
  121 |   await page.click('button[type="submit"]');
  122 | 
  123 |   // Starter plan redirects to PayFast checkout (stubbed); orgs with an active
  124 |   // flat plan go straight to the restaurant page. The restaurant exists in
  125 |   // the database either way.
  126 |   await page.waitForURL(
  127 |     (url) => {
  128 |       try {
  129 |         const { hostname, pathname } = new URL(url);
  130 |         if (hostname.includes("payfast.co.za")) return true;
  131 |         return /^\/restaurants\/[0-9a-f-]{36}\/?$/i.test(pathname);
  132 |       } catch {
  133 |         return false;
  134 |       }
  135 |     },
  136 |     { timeout: 20000 }
  137 |   );
  138 | }
  139 | 
  140 | /** Reads the first restaurant's id and public slug from the dashboard list. */
  141 | export async function getFirstRestaurant(
  142 |   page: Page
  143 | ): Promise<{ id: string; slug: string }> {
  144 |   await page.goto("/restaurants");
  145 | 
  146 |   const link = page.locator('a[href^="/restaurants/"]').first();
  147 |   await link.waitFor({ timeout: 10000 });
  148 |   const href = await link.getAttribute("href");
  149 |   const id = href?.match(/\/restaurants\/([0-9a-f-]{36})/i)?.[1];
  150 |   if (!id) throw new Error("Could not find restaurant ID on /restaurants");
  151 | 
  152 |   const slugText = await page.getByText(/Slug: \/m\//).first().textContent();
  153 |   const slug = slugText?.match(/Slug: \/m\/(\S+)/)?.[1];
  154 |   if (!slug) throw new Error("Could not find restaurant slug on /restaurants");
  155 | 
  156 |   return { id, slug };
  157 | }
  158 | 
  159 | /** Creates a menu and returns its workspace ids. */
  160 | export async function createMenu(
  161 |   page: Page,
  162 |   menuName: string,
  163 |   restaurantId?: string
  164 | ): Promise<{ restaurantId: string; menuId: string }> {
  165 |   const rid = restaurantId ?? (await getFirstRestaurant(page)).id;
  166 | 
  167 |   await page.goto(`/restaurants/${rid}/menus/new`);
  168 |   await page.waitForSelector('input[name="name"]');
  169 |   await page.fill('input[name="name"]', menuName);
  170 |   await page.getByRole("button", { name: "Create menu" }).click();
  171 | 
  172 |   await page.waitForURL(/\/menus\/[0-9a-f-]{36}/i, { timeout: 15000 });
  173 |   const menuId = page.url().match(/\/menus\/([0-9a-f-]{36})/i)![1];
  174 |   return { restaurantId: rid, menuId };
  175 | }
  176 | 
  177 | /** Adds a category from the menu-workspace sidebar card. */
  178 | export async function createCategory(page: Page, name: string) {
  179 |   const input = page.getByPlaceholder("Category name");
  180 |   await input.fill(name);
  181 |   await input.locator("xpath=following-sibling::button").click();
  182 |   await expect(page.getByText(name, { exact: true })).toBeVisible({
  183 |     timeout: 10000,
  184 |   });
  185 | }
  186 | 
  187 | interface NewItem {
  188 |   name: string;
  189 |   price: string;
  190 |   description?: string;
  191 |   withImage?: boolean;
  192 | }
  193 | 
  194 | /**
  195 |  * Adds a menu item via the first "Add item" button on the workspace page
  196 |  * (i.e. into the first category). Optionally uploads an image through the
  197 |  * media library dialog.
  198 |  */
  199 | export async function createMenuItem(page: Page, item: NewItem) {
> 200 |   await page.getByRole("button", { name: "Add item" }).first().click();
      |                                                                ^ Error: locator.click: Test timeout of 240000ms exceeded.
  201 | 
  202 |   const sheet = page.getByRole("dialog");
  203 |   await expect(sheet.getByText("Fill in the item details below.")).toBeVisible();
  204 | 
  205 |   await page.locator("#item-name").fill(item.name);
  206 |   await page.locator("#item-price").fill(item.price);
  207 |   if (item.description) {
  208 |     await page.locator("#item-desc").fill(item.description);
  209 |   }
  210 | 
  211 |   if (item.withImage) {
  212 |     const imageName = `e2e-item-${Date.now()}.png`;
  213 |     await sheet.getByRole("button", { name: "Add image" }).click();
  214 | 
  215 |     const mediaDialog = page
  216 |       .getByRole("dialog")
  217 |       .filter({ hasText: "Choose an image from your media library." });
  218 |     await mediaDialog.locator('input[type="file"]').setInputFiles({
  219 |       name: imageName,
  220 |       mimeType: "image/png",
  221 |       buffer: TEST_PNG,
  222 |     });
  223 | 
  224 |     // Uploaded image appears in the library; select it (click the tile —
  225 |     // the image itself is covered by a hover overlay) and confirm.
  226 |     const uploaded = mediaDialog.getByAltText(imageName);
  227 |     await expect(uploaded).toBeVisible({ timeout: 15000 });
  228 |     await mediaDialog
  229 |       .locator("div.cursor-pointer", { has: page.getByAltText(imageName) })
  230 |       .click();
  231 |     await mediaDialog.getByRole("button", { name: "Add image" }).click();
  232 |     await expect(mediaDialog).not.toBeVisible();
  233 |   }
  234 | 
  235 |   await sheet.getByRole("button", { name: "Add item", exact: true }).click();
  236 |   await expect(sheet).not.toBeVisible({ timeout: 15000 });
  237 |   await expect(page.getByText(item.name).first()).toBeVisible({ timeout: 10000 });
  238 | }
  239 | 
  240 | /** Opens the edit sheet for an item row on the menu workspace. */
  241 | export async function openItemEditor(page: Page, itemName: string) {
  242 |   const row = page.locator("div.group", { hasText: itemName }).first();
  243 |   await row.hover();
  244 |   await row.locator("button:has(svg.lucide-pencil)").click();
  245 |   await expect(
  246 |     page.getByRole("dialog").getByText("Update the item details below.")
  247 |   ).toBeVisible();
  248 | }
  249 | 
  250 | /**
  251 |  * Sets a branding color through the editor's hex text input (next to the
  252 |  * color picker labeled "{roleLabel} color").
  253 |  */
  254 | export async function setBrandingColor(
  255 |   page: Page,
  256 |   roleLabel: string,
  257 |   hex: string
  258 | ) {
  259 |   const colorInput = page.locator(`input[aria-label="${roleLabel} color"]`);
  260 |   const hexInput = colorInput.locator("xpath=following-sibling::input");
  261 |   await hexInput.fill(hex);
  262 | }
  263 | 
  264 | /** Publishes the menu from the workspace toolbar. */
  265 | export async function publishMenu(page: Page) {
  266 |   await page.getByRole("button", { name: "Publish", exact: true }).click();
  267 |   await expect(
  268 |     page.getByRole("button", { name: "Unpublish", exact: true })
  269 |   ).toBeVisible({ timeout: 15000 });
  270 | }
  271 | 
  272 | /**
  273 |  * Marks the restaurant's subscription as active and restores the restaurant
  274 |  * status. Use this after createRestaurant in tests that need a public menu.
  275 |  */
  276 | export async function activateRestaurantSubscription(restaurantId: string) {
  277 |   const admin = adminClient();
  278 |   const now = new Date();
  279 |   const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  280 | 
  281 |   const { error: subError } = await admin
  282 |     .from("subscriptions")
  283 |     .update({
  284 |       status: "active",
  285 |       started_at: now.toISOString(),
  286 |       current_period_end: future.toISOString(),
  287 |       next_billing_date: future.toISOString(),
  288 |       updated_at: now.toISOString(),
  289 |     })
  290 |     .eq("scope", "restaurant")
  291 |     .eq("scope_id", restaurantId);
  292 | 
  293 |   if (subError) throw subError;
  294 | 
  295 |   const { error: restaurantError } = await admin
  296 |     .from("restaurants")
  297 |     .update({ status: "active", updated_at: now.toISOString() })
  298 |     .eq("id", restaurantId);
  299 | 
  300 |   if (restaurantError) throw restaurantError;
```