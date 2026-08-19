import "dotenv/config";
import { getSentinelHubAuthStatus, testTokenCheck } from "../server/services/sentinelHubAuthService.js";
import { searchSentinel2Scenes } from "../server/services/sentinelHubCatalogService.js";
import { getSentinel2TrueColorChip, narrowProcessingWindow } from "../server/services/sentinelHubProcessService.js";
import { getSentinel2VerificationStats } from "../server/services/sentinelHubStatsService.js";
import { storeSatelliteMedia } from "../server/services/mediaStorageService.js";

const auth = await getSentinelHubAuthStatus();
if (!auth.enabled) { console.log(JSON.stringify({ authSuccessful: false, status: "disabled", warnings: ["Enable Sentinel Hub verification to run the live provider check."] }, null, 2)); process.exit(0); }
const check = await testTokenCheck();
if (!check.ok) {
  console.log(JSON.stringify({ authSuccessful: false, authenticationStatus: check.status, authenticationErrorCode: check.errorCode, catalogSuccessful: false, sceneCount: 0, processSuccessful: false, statsSuccessful: false, geminiComparisonSuccessful: false, warnings: ["Sentinel Hub authentication failed; no provider calls were attempted."] }, null, 2));
  process.exit(1);
}

const lat = Number(process.env.SENTINEL_LIVE_LAT ?? 18.6298);
const lng = Number(process.env.SENTINEL_LIVE_LNG ?? 73.7997);
const eventTime = process.env.SENTINEL_LIVE_EVENT_TIME ?? new Date().toISOString();
const warnings: string[] = [];
let catalogSuccessful = false; let processSuccessful = false; let statsSuccessful = false; let sceneCount = 0;
let selectedAcquisition: string | undefined; let temporalOffsetHours: number | undefined; let tileCloudCover: number | undefined; let localCloudPercent: number | undefined; let validPixelPercent: number | undefined;
let processMimeType: string | undefined; let processBytes: number | undefined; let storageSuccessful = false; let storedFetchSuccessful = false; let storedFetchMimeType: string | undefined;
try {
  const catalog = await searchSentinel2Scenes({ lat, lng, createdAt: eventTime, radiusMeters: Number(process.env.SENTINEL_HUB_DEFAULT_AOI_RADIUS_METERS || 500), maxCloudCover: Number(process.env.SENTINEL_HUB_MAX_TILE_CLOUD_COVER || 60), primaryWindowDays: 14, fallbackLookbackDays: 60, limit: 20 });
  catalogSuccessful = true; sceneCount = catalog.scenes.length;
  const scene = catalog.selectedScene;
  if (scene) {
    selectedAcquisition = scene.acquisitionTime; temporalOffsetHours = scene.temporalOffsetHours; tileCloudCover = scene.cloudCover;
    const window = narrowProcessingWindow(scene.acquisitionTime);
    const stats = await getSentinel2VerificationStats({ bbox: catalog.reportBbox, ...window, maxCloudCoverage: Number(process.env.SENTINEL_HUB_MAX_TILE_CLOUD_COVER || 60) });
    statsSuccessful = true; localCloudPercent = stats.localCloudPercent; validPixelPercent = stats.validAnalysisPixelPercent;
    const product = await getSentinel2TrueColorChip({ bbox: catalog.reportBbox, ...window, maxCloudCoverage: Number(process.env.SENTINEL_HUB_MAX_TILE_CLOUD_COVER || 60), catalogSceneId: scene.sceneId });
    processSuccessful = true;
    processMimeType = "image/png"; processBytes = product.buffer.byteLength;
    const stored = await storeSatelliteMedia({ reportId: `SENTINEL-HOST-${Date.now()}`, filename: "true-colour.png", buffer: product.buffer, mimeType: processMimeType });
    storageSuccessful = true;
    if (stored.displayUrl.startsWith("/media/")) {
      process.env.NODE_ENV = "test";
      const { app } = await import("../server/index.js");
      const server = app.listen(0, "127.0.0.1");
      await new Promise<void>((resolve) => server.once("listening", resolve));
      try {
        const port = (server.address() as { port: number }).port;
        const response = await fetch(`http://127.0.0.1:${port}${stored.displayUrl}`);
        storedFetchSuccessful = response.ok; storedFetchMimeType = response.headers.get("content-type") || undefined;
      } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
    } else {
      const response = await fetch(stored.displayUrl);
      storedFetchSuccessful = response.ok; storedFetchMimeType = response.headers.get("content-type") || undefined;
    }
  } else warnings.push("No suitable clear Sentinel-2 scene was found in the bounded 60-day lookback.");
} catch (error) { warnings.push(error instanceof Error ? error.message : "Live Sentinel Hub provider request failed."); }

console.log(JSON.stringify({ authSuccessful: true, catalogSuccessful, sceneCount, selectedAcquisition, temporalOffsetHours, tileCloudCover, localCloudPercent, validPixelPercent, processSuccessful, processMimeType, processBytes, statsSuccessful, storageSuccessful, storedFetchSuccessful, storedFetchMimeType, warnings }, null, 2));
if (sceneCount > 0 && (!processSuccessful || !storageSuccessful || !storedFetchSuccessful)) process.exitCode = 1;
