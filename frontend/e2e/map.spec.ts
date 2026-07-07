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

  test("map renders cat and feeding spot markers with a legend", async ({ page }) => {
    await page.goto("/map");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });

    // Seed data has 2 sightings (Whiskers, Shadow) and 1 feeding spot
    // clustered near NYC — the map should auto-fit to that cluster and
    // render a marker for each, not leave the viewport empty.
    await expect(page.locator(".purrsona-marker-cat")).toHaveCount(2, { timeout: 15000 });
    await expect(page.locator(".purrsona-marker-feeding")).toHaveCount(1, { timeout: 15000 });

    // Legend must be visible and spell out status in text (no color-only
    // indicators per the design system).
    const legend = page.locator(".purrsona-legend");
    await expect(legend).toBeVisible();
    await expect(legend.getByText("Cat — TNR done")).toBeVisible();
    await expect(legend.getByText("Feeding spot")).toBeVisible();
  });

  test("clicking a cat marker opens a popup with name and TNR status", async ({ page }) => {
    await page.goto("/map");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15000 });
    const marker = page.locator(".purrsona-marker-cat").first();
    await expect(marker).toBeVisible({ timeout: 15000 });

    // Leaflet's marker DOM has overlapping absolutely-positioned siblings
    // that can intercept Playwright's element-based click; clicking by
    // coordinates (like a real user tap) is more reliable here.
    const box = await marker.boundingBox();
    if (!box) throw new Error("Cat marker has no bounding box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const popup = page.locator(".leaflet-popup-content");
    await expect(popup).toBeVisible();
    await expect(popup.getByText("TNR status:")).toBeVisible();
    await expect(popup.getByRole("link", { name: "View cat profile" })).toBeVisible();
  });
});
