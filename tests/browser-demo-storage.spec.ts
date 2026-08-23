import { expect, test } from "@playwright/test";

const png = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

async function seedCapturedDemo(page: import("@playwright/test").Page) {
  await page.goto("/#my-reports");
  await page.evaluate(async ({ image }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("nagarnetra-demo-v1", 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("reports")) database.createObjectStore("reports", { keyPath: "id" });
        if (!database.objectStoreNames.contains("media")) database.createObjectStore("media", { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const bytes = Uint8Array.from(atob(image), (value) => value.charCodeAt(0));
    const createdAt = new Date().toISOString();
    const before = { id: "before-capture", blob: new Blob([bytes], { type: "image/gif" }), createdAt };
    const report = {
      id: "browser-demo-e2e", createdAt, updatedAt: createdAt, userId: "anonymous", status: "Manual review needed",
      lat: 18.5204, lng: 73.8567, areaText: "Mobile Demo Ward", primaryMediaId: "before-capture",
      media: [{ mediaId: "before-capture", type: "photo", storagePath: "indexeddb:before-capture", storageProvider: "browser_indexeddb", mimeType: "image/gif", sizeBytes: bytes.length, sha256Hash: "test", uploadedAt: createdAt, metadataWarnings: [] }],
      evidenceStatus: "verified", authenticityScore: 70, authenticityFlags: ["browser_demo_storage"], evidenceScore: 70, trustLevel: "Likely Valid", evidenceReasons: ["Mobile test capture"], imageHash: "test", userDescription: "Captured local evidence", hotspotScore: 40, priority: "watch",
      gemini: { is_pollution_related: true, pollution_visible: true, image_quality: "usable", image_quality_score: 60, pollution_type: "open_waste", confidence: 60, severity: "medium", evidence_strength: 60, visible_evidence: ["waste"], possible_pollutants: [], public_summary: "Local demo capture", municipal_action: "Clean site", needs_manual_review: false, trust_decision: "likely_valid", safety_note: "Use care." },
      airQuality: { provider: "unavailable", status: "unavailable", pollutants: {}, readings: {}, warnings: [] }, nearby: { similarReportCount: 0, nearbyReportIds: [] }, actionLog: [], statusHistory: [], captureEvidence: { captureMethod: "live_camera", cameraFacingMode: "environment", photoCapturedAt: createdAt, captureLocation: { lat: 18.5204, lng: 73.8567, accuracyMeters: 8, capturedAt: createdAt } }
    };
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["reports", "media"], "readwrite");
      transaction.objectStore("reports").put(report);
      transaction.objectStore("media").put(before);
      transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error);
    });
  }, { image: png.toString("base64") });
}

test("mobile browser demo persists capture, cleanup proof and final resolution", async ({ page }) => {
  const prohibitedRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (/firebasestorage\.app|storage\.googleapis\.com|\/media\/|\/api\/reports(?:\/|$)|ngo-cleanup-proof/i.test(url)) prohibitedRequests.push(url);
  });
  await seedCapturedDemo(page);
  await page.reload();
  await expect(page.getByText("Mobile Demo Ward").first()).toHaveCount(1);

  await page.goto("/#admin");
  await page.getByRole("button", { name: "Assign to Municipal" }).click();
  await expect(page.getByRole("button", { name: "Assign to Municipal" })).toBeDisabled();

  await page.goto("/#ngo");
  await page.getByRole("button", { name: /Mobile Demo Ward/ }).click();
  await page.getByRole("button", { name: "Accept Task" }).click();
  await expect(page.getByText("Accepted", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Cleanup" })).toBeVisible();
  await expect(page.getByRole("button", { name: "View Hotspot Map" })).toBeVisible();
  await page.getByRole("button", { name: "Start Cleanup" }).click();
  await expect(page.getByText("Upload After-Cleanup Proof")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: "after.gif", mimeType: "image/gif", buffer: png });
  await expect(page.getByAltText("Selected after-cleanup evidence preview")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Cleanup Proof" })).toBeDisabled();
  await page.getByLabel("Action Taken").fill("Waste removed");
  await expect(page.getByRole("button", { name: "Submit Cleanup Proof" })).toBeEnabled();
  await page.getByRole("button", { name: "Submit Cleanup Proof" }).click();
  await expect(page.getByText("Before and after comparison")).toBeVisible();
  expect(await page.locator('img[src^="blob:"]').count()).toBeGreaterThanOrEqual(2);

  await page.reload();
  await expect(page.getByText("Before and after comparison")).toBeVisible();

  await page.goto("/#admin");
  await page.getByRole("button", { name: /Back/ }).click();
  await page.getByRole("button", { name: /Mobile Demo Ward/ }).click();
  await page.getByRole("button", { name: "Approve as Resolved" }).click();
  await expect(page.getByText("Resolution approved")).toBeVisible();

  await page.reload();
  const persisted = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => { const request = indexedDB.open("nagarnetra-demo-v1"); request.onsuccess = () => resolve(request.result); });
    return new Promise<{ status?: string; afterMediaId?: string }>((resolve) => { const request = db.transaction("reports", "readonly").objectStore("reports").get("browser-demo-e2e"); request.onsuccess = () => resolve({ status: request.result?.status, afterMediaId: request.result?.cleanupProof?.afterMedia?.mediaId }); });
  });
  expect(persisted).toEqual({ status: "Resolved", afterMediaId: expect.any(String) });
  await page.goto("/#my-reports");
  await expect(page.getByText("4 of 4 — Resolved.").last()).toBeVisible();
  expect(prohibitedRequests).toEqual([]);
});
