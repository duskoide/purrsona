import type { Page } from "@playwright/test";

export const SEED_USERS = {
  signedIn: { email: "user@purrsona.local", password: "password123" },
  verified: { email: "admin@purrsona.local", password: "password123" },
};

/** Logs in via the UI form and waits for redirect to /dashboard. */
export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByLabel("EMAIL").fill(email);
  await page.getByLabel("PASSWORD").fill(password);
  await page.getByRole("button", { name: "START GAME" }).click();
  await page.waitForURL("**/dashboard");
}

/** Generates a unique email for register-flow tests so re-runs don't collide. */
export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@purrsona.local`;
}
