import { config } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const PORT = 3100;
const dbUrl = process.env.TEST_DATABASE_URL ?? "postgres://lia:lia@localhost:5432/lia_test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { DATABASE_URL: dbUrl, APP_URL: `http://localhost:${PORT}`, OPENAI_API_KEY: "", ALLOW_SIGNUP: "false", LOG_LEVEL: "warn" },
  },
});
