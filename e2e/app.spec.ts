import { expect, test } from "@playwright/test";

const signIn = async (page: import("@playwright/test").Page, username: string, password: string) => {
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("System Online")).toBeVisible();
};

test("admin can find an actor's sign-in events in the audit feed", async ({ page }) => {
  await signIn(page, "admin", "admin123");
  await page.getByRole("button", { name: "Audit Logs" }).click();
  await page.getByLabel("Filter audit by person").fill("cashier");
  await page.getByLabel("Filter audit by action").fill("LOGIN");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("table").getByText("LOGIN").first()).toBeVisible();
  await expect(page.getByRole("table").getByText("Cashier").first()).toBeVisible();
});

test("cashier navigation excludes admin screens and POS search reports no match", async ({ page }) => {
  await signIn(page, "cashier", "cashier123");
  await expect(page.getByRole("button", { name: "Inventory", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Audit Logs" })).toHaveCount(0);
  await page.getByRole("button", { name: "Point of Sale" }).click();
  await page.getByRole("textbox", { name: "Search medicines or scan barcode" }).fill("NO-SUCH-MEDICINE-E2E");
  await expect(page.getByText("Medicine not found.")).toBeVisible();
});