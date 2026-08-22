import { Router } from "express";
import {
  getAirQuality,
  getAirQualityDebug,
  getAirQualityMap,
  getAirQualitySources,
  getLocalAirQualityMap,
  getLatestAqiCoverage
} from "../services/airQualityService.js";
import {
  getCpcbLocalPollutantContext,
  getCpcbStatus,
  getNearbyCpcbStations
} from "../services/cpcbService.js";
import { analyzeImageData, decideVerification, VerificationError } from "../services/geminiService.js";
import {
  createReport,
  listReports,
  listReportsByUser,
  updateReport,
  findReport,
  updateStatus
} from "../services/reportStore.js";
import { calculateHotspotScore, findNearbyReports, priorityForHotspotScore } from "../services/hotspotService.js";
import { assessAuthenticity } from "../services/authenticityService.js";
import { CaptureValidationError, validateLiveCameraCapture } from "../services/captureValidation.js";
import { scoreEvidence } from "../services/evidenceScoreService.js";
import { getAqiForecast, getForecastStations } from "../services/forecastService.js";
import { getStateForecasts, getStateForecastStatus } from "../services/stateForecastService.js";
import { buildLocalityIntelligence } from "../services/localityIntelligenceService.js";
import { buildLocalitySummary } from "../services/localityService.js";
import { MediaStorageUnavailableError, hydrateReportMediaUrls, hydrateReportsMediaUrls, mediaHash, storeReportMedia, storeResolutionMedia } from "../services/mediaStorageService.js";
import { firestoreEnabled } from "../services/firestoreReportStore.js";
import { enqueueSatelliteVerification } from "../services/satelliteVerificationQueue.js";
import { buildPendingSatelliteEvidence } from "../services/satelliteVerificationService.js";
import { getSentinelVerificationReadiness } from "../services/sentinelHubAuthService.js";
import { buildRiskAdvisor } from "../services/riskAdvisorService.js";
import { buildRankedSituations } from "../services/situationRankingService.js";
import { adminAvailable } from "../services/adminApp.js";
import { getOpenAqStatus } from "../services/openAqAuthService.js";
import { getOpenAqNearbyStations, validateOpenAqRadius } from "../services/openAqService.js";
import { getOpenAqNationalSnapshot, refreshOpenAqNationalSnapshot } from "../services/openAqNationalSnapshotService.js";
import { getCurrentAqiSnapshot, getCurrentAqiStatus, refreshCurrentAqiSnapshot } from "../services/currentAqiSnapshotService.js";
import type { AirQualitySummary, CpcbPollutantCode, PollutionReport, ReportStatus } from "../types.js";
import { distanceMeters } from "../utils/geo.js";
import { awardResolutionPoints, getLeaderboard, getPointsHistory, getRewards } from "../services/rewardsService.js";
import { analyzeRecurringHotspot } from "../services/recurringHotspotService.js";
import { evaluateSensitiveLocationsSync } from "../services/sensitiveLocationService.js";
import { evaluateReportContextualPriority } from "../services/contextualPriorityService.js";

export const reportsRouter = Router();

// Idempotent permanent demo seed. It only creates the fixed record when absent.
reportsRouter.post("/demo/seed-roadside-trash", (req, res) => {
  void (async () => {
    const id = "NGR-DEMO-ROADSIDE-001";
    const existing = await findReport(id);
    if (existing) { res.json({ seeded: false, report: await hydrateReportMediaUrls(existing) }); return; }
    const { imageBase64, imageMimeType } = req.body || {};
    if (typeof imageBase64 !== "string" || imageMimeType !== "image/webp") { res.status(400).json({ error: "A WebP image is required." }); return; }
    const createdAt = "2026-08-17T17:36:51.000Z";
    const captureEvidence = { captureMethod: "uploaded_image" as const, photoCapturedAt: createdAt, cameraFacingMode: "environment" as const, captureLocation: { lat: 18.5204, lng: 73.8567, accuracyMeters: 25, capturedAt: createdAt } };
    const media = await storeReportMedia({ reportId: id, mediaId: "MED-DEMO-ROADSIDE-001", originalBase64: imageBase64, thumbnailBase64: imageBase64, mimeType: imageMimeType, capturedAt: createdAt, fileModifiedAt: createdAt, width: 800, height: 533, exifAvailable: false, captureEvidence });
    const report = await createReport({ id, lat: 18.5204, lng: 73.8567, areaText: "Suburban roadside near Pune", imageHash: media.sha256Hash, imageUrl: media.displayUrl, media: [media], primaryMediaId: media.mediaId, evidenceStatus: "verified", authenticityScore: 100, authenticityFlags: ["demo_seed"], evidenceScore: 82, trustLevel: "Verified", evidenceReasons: ["Permanent application demo seed"], userDescription: "Demo report: garbage accumulation along the roadside creates an eyesore and may obstruct drainage. Municipal cleanup is requested.", userId: "demo-seed", gemini: { is_pollution_related: true, pollution_visible: true, image_quality: "usable", image_quality_score: 95, pollution_type: "open_waste", confidence: 95, severity: "high", evidence_strength: 90, visible_evidence: ["Multiple garbage bags and loose litter beside the road"], possible_pollutants: ["Particulate matter", "Bioaerosols"], public_summary: "Roadside garbage accumulation requiring municipal cleanup.", municipal_action: "Inspect and clear the roadside waste pile.", needs_manual_review: false, trust_decision: "verified", safety_note: "Avoid direct contact with waste." }, airQuality: { provider: "unavailable", category: "AQI unavailable", pollutants: {}, rawSummary: "Demo report seed." }, captureEvidence });
    res.json({ seeded: true, report: await hydrateReportMediaUrls(report) });
  })().catch((err) => { console.error("[DemoSeed] failed", err); res.status(500).json({ error: err instanceof Error ? err.message : String(err) }); });
});

