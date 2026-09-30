import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:8443";
const outputDir = resolve("docs/prototype-demo/screenshots");
const apiTraffic = [];
const demoUsers = {
  admin: { username: process.env.DEMO_ADMIN_USERNAME ?? "admin", password: process.env.DEMO_ADMIN_PASSWORD },
  pharmacist: { username: process.env.DEMO_PHARMACIST_USERNAME ?? "pharmacist", password: process.env.DEMO_PHARMACIST_PASSWORD },
  cashier: { username: process.env.DEMO_CASHIER_USERNAME ?? "cashier", password: process.env.DEMO_CASHIER_PASSWORD },
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.on("response", (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith("/api/")) {
    apiTraffic.push({ method: response.request().method(), path: url.pathname, status: response.status() });
  }
});

const screenshot = (name, options = {}) => page.screenshot({ path: resolve(outputDir, name), fullPage: false, ...options });
const signIn = async (user) => {
  if (!user.password) throw new Error("Set DEMO_ADMIN_PASSWORD, DEMO_PHARMACIST_PASSWORD, and DEMO_CASHIER_PASSWORD before capture.");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("System Online").waitFor({ state: "visible" });
};

try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username").waitFor({ state: "visible" });
  await screenshot("01-login.png");

  await signIn(demoUsers.admin);
  await screenshot("02-dashboard.png");

  await page.getByRole("button", { name: /^Inventory/ }).click();
  await page.getByRole("button", { name: "Add medicine", exact: true }).waitFor({ state: "visible" });
  await screenshot("03-inventory.png");
  await screenshot("12-inventory-workflows.png", { fullPage: true });

  await page.getByRole("button", { name: "Add medicine", exact: true }).click();
  await page.getByLabel("Brand name").fill("Demo Vitamin C 500 mg (draft)");
  await page.getByLabel("Generic name").fill("Ascorbic Acid");
  await page.getByRole("textbox", { name: "Batch", exact: true }).fill("DEMO-DRAFT-01");
  await page.getByLabel("Price").fill("5.50");
  await page.getByLabel("Initial quantity").fill("24");
  await page.getByLabel("Expiration date").fill("2027-12-31");
  await screenshot("04-medicine-draft.png");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  const healthResponse = await page.goto(`${baseUrl}/api/health`, { waitUntil: "domcontentloaded" });
  if (healthResponse?.status() !== 200) throw new Error(`Health endpoint returned ${healthResponse?.status()}`);
  await screenshot("05-database-health.png");

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Point of Sale", exact: true }).click();
  await page.locator("button").filter({ hasText: /available/ }).first().click();
  await page.locator("select").first().selectOption({ label: "GCash" });
  await page.getByText("You'll continue to the configured payment provider to complete this transaction.").waitFor({ state: "visible" });
  await screenshot("06-pos-provider-handoff.png");

  await page.getByLabel("Search medicines or scan barcode").fill("NO-SUCH-DEMO-MEDICINE");
  await page.getByText("Medicine not found.").waitFor({ state: "visible" });
  await screenshot("07-no-results.png");

  const outagePage = await context.newPage();
  await outagePage.route("**/api/session", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ code: "DATABASE_UNAVAILABLE", error: "The database is unavailable" }),
  }));
  await outagePage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await outagePage.getByRole("heading", { name: "Service unavailable" }).waitFor({ state: "visible" });
  await outagePage.screenshot({ path: resolve(outputDir, "08-api-error-handling.png"), fullPage: false });
  await outagePage.close();

  await page.getByRole("button", { name: "Users", exact: true }).click();
  await page.getByText("User roster").waitFor({ state: "visible" });
  await screenshot("10-admin-user-roles.png");

  await page.getByLabel("Username", { exact: true }).fill("demo-pharmacist-draft");
  await page.getByLabel("Full name", { exact: true }).fill("Demo Pharmacist Draft");
  await page.getByLabel("Email", { exact: true }).fill("demo-pharmacist@example.test");
  await page.locator("#user-role").selectOption("PHARMACIST");
  await screenshot("13-user-creation-draft.png");

  await page.getByRole("button", { name: "Audit Logs", exact: true }).click();
  await page.getByText("Audit trail", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("table").waitFor({ state: "visible" });
  await screenshot("14-audit-log.png");

  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page.getByText("Monthly Revenue").waitFor({ state: "visible" });
  await screenshot("15-reports.png");

  await page.getByRole("button", { name: "Backups", exact: true }).click();
  await page.getByText("Database backups").waitFor({ state: "visible" });
  await screenshot("16-backup-administration.png");

  await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  await page.getByText("Add supplier").waitFor({ state: "visible" });
  await page.getByLabel("Supplier name", { exact: true }).fill("Demo Supplier Draft");
  await page.getByLabel("Contact person", { exact: true }).fill("Demo Contact");
  await page.getByLabel("Phone", { exact: true }).fill("+63 900 000 0000");
  await page.getByLabel("Email", { exact: true }).fill("demo-supplier@example.test");
  await screenshot("17-supplier-creation-draft.png");

  await page.getByRole("button", { name: "Logout" }).click();
  await page.getByLabel("Username").waitFor({ state: "visible" });
  await signIn(demoUsers.pharmacist);
  await page.getByRole("button", { name: /^Inventory/ }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Point of Sale", exact: true }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Users", exact: true }).waitFor({ state: "hidden" });
  await screenshot("11-pharmacist-role-security.png");

  await page.getByRole("button", { name: "Logout" }).click();
  await page.getByLabel("Username").waitFor({ state: "visible" });
  await signIn(demoUsers.cashier);
  await page.getByRole("button", { name: "Point of Sale", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /^Inventory/ }).waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Users", exact: true }).waitFor({ state: "hidden" });
  await screenshot("09-cashier-role-security.png");

  await writeFile(resolve(outputDir, "api-traffic.json"), `${JSON.stringify(apiTraffic, null, 2)}\n`);
  console.log(`Captured ${apiTraffic.length} API responses and 17 screenshots in ${outputDir}`);
  for (const item of apiTraffic) console.log(`${item.method} ${item.path} ${item.status}`);
} finally {
  await context.close();
  await browser.close();
}