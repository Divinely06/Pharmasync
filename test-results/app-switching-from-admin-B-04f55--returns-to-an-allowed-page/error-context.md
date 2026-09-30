# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> switching from admin Backups to cashier returns to an allowed page
- Location: e2e/app.spec.ts:37:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('System Online')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('System Online') with timeout 5000ms
  - waiting for getByText('System Online')

```

```yaml
- img "Pharmasync logo"
- text: Pharmacy access Welcome back by Pharmasync Username
- textbox "Username": cashier
- text: Password
- textbox "Password": cashier123
- button "Sign in"
- alert: Too many login attempts. Try again later. (429 · RATE_LIMITED)
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const signIn = async (page: import("@playwright/test").Page, username: string, password: string) => {
  4  |   await page.goto("/");
  5  |   await page.getByLabel("Username").fill(username);
  6  |   await page.getByLabel("Password").fill(password);
  7  |   await page.getByRole("button", { name: "Sign in" }).click();
> 8  |   await expect(page.getByText("System Online")).toBeVisible();
     |                                                 ^ Error: expect(locator).toBeVisible() failed
  9  | };
  10 | 
  11 | test("admin can find an actor's sign-in events in the audit feed", async ({ page }) => {
  12 |   await signIn(page, "cashier", "cashier123");
  13 |   await page.getByRole("button", { name: "Logout" }).click();
  14 |   await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  15 |   await signIn(page, "admin", "admin123");
  16 |   await expect(page.getByText("Weekly Revenue")).toBeVisible();
  17 |   await page.getByRole("button", { name: "Audit Logs" }).click();
  18 |   await page.getByLabel("Filter audit by person").fill("cashier");
  19 |   await page.getByLabel("Filter audit by action").fill("LOGIN");
  20 |   await page.getByRole("button", { name: "Apply" }).click();
  21 |   await expect(page.getByRole("table").getByText("LOGIN").first()).toBeVisible();
  22 |   await expect(page.getByRole("table").getByText("@cashier", { exact: true }).first()).toBeVisible();
  23 |   await page.getByRole("button", { name: "Reports" }).click();
  24 |   await expect(page.getByText("Monthly Revenue")).toBeVisible();
  25 |   await expect(page.getByText("Stock Movement")).toBeVisible();
  26 | });
  27 | 
  28 | test("cashier navigation excludes admin screens and POS search reports no match", async ({ page }) => {
  29 |   await signIn(page, "cashier", "cashier123");
  30 |   await expect(page.getByRole("button", { name: "Inventory", exact: true })).toHaveCount(0);
  31 |   await expect(page.getByRole("button", { name: "Audit Logs" })).toHaveCount(0);
  32 |   await page.getByRole("button", { name: "Point of Sale" }).click();
  33 |   await page.getByRole("textbox", { name: "Search medicines or scan barcode" }).fill("NO-SUCH-MEDICINE-E2E");
  34 |   await expect(page.getByText("Medicine not found.")).toBeVisible();
  35 | });
  36 | 
  37 | test("switching from admin Backups to cashier returns to an allowed page", async ({ page }) => {
  38 |   await signIn(page, "admin", "admin123");
  39 |   await page.getByRole("button", { name: "Backups" }).click();
  40 |   await expect(page.getByText("Database backups")).toBeVisible();
  41 |   await page.getByRole("button", { name: "Logout" }).click();
  42 |   await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  43 |   await signIn(page, "cashier", "cashier123");
  44 |   await expect(page.getByText("Today's Revenue")).toBeVisible();
  45 |   await expect(page.getByRole("button", { name: "Backups" })).toHaveCount(0);
  46 | });
```