function inferForecastStation(input?: string, airQuality?: AirQualitySummary) {
  const explicit = typeof input === "string" ? input.trim() : "";
  if (explicit) return explicit;
  const nearest = airQuality?.nearestStation?.trim();
  if (!nearest) return undefined;
  return nearest.replace(/,\s*Delhi$/i, "");
}

function priorityForReport(report: Pick<PollutionReport, "trustLevel">, hotspotScore: number) {
  return priorityForHotspotScore(hotspotScore, report.trustLevel);
}

function appendStatusHistory(report: PollutionReport, status: string, label: string, updatedByRole: "citizen" | "system" | "officer" | "municipal", message?: string) {
  return [...(report.statusHistory || []), { status, label, timestamp: new Date().toISOString(), updatedByRole, message }];
}

const activeLocalityStatuses: ReportStatus[] = [
  "Submitted",
  "New",
  "Assigned",
  "In Progress",
  "Manual review needed"
];

function dominantPollutionType(reports: PollutionReport[]) {
  const counts = reports.reduce<Record<string, number>>((acc, report) => {
    const key = report.gemini.pollution_type;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

// ── GET /api/reports — list all reports ──────────────────────────────────────
reportsRouter.get("/reports", (_req, res) => {
  void (async () => {
    res.json(await hydrateReportsMediaUrls(await listReports()));
  })();
});

// ── GET /api/reports/mine?userId=xxx — reports by user ───────────────────────
reportsRouter.get("/reports/mine", (req, res) => {
  void (async () => {
    const userId = typeof req.query["userId"] === "string" ? req.query["userId"] : null;
    if (!userId) {
      res.status(400).json({ error: "userId query parameter is required" });
      return;
    }
    const mine = await hydrateReportsMediaUrls(await listReportsByUser(userId));
    res.json(mine);
  })();
});

reportsRouter.get("/leaderboard", async (req, res) => {
  const period = req.query.period === "monthly" ? "monthly" : "all";
  const locality = typeof req.query.locality === "string" ? req.query.locality.trim() : undefined;
  res.json({ period, locality: locality || null, entries: await getLeaderboard({ period, locality }) });
});

reportsRouter.get("/users/:id/rewards", async (req, res) => {
  const profile = await getRewards(req.params.id);
  if (!profile) return res.json({ profile: null });
  const { userId: _userId, ...publicProfile } = profile;
  res.json({ profile: publicProfile });
});

reportsRouter.get("/users/:id/points-history", async (req, res) => {
  const transactions = await getPointsHistory(req.params.id);
  res.json({ transactions: transactions.map(({ userId: _userId, ...transaction }) => transaction) });
});

// ── GET /api/status — Firebase/storage status ────────────────────────────────
reportsRouter.get("/status", (_req, res) => {
  const firebaseStorageEnabled = process.env.ENABLE_FIREBASE_STORAGE === "true";
  const firebaseBucketConfigured = Boolean(process.env.FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET);
  void (async () => {
    const openAq = await getOpenAqStatus(false);
    res.json({
      service: "cleanair-local-sentinel",
      firebaseAdmin: adminAvailable(),
      reportStore: adminAvailable() ? "firestore" : "memory",
      mediaStorage: firebaseStorageEnabled && firebaseBucketConfigured ? "firebase_storage" : firebaseBucketConfigured ? "firebase_storage_disabled" : "local",
      cpcbConfigured: Boolean(process.env.DATA_GOV_API_KEY),
      openAqConfigured: openAq.configured,
      openAqAuthenticationSuccessful: openAq.authenticationSuccessful,
      currentAirQualityConfigured: Boolean(process.env.DATA_GOV_API_KEY || process.env.OPENAQ_API_KEY),
      forecastEngineConfigured: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      ...getStateForecastStatus()
    });
  })();
});

// ── GET /api/air-quality/state-forecasts ─────────────────────────────────────
reportsRouter.get("/air-quality/state-forecasts", (req, res) => {
  void (async () => {
    try {
      const forceRefresh = req.query["forceRefresh"] === "true";
      const data = await Promise.race([
        getStateForecasts(forceRefresh),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8_000))
      ]);
      if (!data) {
        res.status(202).json({
          generatedAt: new Date().toISOString(),
          reason: "State forecasts are preparing. Please retry shortly.",
          data: null,
          states: []
        });
        return;
      }
      res.json(data);
    } catch (err) {
      console.error("[StateForecast] Error:", err);
      res.status(500).json({ error: "Failed to fetch state forecasts." });
    }
  })();
});


reportsRouter.post("/reports", (req, res) => {
  if (process.env.VITE_DEMO_BROWSER_STORAGE === "true") {
    return res.status(409).json({ error: "This Netlify demonstration stores report evidence only in browser IndexedDB.", reasonCode: "browser_demo_storage_required" });
  }
  void (async () => {
    const {
      lat,
      lng,
      areaText,
      imageHash,
      imageBase64,
      originalBase64,
      imageMimeType,
      fileModifiedAt,
      capturedAt,
      photoCapturedAt,
      captureMethod,
      cameraFacingMode,
      captureLocation,
      width,
      height,
      exifAvailable,
      userDescription,
      userId,
      stationName
    } = req.body || {};
    if (typeof lat !== "number" || typeof lng !== "number" || !imageBase64 || !originalBase64 || !imageMimeType) {
      res.status(400).json({
        error: "lat, lng, imageBase64, originalBase64, and imageMimeType are required",
        reasonCode: "missing_required_fields"
      });
      return;
    }
    try {
      const captureEvidence = validateLiveCameraCapture({
        imageMimeType,
        width,
        height,
        captureMethod,
        cameraFacingMode,
        photoCapturedAt: photoCapturedAt || capturedAt,
        captureLocation
      });
      const reportLat = captureEvidence.captureLocation.lat;
      const reportLng = captureEvidence.captureLocation.lng;
      const originalEvidenceBase64 = originalBase64;
      const serverHash = mediaHash(originalEvidenceBase64);
      if (originalBase64 && imageHash && imageHash !== serverHash) {
        res.status(400).json({
          error: "Image upload integrity check failed.",
          reasonCode: "hash_mismatch"
        });
        return;
      }
      const existingReports = await listReports();
      const duplicate = existingReports.find(
        (item) =>
          item.imageHash === serverHash &&
          Date.now() - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000
      );
      if (duplicate) {
        res.status(409).json({
          error: "This exact photo was already submitted recently.",
          reasonCode: "duplicate_image_hash"
        });
        return;
      }
      const gemini = await analyzeImageData({
        imageBase64,
        fallbackImageBase64: originalEvidenceBase64,
        imageMimeType,
        context: userDescription || ""
      });
      const decision = decideVerification(gemini);
      if (!decision.accepted) {
        res.status(422).json({
          error: decision.message || "No visible pollution evidence was found.",
          reasonCode: decision.reasonCode || "not_pollution"
        });
        return;
      }
      const reportId = `CLS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now()
        .toString()
        .slice(-4)}`;
      const mediaId = `MED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const media = await storeReportMedia({
        reportId,
        mediaId,
        originalBase64: originalEvidenceBase64,
        thumbnailBase64: imageBase64,
        mimeType: imageMimeType,
        fileModifiedAt,
        capturedAt: captureEvidence.photoCapturedAt,
        width: typeof width === "number" ? width : undefined,
        height: typeof height === "number" ? height : undefined,
        exifAvailable: Boolean(exifAvailable),
        captureEvidence
      });
      const priorNearbyCount = existingReports.filter(
        (item) => Date.now() - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000 &&
          distanceMeters(reportLat, reportLng, item.lat, item.lng) <= 500
      ).length;
      const userRecentReports = existingReports.filter(
        (item) => item.userId === (userId || "anonymous") &&
          Date.now() - new Date(item.createdAt).getTime() < 24 * 60 * 60 * 1000
      );
      const authenticity = assessAuthenticity({
        media,
        gemini,
        duplicateRecent: false,
        userRecentReports,
        nearbyCount: priorNearbyCount,
        locationText: areaText
      });
      const evidence = scoreEvidence({
        gemini,
        authenticity,
        nearbyCount: priorNearbyCount,
        hasPreciseLocation: Number.isFinite(reportLat) && Number.isFinite(reportLng),
        uploadedAt: media.uploadedAt,
        decision
      });
      const [airQualityResult, cpcbContextResult, forecastResult] = await Promise.allSettled([
        getAirQuality(reportLat, reportLng),
        getCpcbLocalPollutantContext(reportLat, reportLng, { radiusKm: 25 }),
        getAqiForecast({ lat: reportLat, lng: reportLng })
      ]);
      const airQuality = airQualityResult.status === "fulfilled" ? airQualityResult.value : {
        provider: "unavailable" as const,
        status: "unavailable" as const,
        pollutants: {},
        warnings: [{ code: "provider_error" as const, message: "Current air-quality providers were unavailable." }],
        rawSummary: "Air-quality context unavailable; report submission continued."
      };
      const cpcbContext = cpcbContextResult.status === "fulfilled" ? cpcbContextResult.value : undefined;
      const forecast = forecastResult.status === "fulfilled" ? forecastResult.value : undefined;
      const report = await createReport({
        id: reportId,
        lat: reportLat,
        lng: reportLng,
        areaText: areaText || `${reportLat.toFixed(4)}, ${reportLng.toFixed(4)}`,
        imageHash: serverHash,
        imageUrl: media.displayUrl || media.publicUrl,
        media: [media],
        primaryMediaId: media.mediaId,
        evidenceStatus: decision.evidenceStatus,
        authenticityScore: authenticity.authenticityScore,
        authenticityFlags: authenticity.authenticityFlags,
        evidenceScore: evidence.evidenceScore,
        trustLevel: decision.trustLevel === "Needs Review" ? "Needs Review" : evidence.trustLevel,
        rejectionReason: gemini.rejection_reason,
        scoreBreakdown: evidence.scoreBreakdown,
        evidenceReasons: evidence.reasons,
        userDescription: userDescription || "",
        userId: userId || "anonymous",
        gemini,
        airQuality,
        forecast,
        cpcbContext,
        captureEvidence
      });
      const nearby = findNearbyReports(report, existingReports);
      const hotspotScore = calculateHotspotScore(
        gemini.severity,
        nearby.similarReportCount,
        airQuality,
        evidence.evidenceScore,
        forecast,
        cpcbContext,
        gemini.pollution_type
      );
      const locality = buildLocalitySummary({ ...report, nearby }, existingReports);
      const status = decision.status;
      const nextTrustLevel = decision.trustLevel === "Needs Review" ? "Needs Review" : evidence.trustLevel;
      const baseReportPriority = priorityForHotspotScore(hotspotScore, nextTrustLevel);

      const recurrence = analyzeRecurringHotspot(
        { id: report.id, lat: reportLat, lng: reportLng, pollutionType: gemini.pollution_type, createdAt: report.createdAt },
        existingReports,
        { radiusMeters: 2000, windowDays: 90 }
      );
      const sensitiveLocations = evaluateSensitiveLocationsSync(reportLat, reportLng, 1000);
      const contextualPriority = evaluateReportContextualPriority({
        basePriority: baseReportPriority,
        severity: gemini.severity,
        evidenceScore: evidence.evidenceScore,
        trustLevel: nextTrustLevel,
        hotspotScore,
        recurrence,
        sensitiveLocations
      });

      const updated = await updateReport(report.id, {
        nearby,
        locality,
        hotspotScore,
        trustLevel: nextTrustLevel,
        priority: contextualPriority.finalPriority as "watch" | "high" | "severe" | "resolved",
        status,
        recurrence,
        sensitiveLocations,
        contextualPriority,
        statusHistory: [
          { status: "submitted", label: "Report Submitted", timestamp: report.createdAt, updatedByRole: "citizen", message: "Report received." },
          ...(decision.evidenceStatus === "verified" ? [{ status: "verified", label: "Evidence Verified", timestamp: new Date().toISOString(), updatedByRole: "system" as const, message: "The submitted image and location evidence have been verified." }] : [])
        ]
      });
      const reportWithRisk = updated
        ? await updateReport(updated.id, {
            riskAdvisor: buildRiskAdvisor({
              report: updated,
              nearbyReports: existingReports
            })
          })
        : updated;
      if (!updated) {
        console.warn(`[Reports] Post-create update failed for ${report.id}; returning initially created report.`);
      }
      if (updated && !reportWithRisk) {
        console.warn(`[Reports] Risk advisor update failed for ${updated.id}; returning updated report.`);
      }
      const responseReport = reportWithRisk || updated || report;

      const sentinelEnabled = (process.env.ENABLE_SENTINEL_HUB_VERIFICATION || "").toLowerCase() === "true";
      if (sentinelEnabled) {
        const readiness = getSentinelVerificationReadiness();
        if (readiness.ready) {
          responseReport.satelliteEvidence = buildPendingSatelliteEvidence(responseReport);
          await updateReport(responseReport.id, { satelliteEvidence: responseReport.satelliteEvidence });
          void enqueueSatelliteVerification(responseReport.id, responseReport.updatedAt);
        } else {
          responseReport.satelliteEvidence = buildPendingSatelliteEvidence(responseReport);
          if (responseReport.satelliteEvidence) {
            const unavailable = readiness.status === "authentication_failed" || readiness.status === "forbidden"
              ? "Satellite context is temporarily unavailable."
              : "Satellite context is unavailable in this environment.";
            responseReport.satelliteEvidence.status = "unavailable";
            responseReport.satelliteEvidence.explanation = unavailable;
            responseReport.satelliteEvidence.warnings = [unavailable];
            responseReport.satelliteEvidence.error = { code: readiness.errorCode || "SENTINEL_NOT_CONFIGURED", message: unavailable, retryable: false };
          }
          await updateReport(responseReport.id, { satelliteEvidence: responseReport.satelliteEvidence });
        }
      }

      res.status(201).json(await hydrateReportMediaUrls(responseReport));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Report verification failed.";
       const status = error instanceof MediaStorageUnavailableError || error instanceof VerificationError && error.reasonCode === "gemini_not_configured" ? 503 : error instanceof CaptureValidationError ? 400 : error instanceof VerificationError ? 422 : 500;
       res.status(status).json({
         error: error instanceof MediaStorageUnavailableError ? error.message : message,
         reasonCode: error instanceof MediaStorageUnavailableError ? error.code : error instanceof CaptureValidationError || error instanceof VerificationError ? error.reasonCode : "report_creation_failed"
       });
    }
  })();
});

reportsRouter.post("/analyze-report", async (req, res) => {
  const { reportId } = req.body || {};
  const report = await findReport(reportId);
  if (!report) {
    res.status(404).send("Report not found");
    return;
  }
  const [airQualityResult, forecastResult] = await Promise.allSettled([
    getAirQuality(report.lat, report.lng),
    getAqiForecast({ lat: report.lat, lng: report.lng })
  ]);
  const airQuality = airQualityResult.status === "fulfilled" ? airQualityResult.value : report.airQuality;
  const forecast = forecastResult.status === "fulfilled" ? forecastResult.value : report.forecast;
  const allReports = await listReports();
  const nearby = findNearbyReports(report, allReports);
  const hotspotScore = calculateHotspotScore(
    report.gemini.severity,
    nearby.similarReportCount,
    airQuality,
    report.evidenceScore,
    forecast,
    report.cpcbContext,
    report.gemini.pollution_type
  );
  const updated = await updateReport(report.id, {
    airQuality,
    forecast,
    nearby,
    hotspotScore,
    priority: priorityForReport(report, hotspotScore),
    status: "Submitted"
  });
  const refreshed = updated
    ? await updateReport(updated.id, {
        riskAdvisor: buildRiskAdvisor({
          report: updated,
          nearbyReports: allReports
        })
      })
    : updated;
  res.json(refreshed || updated);
});

// Netlify demonstration route: analyze a compressed browser image without
// creating a report or writing any media to server-side storage.
reportsRouter.post("/demo/analyze-evidence", async (req, res) => {
  const { imageBase64, imageMimeType, context } = req.body || {};
  if (typeof imageBase64 !== "string" || typeof imageMimeType !== "string") {
    return res.status(400).json({ error: "imageBase64 and imageMimeType are required", reasonCode: "missing_required_fields" });
  }
  try {
    const gemini = await analyzeImageData({ imageBase64, imageMimeType, context: typeof context === "string" ? context : undefined });
    const decision = decideVerification(gemini);
    res.json({ gemini, decision });
  } catch (error) {
    const verification = error instanceof VerificationError;
    res.status(verification && error.reasonCode === "gemini_not_configured" ? 503 : verification ? 422 : 500).json({
      error: error instanceof Error ? error.message : "Demo image analysis failed.",
      reasonCode: verification ? error.reasonCode : "demo_analysis_failed"
    });
  }
});

reportsRouter.post("/debug/gemini-image", async (req, res) => {
  if (process.env.NODE_ENV === "production" || process.env.DEBUG_GEMINI_ROUTE === "false") {
    res.status(404).send("Not found");
    return;
  }
  const { imageBase64, originalBase64, imageMimeType, context } = req.body || {};
  if (!imageBase64 || !imageMimeType) {
    res.status(400).json({
      error: "imageBase64 and imageMimeType are required",
      reasonCode: "missing_required_fields"
    });
    return;
  }
  try {
    const finalGemini = await analyzeImageData({
      imageBase64,
      fallbackImageBase64: originalBase64,
      imageMimeType,
      context
    });
    const backendDecision = decideVerification(finalGemini);
    res.json({
      finalGemini,
      backendDecision,
      confidence: finalGemini.confidence,
      evidence_strength: finalGemini.evidence_strength,
      image_quality: finalGemini.image_quality,
      trust_decision: finalGemini.trust_decision,
      second_pass_used: finalGemini.second_pass_used,
      rejection_reason: finalGemini.rejection_reason,
      notes: "Development-only Gemini classifier check. No media was stored and no report was created."
    });
  } catch (error) {
    res.status(error instanceof VerificationError && error.reasonCode === "gemini_not_configured" ? 503 : error instanceof VerificationError ? 422 : 500).json({
      error: error instanceof Error ? error.message : "Gemini debug check failed.",
      reasonCode: error instanceof VerificationError ? error.reasonCode : "gemini_debug_failed"
    });
  }
});

reportsRouter.get("/air-quality", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).send("lat and lng query params are required");
    return;
  }
  res.json(await getAirQuality(lat, lng));
});

reportsRouter.get("/forecast/stations", async (_req, res) => {
  res.json(await getForecastStations());
});

reportsRouter.get("/forecast", async (req, res) => {
  const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
  const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
  res.json(await getAqiForecast({
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined
  }));
});

reportsRouter.get("/air-quality/forecast-24h", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }
  res.json(await getAqiForecast({ lat, lng }));
});

function pollutantQuery(value: unknown): CpcbPollutantCode | "all" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.toUpperCase();
  if (normalized === "ALL") return "all";
  if (normalized === "PM2.5" || normalized === "PM25") return "PM2.5";
  if (normalized === "PM10") return "PM10";
  if (normalized === "NO2") return "NO2";
  if (normalized === "SO2") return "SO2";
  if (normalized === "CO") return "CO";
  if (normalized === "OZONE" || normalized === "O3") return "OZONE";
    if (normalized === "NH3") return "NH3";
    if (normalized === "PB" || normalized === "LEAD") return "PB";
  return undefined;
}

reportsRouter.get("/air-quality/cpcb/status", async (_req, res) => {
  res.json(await getCpcbStatus());
});

reportsRouter.get("/air-quality/cpcb/completeness", async (_req, res) => {
  res.json(await getCpcbStatus());
});

reportsRouter.get("/air-quality/openaq/status", async (req, res) => {
  const check = req.query.check === "true";
  res.json(await getOpenAqStatus(check));
});

reportsRouter.get("/air-quality/cpcb/nearby", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }
  const radiusKm = req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : undefined;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  try {
    res.json(await getNearbyCpcbStations(lat, lng, {
      radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
      pollutant: pollutantQuery(req.query.pollutant)
    }));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to load nearby CPCB stations.", reasonCode: "invalid_cpcb_query" });
  }
});

reportsRouter.get("/air-quality/openaq/nearby", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: "lat and lng query params are required", reasonCode: "invalid_coordinates" });
    return;
  }
  const radiusKm = req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : 25;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : 12;
  try {
    validateOpenAqRadius(radiusKm);
    const stations = await getOpenAqNearbyStations(lat, lng, { radiusKm, limit });
    res.json({ provider: "openaq", lat, lng, radiusKm, stations, stationCount: stations.length, generatedAt: new Date().toISOString(), sourceNote: "OpenAQ monitoring locations and latest measurements. Values are station-derived context, not exact street-level sensor data." });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Unable to load nearby OpenAQ stations.", reasonCode: "openaq_query_failed" });
  }
});

reportsRouter.get("/air-quality/cpcb/local-context", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: "lat and lng query params are required" });
    return;
  }
  const radiusKm = req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : undefined;
  res.json(await getCpcbLocalPollutantContext(lat, lng, {
    radiusKm: Number.isFinite(radiusKm) ? radiusKm : undefined,
    pollutant: pollutantQuery(req.query.pollutant)
  }));
});

reportsRouter.get("/locality", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).send("lat and lng query params are required");
    return;
  }
  const historical = req.query.historical === "true";
  res.json(buildLocalityIntelligence({
    lat,
    lng,
    historical,
    reports: await listReports()
  }));
});

reportsRouter.get("/air-quality/sources", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).send("lat and lng query params are required");
    return;
  }
  res.json(await getAirQualitySources(lat, lng));
});

// Dev-only debug endpoint to see what DataGov actually returns
reportsRouter.get("/air-quality/cpcb/raw-page", async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(403).json({ error: "Dev only" });
  try {
    const offset = Number(req.query.offset) || 0;
    const limit = Number(req.query.limit) || 10;
    
    const resourceId = process.env.CPCB_RESOURCE_ID || "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69";
    const apiKey = process.env.DATA_GOV_API_KEY || "";
    
    const url = new URL(`https://api.data.gov.in/resource/${resourceId}`);
    url.searchParams.set("api-key", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    
    const start = Date.now();
    const response = await fetch(url);
    const duration = Date.now() - start;
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `DataGov returned ${response.status}`, body: await response.text() });
    }
    
    const data = await response.json() as any;
    const records = data.records || [];
    
    res.json({
      configured: Boolean(apiKey),
      resourceId,
      requestedOffset: offset,
      requestedLimit: limit,
      durationMs: duration,
      rawCount: data.count,
      rawTotal: data.total,
      rawLimit: data.limit,
      rawOffset: data.offset,
      firstRecordKeys: records.length > 0 ? Object.keys(records[0]) : [],
      recordSample: records.slice(0, 3)
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

reportsRouter.get("/air-quality/map", async (req, res) => {
  const hasLat = typeof req.query.lat === "string";
  const hasLng = typeof req.query.lng === "string";
  if (hasLat !== hasLng) return res.status(400).json({ error: "lat and lng must be provided together." });
  const lat = hasLat ? Number(req.query.lat) : undefined;
  const lng = hasLng ? Number(req.query.lng) : undefined;
  if ((lat !== undefined && (!Number.isFinite(lat) || lat < -90 || lat > 90)) || (lng !== undefined && (!Number.isFinite(lng) || lng < -180 || lng > 180))) {
    return res.status(400).json({ error: "lat and lng must be valid coordinates." });
  }
  const country = typeof req.query.country === "string" ? req.query.country : undefined;
  const iso = typeof req.query.iso === "string" ? req.query.iso : undefined;
  const isGlobal = req.query.global === "true" || country?.toLowerCase() === "global";

  res.json(await getAirQualityMap({
    lat,
    lng,
    country,
    iso,
    global: isGlobal
  }));
});

reportsRouter.get("/air-quality/national-status", async (req, res) => {
  const forceRefresh = req.query.refresh === "true";
  if (forceRefresh) await refreshOpenAqNationalSnapshot();
  const [cpcb, map] = await Promise.all([getCpcbStatus(), getAirQualityMap()]);
  const openaq = getOpenAqNationalSnapshot().status;
  const currentAqi = getCurrentAqiStatus();
  const counts = map.providerCounts || {};
  res.json({
    generatedAt: new Date().toISOString(),
    cpcb: { configured: Boolean(process.env.DATA_GOV_API_KEY), complete: Boolean(cpcb.complete), apiReportedTotal: cpcb.apiReportedTotal, rawFetchedCount: cpcb.rawFetchedCount, uniqueFetchedCount: cpcb.uniqueFetchedCount, fetchedPageCount: cpcb.fetchedPageCount, expectedPageCount: cpcb.expectedPageCount, stationCount: cpcb.stationCount, stopReason: cpcb.stopReason, staleCacheInUse: Boolean(cpcb.staleFallback) },
    openaq: { configured: openaq.configured, authenticationSuccessful: openaq.authenticationSuccessful, metadataComplete: openaq.metadataComplete, latestSnapshotComplete: openaq.latestSnapshotComplete, providerReportedLocationCount: openaq.providerReportedLocationCount, fetchedLocationCount: openaq.fetchedLocationCount, processedLocationCount: openaq.processedLocationCount, successfulLatestCount: openaq.successfulLatestCount, failedLatestCount: openaq.failedLatestCount, staleLocationCount: openaq.staleLocationCount, queuedLocationCount: openaq.queuedLocationCount, lastRefreshAt: openaq.lastRefreshAt, nextRefreshAt: openaq.nextRefreshAt },
    merged: { physicalStationCount: map.points.length, matchedStationCount: counts.fused_measured || 0, cpcbOnlyCount: counts.cpcb_data_gov || 0, openAqOnlyCount: counts.openaq || 0, lowConfidenceMatchCount: 0 },
    pollutants: map.metricCoverage,
    aqi: map.aqiCoverage,
    currentAqi,
    nationalMapComplete: Boolean(map.completeness?.nationalMapComplete),
    warnings: map.warnings?.map((warning) => warning.message) || []
  });
});

reportsRouter.get("/air-quality/aqi-status", async (req, res) => {
  // Keep polling nonblocking. The national OpenAQ sync is intentionally a
  // background job; waiting for hundreds of provider requests here would make
  // the frontend unable to observe progress.
  const initialNational = getOpenAqNationalSnapshot();
  if (req.query.refresh === "true" && initialNational.stations.length > 0) void refreshOpenAqNationalSnapshot();
  const national = getOpenAqNationalSnapshot();
  if (req.query.refresh === "true") {
    void refreshCurrentAqiSnapshot(national.stations);
  } else {
    getCurrentAqiSnapshot(national.stations);
  }
  const current = getCurrentAqiStatus();
  const cachedCoverage = getLatestAqiCoverage();
  const coverage = cachedCoverage
    ? { ...cachedCoverage, providerReported: cachedCoverage.providerReportedEligibleStations, rollingValidated: current.successfulValidatedStations, indicative: cachedCoverage.indicativeEligibleStations, pending: current.queuedStations, unavailable: cachedCoverage.unavailableStations, totalPhysicalStations: cachedCoverage.totalPhysicalStations }
    : { providerReported: 0, rollingValidated: current.successfulValidatedStations, indicative: 0, pending: current.queuedStations, unavailable: 0, totalPhysicalStations: current.totalPhysicalStations };
  const warnings = [...new Set([...(national.status.refreshing ? ["OpenAQ national station synchronization is still running."] : []), ...current.warnings])];
  res.json({ generatedAt: new Date().toISOString(), snapshot: current, coverage, reasons: current.reasons, warnings });
});

reportsRouter.get("/air-quality/audit/station/:physicalStationId", async (req, res) => {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "Not found" });
  const map = await getAirQualityMap();
  const point = map.points.find((candidate) => candidate.physicalStationId === req.params.physicalStationId || candidate.id === req.params.physicalStationId);
  if (!point) return res.status(404).json({ error: "Station not found" });
  res.json({ id: point.id, physicalStationId: point.physicalStationId, name: point.name, provider: point.provider, coordinates: { lat: point.lat, lng: point.lng }, metricDetails: point.metricDetails, aqi: point.aqiStatus, station: point.station, attribution: point.attribution });
});

reportsRouter.get("/air-quality/local-map", async (req, res) => {
  const region = typeof req.query.region === "string" ? req.query.region : "pune_pcmc";
  res.json(await getLocalAirQualityMap(region));
});

reportsRouter.get("/air-quality/debug", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).send("Not found");
    return;
  }
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).send("lat and lng query params are required");
    return;
  }
  res.json(await getAirQualityDebug(lat, lng));
});

