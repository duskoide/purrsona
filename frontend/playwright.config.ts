import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for e2e tests against the already-running Purrsona stack
 * (podman-compose: frontend on :3000, backend on :8000, db, minio).
 *
 * These tests assume the stack is already up. They do NOT start/stop it —
 * run `podman-compose up -d` (or `docker compose up -d`) before `npx playwright test`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
