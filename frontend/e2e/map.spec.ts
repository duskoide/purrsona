import { test, expect } from "@playwright/test";
import { loginViaUi, SEED_USERS } from "./helpers";

test.describe("Map page", () => {
  test("map page loads Leaflet map and fetches markers for the seeded viewport", async ({ page }) => {
    // Map data fetch requires auth on nav but map page itself is public per NavigationBar (MAP link shown always).
    const mapResponse = page.waitForResponse(
      (res) => res.url().includes("/api/v1/map") && res.request().method() === "GET",
    );

    await page.goto("/map");

    // Leaflet renders tiles inside a .leaflet-container; wait for it to mount.
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });

    const response = await mapResponse;
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("sightings");
    expect(body).toHaveProperty("feeding_spots");
    expect(Array.isArray(body.sightings)).toBe(true);
    expect(Array.isArray(body.feeding_spots)).toBe(true);

    // Seed data includes sightings for Whiskers/Shadow near the default NYC center,
    // so the default viewport (zoom 14 around 40.7128,-74.006) should return at least one.
    expect(body.sightings.length).toBeGreaterThan(0);
  });

  test("map page shows zoom controls and attribution", async ({ page }) => {
    await page.goto("/map");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
    await expect(page.locator(".leaflet-control-zoom")).toBeVisible();
    await expect(page.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
  });

  test("map link is reachable from nav when logged in", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.signedIn.email, SEED_USERS.signedIn.password);
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "MAP" }).click();
    await page.waitForURL("**/map");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
  });
});