reportsRouter.patch("/reports/:id/status", (req, res) => {
  void (async () => {
    const status = req.body?.status as ReportStatus;
    if (!status) {
      res.status(400).send("status is required");
      return;
    }
    const report = await updateStatus(req.params.id, status);
    if (!report) {
      res.status(404).send("Report not found");
      return;
    }
    res.json(report);
  })();
});

reportsRouter.patch("/reports/:id/action", (req, res) => {
  void (async () => {
    const report = await findReport(req.params.id);
    if (!report) {
      res.status(404).send("Report not found");
      return;
    }
    const now = new Date().toISOString();
    const { status, assignedTo, assignedDepartment, actionTaken, notes } = req.body || {};
    const updated = await updateReport(report.id, {
      status: status || report.status,
      assignedTo,
      assignedDepartment,
      actionTaken,
      actionLog: [
        ...(report.actionLog ?? []),
        {
          type: assignedTo || assignedDepartment ? "assigned" : "status_changed",
          at: now,
          note: [status, assignedDepartment, assignedTo, actionTaken, notes].filter(Boolean).join(" · ") || undefined
        }
      ],
      statusHistory: appendStatusHistory(report, assignedTo || assignedDepartment ? "assigned" : "acknowledged", assignedTo || assignedDepartment ? "Assigned to Municipal Team" : "Officer Acknowledged", "officer", notes)
    });
    res.json(updated);
  })();
});

