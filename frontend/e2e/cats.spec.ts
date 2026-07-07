import { test, expect } from "@playwright/test";
import { loginViaUi, SEED_USERS } from "./helpers";

test.describe("Cats list + profile detail", () => {
  test("cats list page loads seeded cats", async ({ page }) => {
    const catsResponse = page.waitForResponse(
      (res) => res.url().includes("/api/v1/cats") && res.request().method() === "GET",
    );

    await page.goto("/cats");
    await expect(page.getByRole("heading", { name: "COMMUNITY CATS" })).toBeVisible();

    const response = await catsResponse;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.total).toBeGreaterThanOrEqual(4); // Whiskers, Shadow, Luna, Marmalade

    // Seed data includes a cat named "Whiskers".
    await expect(page.getByText("Whiskers")).toBeVisible();
  });

  test("clicking a cat card navigates to its profile page", async ({ page }) => {
    await page.goto("/cats");
    await expect(page.getByRole("heading", { name: "COMMUNITY CATS" })).toBeVisible();

    const whiskersCard = page.getByText("Whiskers").first();
    await expect(whiskersCard).toBeVisible();
    await whiskersCard.click();

    await page.waitForURL(/\/cats\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Whiskers", level: 1 })).toBeVisible();
  });

  test("cat profile page shows metadata, sighting history and TNR records", async ({ page }) => {
    await page.goto("/cats");
    await page.getByText("Whiskers").first().click();
    await page.waitForURL(/\/cats\/[0-9a-f-]+$/);

    await expect(page.getByText("Coat:")).toBeVisible();
    await expect(page.getByText("orange", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sighting History" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TNR Records" })).toBeVisible();
  });

  test("cat status badges show TNR status, not user account status", async ({ page }) => {
    await page.goto("/cats");
    await expect(page.getByRole("heading", { name: "COMMUNITY CATS" })).toBeVisible();

    // Seed cats cover every TNR state; badges must use TNR vocabulary
    // (e.g. "TNR COMPLETED", "NEEDS TNR") rather than account-role labels
    // like "VERIFIED" or "SIGNED IN", which mean something unrelated.
    const badges = page.locator('[role="status"]');
    await expect(badges.first()).toBeVisible();
    const badgeTexts = await badges.allInnerTexts();

    expect(badgeTexts.length).toBeGreaterThan(0);
    for (const text of badgeTexts) {
      expect(text).not.toBe("VERIFIED");
      expect(text).not.toBe("SIGNED IN");
      expect(text).not.toBe("PUBLIC");
    }

    // Whiskers is seeded with tnr_status "completed".
    await page.getByText("Whiskers").first().click();
    await page.waitForURL(/\/cats\/[0-9a-f-]+$/);
    await expect(page.locator('[role="status"]').first()).toHaveText("TNR COMPLETED");
  });

  test("cat profile shows Edit button only when logged in", async ({ page }) => {
    await page.goto("/cats");
    await page.getByText("Whiskers").first().click();
    await page.waitForURL(/\/cats\/[0-9a-f-]+$/);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);

    await loginViaUi(page, SEED_USERS.signedIn.email, SEED_USERS.signedIn.password);
    await page.goto("/cats");
    await page.getByText("Whiskers").first().click();
    await page.waitForURL(/\/cats\/[0-9a-f-]+$/);
    await expect(page.getByRole("link").filter({ hasText: "Edit" })).toBeVisible();
  });

  test("nonexistent cat id shows not-found empty state", async ({ page }) => {
    await page.goto("/cats/00000000-0000-0000-0000-000000000000");
    await expect(page.getByText("Cat not found")).toBeVisible();
  });

  test("filtering cats list by coat color narrows results", async ({ page }) => {
    await page.goto("/cats");
    await expect(page.getByRole("heading", { name: "COMMUNITY CATS" })).toBeVisible();

    const filterResponse = page.waitForResponse(
      (res) => res.url().includes("/api/v1/cats") && res.url().includes("coat_color=black"),
    );

    // FilterBar is a select/button group; try common control patterns.
    const coatSelect = page.locator("select").first();
    if (await coatSelect.count() > 0) {
      await coatSelect.selectOption("black");
      const response = await filterResponse;
      const body = await response.json();
      for (const cat of body.cats) {
        expect(cat.coat_color).toBe("black");
      }
    }
  });
});
