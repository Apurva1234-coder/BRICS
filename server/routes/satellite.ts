import { Router, type RequestHandler } from "express";
import { getAuth } from "firebase-admin/auth";
import { getSentinelHubAuthStatus, getSentinelVerificationReadiness, testTokenCheck } from "../services/sentinelHubAuthService.js";
import { enqueueSatelliteVerification } from "../services/satelliteVerificationQueue.js";
import { buildPendingSatelliteEvidence } from "../services/satelliteVerificationService.js";
import { searchSentinel2SceneRoles } from "../services/sentinelHubCatalogService.js";
import { getSentinel2TrueColorChip, narrowProcessingWindow } from "../services/sentinelHubProcessService.js";
import { getSentinel2VerificationStats } from "../services/sentinelHubStatsService.js";
import { findReport, updateReport } from "../services/reportStore.js";
import { adminAvailable, getAdminApp } from "../services/adminApp.js";
import { aiDebugLimiter } from "../middleware/rateLimits.js";

export const satelliteRouter = Router();

const requireOfficerOrAdmin: RequestHandler = async (req, res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: "Officer or admin authorization is required." }); return; }
  if (!adminAvailable()) { res.status(503).json({ error: "Officer authorization is unavailable in local mode." }); return; }
  try {
    const decoded = await getAuth(getAdminApp()!).verifyIdToken(header.slice(7));
    const role = String(decoded.role || decoded.userRole || (decoded.admin === true ? "admin" : ""));
    if (!decoded.admin && !["admin", "officer", "municipal_officer"].includes(role)) { res.status(403).json({ error: "Officer or admin authorization is required." }); return; }
    next();
  } catch { res.status(401).json({ error: "Invalid officer authorization." }); }
};

satelliteRouter.get("/satellite/status", async (req, res) => {
  try {
    const debugEnabled = (process.env.ENABLE_SENTINEL_DEBUG_ROUTES || "").toLowerCase() === "true";
    if (req.query.check === "true" && debugEnabled) {
      await testTokenCheck(true);
    }
    const status = await getSentinelHubAuthStatus();
    res.json({
      enabled: status.enabled,
      provider: status.provider,
      configured: status.configured,
      configurationValid: status.configurationValid,
      authenticationStatus: status.authenticationStatus,
      authenticationErrorCode: status.authenticationErrorCode,
      baseEndpointHost: status.baseEndpointHost,
      tokenEndpointHost: status.tokenEndpointHost,
      cooldownActive: status.cooldownActive,
      lastSuccessfulAuthenticationAt: status.lastSuccessfulAuthenticationAt
    });
  } catch { res.status(500).json({ error: "Satellite status unavailable." }); }
});

satelliteRouter.post("/satellite/debug-aoi", aiDebugLimiter, requireOfficerOrAdmin, async (req, res) => {
  if (process.env.NODE_ENV === "production" || (process.env.ENABLE_SENTINEL_DEBUG_ROUTES || "false").toLowerCase() !== "true") { res.status(404).json({ error: "Not found" }); return; }
  const lat = Number(req.body?.lat); const lng = Number(req.body?.lng); const createdAt = String(req.body?.createdAt || new Date().toISOString());
  const radiusMeters = Math.max(100, Math.min(1500, Number(req.body?.radiusMeters || process.env.SENTINEL_HUB_DEFAULT_AOI_RADIUS_METERS || 500)));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || !Number.isFinite(Date.parse(createdAt))) { res.status(400).json({ error: "bounded lat, lng, radiusMeters and ISO createdAt are required." }); return; }
  if (Math.abs(Date.now() - Date.parse(createdAt)) > 90 * 86400000) { res.status(400).json({ error: "Debug dates must be within 90 days of now." }); return; }
  try {
    const auth = await testTokenCheck();
    if (!auth.ok) { res.status(502).json({ auth, error: "Sentinel Hub authentication failed." }); return; }
    const catalog = await searchSentinel2SceneRoles({ lat, lng, eventTime: createdAt, radiusMeters, maxCloudCover: 60, nearWindowDays: 3, baselineLookbackDays: 45, followupDays: 14 });
    if (!catalog.nearReport) { res.json({ auth, catalog: { ok: true, sceneCount: catalog.candidates.length, selectedScene: null } }); return; }
    const window = narrowProcessingWindow(catalog.nearReport.acquisitionTime);
    const stats = await getSentinel2VerificationStats({ bbox: catalog.reportBbox, ...window, maxCloudCoverage: 60 });
    let processSuccessful = false;
    try { await getSentinel2TrueColorChip({ bbox: catalog.reportBbox, ...window, maxCloudCoverage: 60, catalogSceneId: catalog.nearReport.sceneId }); processSuccessful = true; } catch { /* return the typed catalog/stats result */ }
    res.json({ auth, bbox: catalog.reportBbox, catalog: { ok: true, sceneCount: catalog.candidates.length, selectedScene: catalog.nearReport, baseline: catalog.baseline, followUp: catalog.followUp }, stats, process: { trueColour: processSuccessful, narrowWindow: window } });
  } catch { res.status(502).json({ error: "Sentinel Hub debug request failed." }); }
});

satelliteRouter.get("/satellite/report/:reportId", async (req, res) => {
  try {
    const report = await findReport(String(req.params.reportId));
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    res.json({ reportId: report.id, satelliteEvidence: report.satelliteEvidence || null });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Satellite evidence unavailable." }); }
});

satelliteRouter.post("/satellite/verify-report/:id", aiDebugLimiter, requireOfficerOrAdmin, async (req, res) => {
  try {
    const report = await findReport(String(req.params.id));
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }
    const current = report.satelliteEvidence;
    if (current && ["pending", "processing"].includes(current.status)) { res.status(202).json({ message: "Satellite context is already queued.", satelliteEvidence: current }); return; }
    if (current?.checkedAt && Date.now() - Date.parse(current.checkedAt) < 60000) { res.status(429).json({ error: "Satellite verification cooldown is active." }); return; }
    const readiness = getSentinelVerificationReadiness();
    if (!readiness.ready) {
      const unavailable = buildPendingSatelliteEvidence(report);
      if (unavailable) {
        unavailable.status = "unavailable";
        unavailable.explanation = "Satellite context is temporarily unavailable.";
        unavailable.warnings = [unavailable.explanation];
        unavailable.error = { code: readiness.errorCode || "SENTINEL_NOT_CONFIGURED", message: unavailable.explanation, retryable: false };
        await updateReport(report.id, { satelliteEvidence: unavailable });
      }
      res.status(503).json({ error: "Satellite context is temporarily unavailable.", satelliteEvidence: unavailable || null });
      return;
    }
    const pending = current ? { ...current, status: "pending" as const, requestedAt: new Date().toISOString(), error: undefined } : undefined;
    if (pending) await updateReport(report.id, { satelliteEvidence: pending });
    const job = await enqueueSatelliteVerification(report.id, report.updatedAt);
    res.status(202).json({ message: "Satellite context queued.", jobId: job.jobId, satelliteEvidence: pending || null });
  } catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Could not queue satellite context." }); }
});