reportsRouter.post("/reports/:id/resolve", (req, res) => {
  res.status(410).json({
    error: "Direct resolution is no longer supported. Municipal cleanup proof and Officer approval are required.",
    reasonCode: "legacy_resolution_route_disabled"
  });
  return;
  void (async () => {
    const report = await findReport(req.params.id);
    if (!report) {
      res.status(404).json({ error: "Report not found", reasonCode: "not_found" });
      return;
    }
    const { afterImageBase64, imageMimeType, actionTaken, notes, resolvedBy } = req.body || {};
    if (!afterImageBase64 || !imageMimeType || !actionTaken) {
      res.status(400).json({
        error: "afterImageBase64, imageMimeType, and actionTaken are required",
        reasonCode: "missing_required_fields"
      });
      return;
    }
    const afterMedia = await storeResolutionMedia({
      reportId: report.id,
      imageBase64: afterImageBase64,
      mimeType: imageMimeType
    });
    const resolvedAt = new Date().toISOString();
    const updated = await updateReport(report.id, {
      status: "Resolved",
      priority: "resolved",
      resolvedAt,
      actionTaken,
      resolutionProof: {
        beforeMediaId: report.primaryMediaId,
        afterMedia,
        actionTaken,
        resolvedBy,
        resolvedAt,
        notes
      },
      actionLog: [
        ...(report.actionLog ?? []),
        { type: "resolution_proof_uploaded", at: resolvedAt, note: actionTaken },
        { type: "resolved", at: resolvedAt, note: notes || actionTaken }
      ]
    });
    res.json(updated);
  })();
});

