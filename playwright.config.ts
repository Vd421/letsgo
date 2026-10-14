// Playwright runs the browser tests in apps/dashboard/e2e. The API is mocked in each test,
// so no API, database or AI key is needed. Uses the Edge already installed on this machine.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/dashboard/e2e",
  timeout: 30_000,
  retries: 0,
  outputDir: "node_modules/.playwright-results", // keeps junk out of git and Prettier
  reporter: "list",
  use: { baseURL: "http://localhost:5174", channel: "msedge", headless: true },
  webServer: {
    command: "npm run dashboard",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
