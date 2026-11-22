import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false, // the full event-flow test shares one demo event's state
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium",
      args: ["--no-sandbox"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