// Municipal workflow: a municipal field team may provide progress and cleanup evidence, but this
// route never resolves a citizen report. Officer approval remains required.
reportsRouter.patch("/reports/:id/ngo-progress", async (req, res) => {
  const report = await findReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  const status = req.body?.status;
  if (!['Accepted', 'Cleanup In Progress'].includes(status)) return res.status(400).json({ error: "Invalid municipal progress status" });
  const now = new Date().toISOString();
  const ngoName = typeof req.body?.ngoName === "string" ? req.body.ngoName : report.ngoAssignment?.ngoName || "Demo Municipal Team";
  const accepted = status === "Accepted";
  res.json(await updateReport(report.id, { status: accepted ? "Accepted" : "In Progress", ngoAssignment: { ngoName, assignedAt: report.ngoAssignment?.assignedAt || now, status }, actionLog: [...(report.actionLog || []), { type: "ngo_progress_updated", at: now, note: status }], statusHistory: appendStatusHistory(report, accepted ? "accepted" : "cleanup_in_progress", accepted ? "Accepted" : "Cleanup In Progress", "municipal", status) }));
});

reportsRouter.post("/reports/:id/ngo-cleanup-proof", async (req, res) => {
  if (process.env.VITE_DEMO_BROWSER_STORAGE === "true") {
    return res.status(409).json({ error: "This Netlify demonstration stores cleanup proof only in browser IndexedDB.", reasonCode: "browser_demo_storage_required" });
  }
  const report = await findReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  const { afterImageBase64, imageMimeType, uploaderId, locality, lat, lng, gpsAccuracy, actionTaken, note } = req.body || {};
  if (!afterImageBase64 || !imageMimeType || !uploaderId || !actionTaken) return res.status(400).json({ error: "afterImageBase64, imageMimeType, uploaderId and actionTaken are required" });
  if (report.cleanupProof) return res.status(409).json({ error: "A cleanup proof has already been submitted for this report" });
  let afterMedia;
  try {
    afterMedia = await storeResolutionMedia({ reportId: report.id, imageBase64: afterImageBase64, mimeType: imageMimeType });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup proof media could not be stored.";
    const status = /too large|unsupported media|empty/i.test(message) ? 413 : 500;
    return res.status(status).json({ error: message, reasonCode: status === 413 ? "invalid_media" : "media_storage_failed" });
  }
  const now = new Date().toISOString();
  // The comparison fields are explicitly preliminary demo values; no claim of
  // official resolution is made without an officer review.
  const cleanupProof = { afterMedia, submittedAt: now, uploaderId, locality, lat: Number(lat), lng: Number(lng), gpsAccuracy: Number(gpsAccuracy), actionTaken, note, cleanupPercentage: 0, locationMatch: Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)), aiConfidence: 0, remainingPollution: "Officer review required", summary: "Cleanup proof received; officer approval is pending." };
  res.json(await updateReport(report.id, { status: "Cleanup Proof Submitted", ngoAssignment: { ngoName: report.ngoAssignment?.ngoName || "Demo Municipal Team", assignedAt: report.ngoAssignment?.assignedAt || now, status: "Cleanup Proof Submitted" }, cleanupProof, actionLog: [...(report.actionLog || []), { type: "ngo_cleanup_proof_submitted", at: now, note: actionTaken }], statusHistory: appendStatusHistory(report, "cleanup_proof_submitted", "Cleanup Proof Submitted", "municipal", actionTaken) }));
});

