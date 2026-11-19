import { defineConfig, devices } from "@playwright/test";
import path from "path";

export const E2E_CRON_SECRET = "e2e-cron-secret-not-for-production";
// Release sintético, estável e exclusivo dos ambientes E2E.
export const E2E_OUTBOX_RELEASE_ID = "e2e00000-0000-4000-8000-000000000001";
// Flag sintética, usada exclusivamente para habilitar o transporte stub E2E.
export const E2E_OUTBOUND_STUB = "1";
process.env.CRON_SECRET = E2E_CRON_SECRET;
process.env.OUTBOX_RELEASE_ID = E2E_OUTBOX_RELEASE_ID;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Retries hide flakes and violate the release gate; every CI failure is terminal.
  retries: 0,
  workers: 1,
  reporter: "html",
  globalSetup: path.join(__dirname, "e2e/global-setup.ts"),
  globalTeardown: path.join(__dirname, "e2e/global-teardown.ts"),
  use: {
    baseURL: "http://127.0.0.1:3003",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "e2e/.auth/admin.json"),
      },
      testIgnore: ["**/auth/**", "**/api/**"],
    },
    {
      name: "unauthenticated",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/auth/**",
    },
    {
      name: "api",
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(__dirname, "e2e/.auth/admin.json"),
      },
      testMatch: "**/api/**",
    },
  ],
  webServer: {
    command: "npm run dev -- -p 3003",
    url: "http://127.0.0.1:3003/login",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      NEXTAUTH_URL: "http://127.0.0.1:3003",
      CRON_SECRET: E2E_CRON_SECRET,
      OUTBOX_RELEASE_ID: E2E_OUTBOX_RELEASE_ID,
    },
  },
});
