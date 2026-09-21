import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests. They run against a running app (default http://localhost:3000)
 * with the demo data loaded (`npm run db:seed:demo`) and create real orders in
 * that database — use a development database, never production.
 *
 *   npx playwright install --only-shell chromium   # one-time browser download
 *   npm run dev                                     # in another terminal
 *   npm run test:e2e
 *
 * IMPORTANT (Windows): do not set `channel: "chrome"` / "msedge" here. Driving the
 * installed Google Chrome with fresh profiles made one failed Windows logon per
 * launch (Security event 4625 from chrome.exe) and locked the Windows account
 * after 10 attempts. Playwright's bundled headless Chromium shell is used instead.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
});
