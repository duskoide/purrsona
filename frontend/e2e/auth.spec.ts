import { test, expect } from "@playwright/test";
import { loginViaUi, SEED_USERS, uniqueEmail } from "./helpers";

test.describe("Auth: register/login flow", () => {
  test("home page redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/auth/login");
    await expect(page.getByRole("heading", { name: "PLAYER LOGIN" })).toBeVisible();
  });

  test("register creates a new account and lands on dashboard", async ({ page }) => {
    const email = uniqueEmail("register");

    await page.goto("/auth/register");
    await expect(page.getByRole("heading", { name: "CREATE PLAYER" })).toBeVisible();

    await page.getByLabel("EMAIL").fill(email);
    await page.getByLabel("PASSWORD", { exact: true }).fill("password123");
    await page.getByLabel("CONFIRM PASSWORD").fill("password123");
    await page.getByRole("button", { name: "CREATE ACCOUNT" }).click();

    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "PLAYER DASHBOARD" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }).getByText(email),
    ).toBeVisible();
  });

  test("register rejects mismatched passwords client-side", async ({ page }) => {
    await page.goto("/auth/register");
    await page.getByLabel("EMAIL").fill(uniqueEmail("mismatch"));
    await page.getByLabel("PASSWORD", { exact: true }).fill("password123");
    await page.getByLabel("CONFIRM PASSWORD").fill("different123");
    await page.getByRole("button", { name: "CREATE ACCOUNT" }).click();

    await expect(page.getByText("Passwords do not match")).toBeVisible();
    // Should not navigate away.
    await expect(page).toHaveURL(/\/auth\/register$/);
  });

  test("login with seeded signed_in user succeeds and shows nav links", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.signedIn.email, SEED_USERS.signedIn.password);

    await expect(page.getByRole("heading", { name: "PLAYER DASHBOARD" })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByText(SEED_USERS.signedIn.email)).toBeVisible();
    await expect(nav.getByRole("link", { name: "MAP" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "CATS" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "DASHBOARD" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "REPORT SIGHTING" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "LOGOUT" })).toBeVisible();
  });

  test("login with wrong password shows an error and stays on login page", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("EMAIL").fill(SEED_USERS.signedIn.email);
    await page.getByLabel("PASSWORD").fill("wrong-password-123");
    await page.getByRole("button", { name: "START GAME" }).click();

    await expect(page.locator("text=/invalid/i")).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test("verified seed user dashboard shows VERIFIED rank and admin panel", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.verified.email, SEED_USERS.verified.password);

    await expect(page.getByText("VERIFIED", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "ADMIN: VERIFICATION REQUESTS" })).toBeVisible();
  });

  test("logout returns user to login page and protects dashboard again", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.signedIn.email, SEED_USERS.signedIn.password);

    await page.getByRole("button", { name: "LOGOUT" }).click();
    await page.waitForURL("**/auth/login");

    // Direct navigation to a protected route should bounce back to login.
    await page.goto("/dashboard");
    await page.waitForURL("**/auth/login");
  });
});
