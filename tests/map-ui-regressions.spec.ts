import { expect, test } from "@playwright/test";

const imageBody = "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

const reports = [
  {
    id: "REPORT-1",
    createdAt: "2026-07-15T10:00:00.000Z",
    updatedAt: "2026-07-15T10:00:00.000Z",
    userId: "private-user",
    status: "Submitted",
    lat: 18.5204,
    lng: 73.8567,
    areaText: "Riverside Market",
    media: [{ mediaId: "photo-1", type: "photo", displayUrl: "https://media.test/evidence/one.jpg", publicUrl: "https://media.test/evidence/one.jpg" }],
    evidenceStatus: "stored",
    authenticityScore: 80,
    authenticityFlags: [],
    evidenceScore: 78,
    trustLevel: "Likely Valid",
    evidenceReasons: [],
    actionLog: [],
    imageHash: "private",
    imageUrl: "https://media.test/evidence/one.jpg",
    userDescription: "Smoke near the market.",
    gemini: { pollution_type: "garbage_burning", severity: "high", public_summary: "Smoke reported near the market.", municipal_action: "Inspect waste collection.", pollution_visible: true, image_quality: "clear", confidence: 90, needs_manual_review: false, visible_evidence: [] },
    airQuality: { provider: "unavailable" },
    nearby: { similarReportCount: 1, nearbyReportIds: [] },
    hotspotScore: 74,
    priority: "high",
    satelliteEvidence: {
      status: "failed",
      explanation: "401 Unauthorized invalid_client token payload: private stack trace",
      error: { message: "401 Unauthorized invalid_client credential body" },
      evidenceContributionPoints: 0,
      observability: { status: "provider_unavailable", score: 0, reasons: [] },
      assessment: { result: "not_observable", confidence: 0, explanation: "provider failure", limitations: [] },
      eventTime: { photoCapturedAt: "2026-07-15T10:00:00.000Z", source: "report_created_time" },
      eventSuitability: { level: "not_suitable", reason: "Unavailable" },
      scenes: {}, products: {}, metrics: [], warnings: [], provider: "sentinel_hub", reportLocation: { lat: 18.5204, lng: 73.8567, source: "legacy_report_coordinates", aoiRadiusMeters: 250 }, attribution: "Sentinel"
    }
  },
  {
    id: "REPORT-2",
    createdAt: "2026-07-15T09:00:00.000Z",
    updatedAt: "2026-07-15T09:00:00.000Z",
    userId: "private-user-2",
    status: "Submitted",
    lat: 18.5304,
    lng: 73.8667,
    areaText: "Hill Road",
    media: [{ mediaId: "photo-2", type: "photo", displayUrl: "https://media.test/evidence/three.jpg", publicUrl: "https://media.test/evidence/three.jpg" }],
    evidenceStatus: "stored",
    authenticityScore: 75,
    authenticityFlags: [],
    evidenceScore: 70,
    trustLevel: "Likely Valid",
    evidenceReasons: [],
    actionLog: [],
    imageHash: "private-2",
    imageUrl: "https://media.test/evidence/three.jpg",
    userDescription: "Dust on Hill Road.",
    gemini: { pollution_type: "road_dust", severity: "medium", public_summary: "Dust reported on Hill Road.", municipal_action: "Inspect road cleaning.", pollution_visible: true, image_quality: "clear", confidence: 82, needs_manual_review: false, visible_evidence: [] },
    airQuality: { provider: "unavailable" },
    nearby: { similarReportCount: 0, nearbyReportIds: [] },
    hotspotScore: 55,
    priority: "watch"
  }
];

const situations = [
  {
    id: "SIT-1", rank: 1, priority: "high", situationScore: 78, centerLat: 18.5204, centerLng: 73.8567, radiusMeters: 180,
    placeLabel: "Riverside Market", shortDescription: "Repeated smoke reports near Riverside Market.", reportCount: 1, activeReportCount: 1, unresolvedCount: 1,
    dominantPollutionType: "garbage_burning", dominantSeverity: "high", latestReportAt: "2026-07-15T10:00:00.000Z", firstReportAt: "2026-07-15T10:00:00.000Z",
    reportIds: ["REPORT-1"], photoUrls: ["https://media.test/evidence/one.jpg", "https://media.test/evidence/two.jpg"], scoreBreakdown: {}, effects: [], recommendedActions: [], statusSummary: "Open"
  },
  {
    id: "SIT-2", rank: 2, priority: "moderate", situationScore: 56, centerLat: 18.5304, centerLng: 73.8667, radiusMeters: 180,
    placeLabel: "Hill Road", shortDescription: "Road dust reported on Hill Road.", reportCount: 1, activeReportCount: 1, unresolvedCount: 1,
    dominantPollutionType: "road_dust", dominantSeverity: "medium", latestReportAt: "2026-07-15T09:00:00.000Z", firstReportAt: "2026-07-15T09:00:00.000Z",
    reportIds: ["REPORT-2"], photoUrls: ["https://media.test/evidence/three.jpg"], scoreBreakdown: {}, effects: [], recommendedActions: [], statusSummary: "Open"
  }
];

