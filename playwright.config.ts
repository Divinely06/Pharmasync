import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8443",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm api",
      url: "http://127.0.0.1:8787/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "PORT=8443 pnpm dev -- --host 0.0.0.0",
      url: "http://127.0.0.1:8443",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});