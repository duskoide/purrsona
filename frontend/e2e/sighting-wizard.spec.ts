import path from "path";
import { test, expect } from "@playwright/test";
import { loginViaUi, SEED_USERS } from "./helpers";

const FIXTURE_IMAGE = path.join(__dirname, "fixtures", "test-cat.jpg");

test.describe("Sighting submission wizard", () => {
  test("unauthenticated user is redirected away from /sightings/new", async ({ page }) => {
    await page.goto("/sightings/new");
    await page.waitForURL("**/auth/login");
  });

  test("wizard step 1: photo upload gates progress to step 2", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.signedIn.email, SEED_USERS.signedIn.password);
    await page.goto("/sightings/new");

    await expect(page.getByRole("heading", { name: "Report a Cat Sighting" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upload Photo" })).toBeVisible();

    // "Next" should be disabled until an image is selected.
    const nextButton = page.getByRole("button", { name: "Next" });
    await expect(nextButton).toBeDisabled();

    await page.locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE);
    await expect(page.getByAltText("Preview")).toBeVisible();
    await expect(nextButton).toBeEnabled();

    await nextButton.click();
    await expect(page.getByRole("heading", { name: "Pick Location" })).toBeVisible();
  });

  test("wizard step 2: picking a location on the map enables Next", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.signedIn.email, SEED_USERS.signedIn.password);
    await page.goto("/sightings/new");

    await page.locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Pick Location" })).toBeVisible();

    const nextButton = page.getByRole("button", { name: "Next" });
    await expect(nextButton).toBeDisabled();

    // Click the center of the Leaflet map to select a location.
    const mapEl = page.locator(".leaflet-container");
    await expect(mapEl).toBeVisible({ timeout: 15000 });
    const box = await mapEl.boundingBox();
    if (!box) throw new Error("Map container has no bounding box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    await expect(page.getByText(/Location: -?\d+\.\d+, -?\d+\.\d+/)).toBeVisible();
    await expect(nextButton).toBeEnabled();

    await nextButton.click();
    await expect(page.getByRole("heading", { name: "Cat Description" })).toBeVisible();
  });

  test("full happy path: upload -> location -> description -> submit -> review", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.signedIn.email, SEED_USERS.signedIn.password);
    await page.goto("/sightings/new");

    // Step 1: photo
    await page.locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE);
    await page.getByRole("button", { name: "Next" }).click();

    // Step 2: location
    await expect(page.getByRole("heading", { name: "Pick Location" })).toBeVisible();
    const mapEl = page.locator(".leaflet-container");
    await expect(mapEl).toBeVisible({ timeout: 15000 });
    const box = await mapEl.boundingBox();
    if (!box) throw new Error("Map container has no bounding box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.getByRole("button", { name: "Next" }).click();

    // Step 3: cat description
    await expect(page.getByRole("heading", { name: "Cat Description" })).toBeVisible();
    const submitButton = page.getByRole("button", { name: "Submit Sighting" });
    await expect(submitButton).toBeDisabled();

    await page.locator("select").nth(0).selectOption("orange"); // coat color
    await page.locator("select").nth(1).selectOption("tabby"); // pattern type
    await page.getByLabel("healthy", { exact: true }).check();

    // observed_at datetime-local input
    const observedAt = page.locator('input[type="datetime-local"]');
    await observedAt.fill("2026-01-15T10:30");

    await expect(submitButton).toBeEnabled();

    const initiateResponse = page.waitForResponse(
      (res) => res.url().includes("/api/v1/sightings/initiate") && res.request().method() === "POST",
    );
    await submitButton.click();

    const response = await initiateResponse;
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty("draft_id");
    expect(body).toHaveProperty("candidates");

    // Step 4: review & confirm
    await expect(page.getByRole("heading", { name: "Review & Confirm" })).toBeVisible({ timeout: 15000 });

    if (body.candidates.length > 0) {
      await expect(page.getByText("We found these possible matches:")).toBeVisible();
      await expect(page.getByText("None of these — create new cat")).toBeVisible();
    } else {
      await expect(page.getByText("No matches found. A new cat profile will be created.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Confirm & Create Cat" })).toBeVisible();
    }
  });

  test("back button on step 2 returns to step 1 with photo preview intact", async ({ page }) => {
    await loginViaUi(page, SEED_USERS.signedIn.email, SEED_USERS.signedIn.password);
    await page.goto("/sightings/new");

    await page.locator('input[type="file"]').setInputFiles(FIXTURE_IMAGE);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Pick Location" })).toBeVisible();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Upload Photo" })).toBeVisible();
    await expect(page.getByAltText("Preview")).toBeVisible();
  });
});