async function mockMapApi(page: import("@playwright/test").Page) {
  await page.route("**/dark_all/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from(imageBody, "base64") });
  });
  await page.route("https://media.test/evidence/**", async (route) => {
    if (route.request().url().endsWith("two.jpg")) return route.abort();
    await route.fulfill({ status: 200, contentType: "image/gif", body: Buffer.from(imageBody, "base64") });
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith("/reports")
      ? reports
      : path.endsWith("/situations")
        ? { generatedAt: "2026-07-15T10:00:00.000Z", totalSituations: situations.length, situations }
        : path.includes("air-quality/local")
          ? { generatedAt: "2026-07-15T10:00:00.000Z", points: [] }
        : path.includes("air-quality/map")
          ? { generatedAt: "2026-07-15T10:00:00.000Z", country: "India", cpcbUsable: false, cpcbReason: "Unavailable", points: [], warnings: [], aqiCoverage: { snapshotComplete: true } }
          : path.includes("cpcb/local-context")
            ? { provider: "cpcb_station_context", lat: 18.5204, lng: 73.8567, radiusKm: 25, generatedAt: "2026-07-15T10:00:00.000Z", pollutants: {}, nearestStations: [], sourceNote: "Station context is not street-level evidence." }
            : path.includes("forecast/stations")
              ? { stations: [] }
              : path.includes("forecast")
                ? { provider: "unavailable", predictions: {}, categories: {}, trend: "unknown", spikeRisk: "unknown", spikeReason: "Unavailable", confidenceNote: "Unavailable", sourceNote: "Unavailable", generatedAt: "2026-07-15T10:00:00.000Z" }
                : { states: [] };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(json) });
  });
}

async function openSituations(page: import("@playwright/test").Page) {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  const situationsResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/situations"));
  await page.goto("/");
  expect((await situationsResponse).ok()).toBeTruthy();
  await page.getByRole("button", { name: "Situations" }).click();
  await page.waitForTimeout(500);
  expect(pageErrors.map((error) => error.stack || error.message)).toEqual([]);
}

async function activateSituation(page: import("@playwright/test").Page, placeLabel: string) {
  const situation = page.locator("button.situation-row").filter({ hasText: placeLabel });
  await expect(situation).toBeVisible();
  await situation.focus();
  await page.keyboard.press("Enter");
  return situation;
}

test.describe("Situation Map regressions", () => {
  test.beforeEach(async ({ page }) => {
    await mockMapApi(page);
  });

  test("1366x768 keeps the map workspace contained and uses an overlay drawer", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openSituations(page);
    const situation = await activateSituation(page, "Riverside Market");
    await expect(page.getByRole("button", { name: /close/i })).toBeVisible();
    await expect(page.locator(".leaflet-container")).toBeVisible();
    expect(await page.locator(".leaflet-container").evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(520);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBeTruthy();
    await page.getByRole("button", { name: /close/i }).click();
    await expect(situation).toBeFocused();
  });

  test("evidence failures stay compact and situation changes reset the active photo", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openSituations(page);
    await activateSituation(page, "Riverside Market");
    await page.getByRole("button", { name: "Evidence photo 2" }).click();
    await expect(page.getByText("Evidence preview unavailable")).toBeVisible();
    await activateSituation(page, "Hill Road");
    await expect(page.getByRole("img", { name: "Hill Road" }).last()).toHaveAttribute("src", /three\.jpg/);
    await expect(page.locator("img[src*='two.jpg']")).not.toBeVisible();
  });

  test("public satellite and CPCB states are concise and provider errors stay hidden", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openSituations(page);
    await activateSituation(page, "Riverside Market");
    await expect(page.getByText(/Satellite context is temporarily unavailable/i)).toBeVisible();
    await expect(page.getByText(/citizen evidence report/i)).toBeVisible();
    await expect(page.getByText(/No fresh nearby CPCB station reading/i)).toBeVisible();
    await expect(page.getByText(/invalid_client|unauthorized|credential|stack trace/i)).toHaveCount(0);
    await expect(page.getByText("Not reported")).toHaveCount(0);
  });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
    test(`map has no page overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
      expect(await page.locator(".leaflet-container")).toBeVisible();
      await expect(page.getByRole("button", { name: /center on my location/i })).toBeVisible();
    });
  }
});
