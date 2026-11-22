import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  // Every spec in this suite resets and shares the one demo event/org —
  // not isolated per-test fixtures — so two spec FILES running in
  // separate workers can interleave their resets and collide. Observed
  // this directly: with the default worker count, admin-route-auth.spec
  // and full-event-flow.spec ran concurrently and both reset the same
  // demo data at once. Force one worker so the whole suite is fully
  // sequential, not just serial within a single file.
  workers: 1,
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
