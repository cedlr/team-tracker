import { defineConfig, devices } from "@playwright/test";

const secret = "team-tracker-e2e-secret-32chars-ok";

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/login",
    timeout: 120_000,
    reuseExistingServer: false,
    env: { AUTH_SECRET: secret },
  },
});