// Publicly documented resolution workflow aliases. Municipal uploads use
// the same non-resolving proof path; officer approval is handled separately.
reportsRouter.get("/ngo/assigned-reports", async (_req, res) => {
  const reports = await listReports();
  res.json(await hydrateReportsMediaUrls(reports.filter((report) => report.ngoAssignment || report.assignedDepartment === "Sanitation")));
});
reportsRouter.patch("/ngo/reports/:id/status", async (req, res) => {
  req.url = `/reports/${req.params.id}/ngo-progress`;
  return (reportsRouter as any).handle(req, res);
});
reportsRouter.patch("/municipal/reports/:id/status", async (req, res) => {
  req.url = `/reports/${req.params.id}/ngo-progress`;
  return (reportsRouter as any).handle(req, res);
});
reportsRouter.post("/reports/:id/resolution-proof", async (req, res) => {
  req.url = `/reports/${req.params.id}/ngo-cleanup-proof`;
  return (reportsRouter as any).handle(req, res);
});
reportsRouter.get("/reports/:id/resolution", async (req, res) => {
  const report = await findReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json({ reportId: report.id, resolution: report.cleanupProof || report.resolutionProof || null });
});
reportsRouter.patch("/reports/:id/resolution-status", async (req, res) => {
  const report = await findReport(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  const status = req.body?.status;
  if (status !== "Resolved") return res.status(400).json({ error: "Only final approval as Resolved is available in this workflow" });
  if (!report.cleanupProof) return res.status(400).json({ error: "A municipal cleanup proof is required before approval" });
  if (report.status === "Resolved") return res.json(report);
  const now = new Date().toISOString();
  const officerId = typeof req.body?.officerId === "string" ? req.body.officerId : "Officer";
  const resolved = await updateReport(report.id, { status: "Resolved", priority: "resolved", resolvedAt: now, resolutionProof: { beforeMediaId: report.primaryMediaId, afterMedia: report.cleanupProof.afterMedia, actionTaken: report.cleanupProof.actionTaken || report.cleanupProof.note || "Municipal cleanup proof approved", resolvedBy: officerId, resolvedAt: now, notes: report.cleanupProof.note }, actionLog: [...(report.actionLog || []), { type: "resolved", at: now, note: "Officer approved municipal cleanup proof" }], statusHistory: appendStatusHistory(report, "resolved", "Resolved", "officer") });
  if (!resolved) return res.status(500).json({ error: "Unable to finalize report resolution" });
  // `resolved.priority` is deliberately set to "resolved" for the workflow UI.
  // Preserve the earlier priority so a qualifying high-priority case receives its bonus.
  const award = await awardResolutionPoints(resolved, await listReports(), report.priority);
  if (!award) return res.json(resolved);
  const rewarded = await updateReport(resolved.id, { reward: { points: award.transaction.points, transactionId: award.transaction.transactionId, reason: award.transaction.reason, awardedAt: award.transaction.createdAt } });
  res.json(rewarded || resolved);
});

// ── GET /api/reports/:id/contextual-intelligence ─────────────────────────────
reportsRouter.get("/reports/:id/contextual-intelligence", (req, res) => {
  void (async () => {
    const report = await findReport(req.params.id);
    if (!report) {
      res.status(404).json({ error: "Report not found", reasonCode: "not_found" });
      return;
    }
    const allReports = await listReports();
    const recurrence = analyzeRecurringHotspot(
      {
        id: report.id,
        lat: report.lat,
        lng: report.lng,
        pollutionType: report.gemini?.pollution_type,
        createdAt: report.createdAt
      },
      allReports,
      { radiusMeters: 2000, windowDays: 90 }
    );
    const sensitiveLocations = evaluateSensitiveLocationsSync(report.lat, report.lng, 1000);
    const contextualPriority = evaluateReportContextualPriority({
      basePriority: report.priority,
      severity: report.gemini?.severity ?? "low",
      evidenceScore: report.evidenceScore ?? 50,
      trustLevel: report.trustLevel ?? "Needs Review",
      hotspotScore: report.hotspotScore ?? 0,
      recurrence,
      sensitiveLocations
    });
    res.json({
      reportId: report.id,
      recurrence,
      sensitiveLocations,
      contextualPriority
    });
  })();
});

// ─── Situation routes ─────────────────────────────────────────────────────────

reportsRouter.get("/situations", (req, res) => {
  void (async () => {
    const reports = await hydrateReportsMediaUrls(await listReports());
    let situations = buildRankedSituations(reports);

    const priority = typeof req.query.priority === "string" ? req.query.priority : undefined;
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : undefined;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : undefined;
    const radiusMeters = req.query.radiusMeters !== undefined ? Number(req.query.radiusMeters) : undefined;
    const limit = req.query.limit !== undefined ? Math.min(100, Number(req.query.limit)) : 20;

    if (priority) {
      situations = situations.filter((s) => s.priority === priority);
    }
    if (
      lat !== undefined && lng !== undefined && radiusMeters !== undefined &&
      Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusMeters)
    ) {
      situations = situations.filter((s) =>
        distanceMeters(lat, lng, s.centerLat, s.centerLng) <= radiusMeters
      );
    }

    res.json({
      generatedAt: new Date().toISOString(),
      totalSituations: situations.length,
      situations: situations.slice(0, limit)
    });
  })();
});

reportsRouter.get("/situations/:id", (req, res) => {
  void (async () => {
    const reports = await hydrateReportsMediaUrls(await listReports());
    const situations = buildRankedSituations(reports);
    const situation = situations.find((s) => s.id === req.params.id);
    if (!situation) {
      res.status(404).json({ error: "Situation not found", reasonCode: "not_found" });
      return;
    }
    const linked = reports.filter((r) => situation.reportIds.includes(r.id));
    res.json({ situation, reports: linked });
  })();
});

// Suppress unused import warning for activeLocalityStatuses and dominantPollutionType
void activeLocalityStatuses;
void dominantPollutionType;
