import "dotenv/config";
import type { FullConfig } from "@playwright/test";
import pg from "pg";

/**
 * 1. On Windows, only Playwright's headless Chromium shell is allowed. Full Chrome
 *    builds (installed Chrome/Edge, channel "chromium", or any headed/debug run) of
 *    Chrome 153+ probe the Windows account with an empty-password LogonUser call
 *    on the first tab of every fresh profile. Each probe is a failed logon (event
 *    4625) and 10 of them locked the user's Windows account. The headless shell
 *    does not contain that code.
 * 2. The store rate-limits orders and logins per IP/phone. Repeated local test
 *    runs come from one IP, so clear the counters first (development DB only).
 */
export default async function globalSetup(config: FullConfig) {
  if (process.platform === "win32") {
    if (process.env.PWDEBUG) {
      throw new Error("PWDEBUG runs a headed full Chrome — not allowed on Windows (Windows account lockout risk).");
    }
    for (const project of config.projects) {
      if (project.use.channel || project.use.headless === false) {
        throw new Error(
          `Project "${project.name}": on Windows only the headless Chromium shell is allowed (no channel, headless: true). ` +
            "Install it with: npx playwright install --only-shell chromium",
        );
      }
    }
  }
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run e2e setup in production");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DELETE FROM "RateLimit"`);
  } finally {
    await client.end();
  }
}
