import type { PollutionReport, SatelliteContextAssessment, SatelliteEvidence, SatelliteMetric, SentinelSceneSummary } from "../types.js";
import { getSentinelVerificationReadiness, SentinelProviderError } from "./sentinelHubClient.js";
import { searchSentinel2SceneRoles } from "./sentinelHubCatalogService.js";
import { getSentinel2BareSurfaceChip, getSentinel2NBRChip, getSentinel2SwirNirContextChip, getSentinel2TrueColorChip, narrowProcessingWindow, type SentinelProcessResult } from "./sentinelHubProcessService.js";
import { getSentinel2VerificationStats, type SentinelStatsResult } from "./sentinelHubStatsService.js";
import { storeSatelliteMedia, readMediaBuffer } from "./mediaStorageService.js";
import { findReport, updateReport } from "./reportStore.js";
import { classifySatelliteEventSuitability, type EventSuitability } from "./satelliteSuitability.js";
import { analyzeSatelliteComparison } from "./geminiSatelliteComparisonService.js";

function boundedNumber(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function reportLocation(report: PollutionReport) {
  const capture = report.captureEvidence?.captureLocation;
  if (capture && Number.isFinite(capture.lat) && Number.isFinite(capture.lng)) return { lat: capture.lat, lng: capture.lng, source: "frozen_capture_gps" as const };
  if (Number.isFinite(report.lat) && Number.isFinite(report.lng)) return { lat: report.lat, lng: report.lng, source: "legacy_report_coordinates" as const };
  return undefined;
}

function eventTime(report: PollutionReport) {
  const captureTime = report.captureEvidence?.photoCapturedAt;
  if (captureTime && Number.isFinite(Date.parse(captureTime))) return { value: captureTime, source: "photo_capture_time" as const };
  return { value: report.createdAt, source: "report_created_time" as const };
}

function deterministicAssessment(suitability: EventSuitability, status: SatelliteEvidence["observability"]["status"], reason: string, scene?: SentinelSceneSummary): SatelliteContextAssessment {
  const notObservable = status !== "observable" && status !== "partially_observable";
  return {
    result: notObservable ? "not_observable" : "inconclusive",
    confidence: 0,
    source: "deterministic",
    observability: notObservable ? "not_observable" : "partially_observable",
    eventSuitability: suitability.suitability,
    citizenPhotoSignals: [],
    satelliteSignals: scene ? ["A Sentinel-2 scene was available for contextual review."] : [],
    surfaceChangeSignals: [],
    contradictorySignals: [],
    temporalConsistency: scene && Math.abs(scene.temporalOffsetHours ?? 999) <= (suitability.maximumUsefulTemporalOffsetHours ?? 72) ? "relevant" : "mismatched",
    spatialContext: "unclear",
    explanation: reason,
    limitations: ["Satellite context is overhead spatial and temporal context, not proof of the citizen incident.", "The citizen photo remains the primary evidence."]
  };
}

function metricsForStats(stats: SentinelStatsResult, prefix = "") {
  return stats.metrics.map(metric => prefix ? { ...metric, name: `${prefix}_${metric.name}` as SatelliteMetric["name"] } : metric);
}

function metric(stats: SentinelStatsResult, name: SatelliteMetric["name"]) { return stats.metrics.find(item => item.name === name)?.value; }

export function satelliteContributionPoints(assessment: SatelliteContextAssessment) {
  if (assessment.result !== "potentially_consistent" && assessment.result !== "possible_surface_change") return 0;
  if (assessment.confidence < 35) return 1;
  if (assessment.confidence < 70) return 5;
  return 8;
}

async function saveProduct(reportId: string, filename: string, result: SentinelProcessResult, scene?: SentinelSceneSummary) {
  const stored = await storeSatelliteMedia({ reportId, filename, buffer: result.buffer, mimeType: "image/png" });
  return { url: stored.displayUrl, media: { ...stored, mimeType: "image/png" as const, sceneId: scene?.sceneId, acquiredAt: scene?.acquisitionTime }, result };
}

function baseEvidence(input: { report: PollutionReport; location: NonNullable<ReturnType<typeof reportLocation>>; event: ReturnType<typeof eventTime>; suitability: EventSuitability; status: SatelliteEvidence["status"]; assessment: SatelliteContextAssessment; reason: string; error?: SatelliteEvidence["error"] }): SatelliteEvidence {
  const radiusMeters = boundedNumber("SENTINEL_HUB_DEFAULT_AOI_RADIUS_METERS", 500, 100, boundedNumber("SENTINEL_HUB_MAX_AOI_RADIUS_METERS", 1500, 100, 3000));
  return {
    provider: "sentinel_hub",
    status: input.status,
    reportLocation: { lat: input.location.lat, lng: input.location.lng, source: input.location.source, aoiRadiusMeters: radiusMeters },
    eventTime: { photoCapturedAt: input.event.value, source: input.event.source },
    eventSuitability: { level: input.suitability.suitability, reason: input.suitability.reason },
    observability: { status: input.suitability.suitability === "not_suitable" ? "not_suitable_for_event_type" : "provider_unavailable", score: 0, reasons: [input.reason] },
    assessment: input.assessment,
    evidenceContributionPoints: 0,
    decisionEffect: "none",
    attribution: `Contains modified Copernicus Sentinel data ${new Date(input.event.value).getUTCFullYear()} processed by Sentinel Hub.`,
    warnings: [input.reason],
    checkedAt: new Date().toISOString(),
    scenes: {},
    products: {},
    metrics: [],
    explanation: input.reason,
    limitations: input.assessment.limitations,
    error: input.error
  };
}

export function buildPendingSatelliteEvidence(report: PollutionReport): SatelliteEvidence | undefined {
  const location = reportLocation(report);
  if (!location) return undefined;
  const event = eventTime(report);
  const suitability = classifySatelliteEventSuitability(report.gemini?.pollution_type || "unclear");
  return { ...baseEvidence({ report, location, event, suitability, status: "pending", assessment: deterministicAssessment(suitability, "provider_unavailable", "Satellite context check queued."), reason: "Satellite context check queued." }), requestedAt: new Date().toISOString() };
}

export async function verifyReportWithSatellite(reportId: string): Promise<{ success: boolean; report?: PollutionReport; evidence?: SatelliteEvidence; retryable: boolean }> {
  const report = await findReport(reportId);
  if (!report) return { success: false, retryable: false };
  return verifyReportObjectWithSatellite(report, { persist: true });
}

export async function verifyReportObjectWithSatellite(report: PollutionReport, options: { persist?: boolean } = {}): Promise<{ success: boolean; report?: PollutionReport; evidence?: SatelliteEvidence; retryable: boolean }> {
  const persist = options.persist ?? true;
  const saveEvidence = async (evidence: SatelliteEvidence) => {
    if (persist) await updateReport(report.id, { satelliteEvidence: evidence });
    return evidence;
  };
  const location = reportLocation(report);
  if (!location) return { success: false, report, retryable: false };
  const event = eventTime(report);
  const suitability = classifySatelliteEventSuitability(report.gemini?.pollution_type || "unclear");
  const patchProcessing: SatelliteEvidence = {
    ...baseEvidence({ report, location, event, suitability, status: "processing", assessment: deterministicAssessment(suitability, "provider_unavailable", "Satellite context check is processing."), reason: "Satellite context check is processing." }),
    requestedAt: new Date().toISOString()
  };
  await saveEvidence(patchProcessing);

  const readiness = getSentinelVerificationReadiness();
  if (!readiness.ready) {
    const state = readiness.status === "disabled"
      ? "Satellite context is disabled in this environment."
      : readiness.status === "authentication_failed" || readiness.status === "forbidden"
        ? "Satellite context is temporarily unavailable."
        : "Satellite context is unavailable because its provider configuration is incomplete.";
    const evidence = baseEvidence({ report, location, event, suitability, status: "unavailable", assessment: deterministicAssessment(suitability, "provider_unavailable", state), reason: state, error: { code: readiness.errorCode || "SENTINEL_NOT_CONFIGURED", message: state, retryable: false } });
    await saveEvidence(evidence);
    return { success: true, report: { ...report, satelliteEvidence: evidence }, evidence, retryable: false };
  }
  if (suitability.suitability === "not_suitable") {
    const evidence = baseEvidence({ report, location, event, suitability, status: "ready", assessment: deterministicAssessment(suitability, "not_suitable_for_event_type", suitability.reason), reason: "not_suitable_for_event_type" });
    evidence.observability = { status: "not_suitable_for_event_type", score: 0, reasons: [suitability.reason] };
    evidence.explanation = suitability.reason;
    await saveEvidence(evidence);
    return { success: true, report: { ...report, satelliteEvidence: evidence }, evidence, retryable: false };
  }

  try {
    const radiusMeters = boundedNumber("SENTINEL_HUB_DEFAULT_AOI_RADIUS_METERS", suitability.recommendedAoiRadiusMeters, 100, boundedNumber("SENTINEL_HUB_MAX_AOI_RADIUS_METERS", 1500, 100, 3000));
    const catalog = await searchSentinel2SceneRoles({
      lat: location.lat, lng: location.lng, eventTime: event.value, radiusMeters,
      maxCloudCover: boundedNumber("SENTINEL_HUB_MAX_TILE_CLOUD_COVER", 60, 0, 100),
      nearWindowDays: boundedNumber("SENTINEL_HUB_NEAR_WINDOW_DAYS", 3, 1, 14),
      baselineLookbackDays: boundedNumber("SENTINEL_HUB_BASELINE_LOOKBACK_DAYS", 45, 7, 90),
      followupDays: boundedNumber("SENTINEL_HUB_FOLLOWUP_DAYS", 14, 1, 30)
    });
    const near = catalog.nearReport;
    if (!near) {
      const evidence = baseEvidence({ report, location, event, suitability, status: "unavailable", assessment: deterministicAssessment(suitability, "temporal_mismatch", "No suitable Sentinel-2 acquisition was found near the report time."), reason: "No suitable acquisition near the report time.", error: { code: "SENTINEL_NO_SCENE", message: "No suitable acquisition near the report time.", retryable: false } });
      evidence.observability = { status: "temporal_mismatch", score: 0, reasons: ["No near-report acquisition satisfied the catalog constraints."] };
      await saveEvidence(evidence);
      return { success: true, report: { ...report, satelliteEvidence: evidence }, evidence, retryable: false };
    }
    const nearWindow = narrowProcessingWindow(near.acquisitionTime);
    const stats = await getSentinel2VerificationStats({ bbox: catalog.reportBbox, ...nearWindow, maxCloudCoverage: boundedNumber("SENTINEL_HUB_MAX_TILE_CLOUD_COVER", 60, 0, 100) });
    const localCloudPercent = stats.localCloudPercent;
    const validPixelPercent = stats.validAnalysisPixelPercent;
    const maxLocalCloud = boundedNumber("SENTINEL_HUB_MAX_LOCAL_CLOUD_PERCENT", 35, 0, 100);
    const minValid = boundedNumber("SENTINEL_HUB_MIN_VALID_PIXEL_PERCENT", 60, 0, 100);
    const temporalOffset = Math.abs(near.temporalOffsetHours ?? 999);
    const temporalOkay = temporalOffset <= (suitability.maximumUsefulTemporalOffsetHours ?? 72);
    const status: SatelliteEvidence["observability"]["status"] = !temporalOkay ? "temporal_mismatch" : stats.noUsablePixels || (validPixelPercent !== undefined && validPixelPercent < minValid) ? "insufficient_valid_pixels" : (localCloudPercent !== undefined && localCloudPercent > maxLocalCloud) ? "cloud_obscured" : "observable";
    const observationReason = status === "observable" ? "The AOI met the configured local-cloud and valid-pixel thresholds." : status === "cloud_obscured" ? "Local cloud cover prevented a reliable spectral assessment." : status === "insufficient_valid_pixels" ? "Too few cloud-free analysis pixels were available." : "The available acquisition was too far from the report time.";
    const products: SatelliteEvidence["products"] = {};
    const scenes: SatelliteEvidence["scenes"] = { nearReport: { ...near, localCloudPercent, validPixelPercent, catalogSceneId: near.sceneId } };
    const metrics = metricsForStats(stats);
    const nearProcess = await getSentinel2TrueColorChip({ bbox: catalog.reportBbox, ...nearWindow, maxCloudCoverage: boundedNumber("SENTINEL_HUB_MAX_TILE_CLOUD_COVER", 60, 0, 100), catalogSceneId: near.sceneId });
    const productMedia: NonNullable<SatelliteEvidence["productMedia"]> = {};
    const nearTrueColor = await saveProduct(report.id, "near-report-true-colour.png", nearProcess, near);
    products.nearTrueColor = nearTrueColor.url;
    productMedia.nearTrueColor = nearTrueColor.media;
    const swir = await getSentinel2SwirNirContextChip({ bbox: catalog.reportBbox, ...nearWindow, maxCloudCoverage: 100, catalogSceneId: near.sceneId });
    const swirProduct = await saveProduct(report.id, "swir-nir-context.png", swir, near);
    products.swirNirContext = swirProduct.url;
    productMedia.swirNirContext = swirProduct.media;
    const nbr = await getSentinel2NBRChip({ bbox: catalog.reportBbox, ...nearWindow, maxCloudCoverage: 100, catalogSceneId: near.sceneId });
    const nbrProduct = await saveProduct(report.id, "nbr-surface-change-context.png", nbr, near);
    products.nbrContext = nbrProduct.url;
    productMedia.nbrContext = nbrProduct.media;
    const bare = await getSentinel2BareSurfaceChip({ bbox: catalog.reportBbox, ...nearWindow, maxCloudCoverage: 100, catalogSceneId: near.sceneId });
    const bareProduct = await saveProduct(report.id, "bare-surface-context.png", bare, near);
    products.bareSurfaceContext = bareProduct.url;
    productMedia.bareSurfaceContext = bareProduct.media;

    let comparison: SatelliteEvidence["comparison"];
    const comparisonEligible = ["garbage_burning", "open_waste", "illegal_dumping", "construction_dust"].includes(report.gemini?.pollution_type || "");
    if (comparisonEligible && catalog.baseline) {
      const baselineWindow = narrowProcessingWindow(catalog.baseline.acquisitionTime);
      const baselineStats = await getSentinel2VerificationStats({ bbox: catalog.reportBbox, ...baselineWindow, maxCloudCoverage: 60 });
      if (!baselineStats.noUsablePixels && !stats.noUsablePixels) {
        const baselineNBR = metric(baselineStats, "nbr"); const comparisonNBR = metric(stats, "nbr");
        const baselineBSI = metric(baselineStats, "bsi"); const comparisonBSI = metric(stats, "bsi");
        comparison = { baselineNBR, comparisonNBR, deltaNBR: baselineNBR !== undefined && comparisonNBR !== undefined ? comparisonNBR - baselineNBR : undefined, baselineBSI, comparisonBSI, deltaBSI: baselineBSI !== undefined && comparisonBSI !== undefined ? comparisonBSI - baselineBSI : undefined, validPixelPercent: Math.min(baselineStats.validAnalysisPixelPercent ?? 0, stats.validAnalysisPixelPercent ?? 0) };
        scenes.baseline = { ...catalog.baseline, validPixelPercent: baselineStats.validAnalysisPixelPercent, localCloudPercent: baselineStats.localCloudPercent, catalogSceneId: catalog.baseline.sceneId };
        const baselineImage = await getSentinel2TrueColorChip({ bbox: catalog.reportBbox, ...baselineWindow, maxCloudCoverage: 60, catalogSceneId: catalog.baseline.sceneId });
        const baselineProduct = await saveProduct(report.id, "baseline-true-colour.png", baselineImage, catalog.baseline);
        products.baselineTrueColor = baselineProduct.url;
        productMedia.baselineTrueColor = baselineProduct.media;
      }
    }

    let assessment = deterministicAssessment(suitability, status, observationReason, near);
    const citizen = report.media?.find(media => media.mediaId === report.primaryMediaId) || report.media?.[0];
    const citizenBuffer = citizen ? await readMediaBuffer(citizen) : undefined;
    if (status === "observable" && citizenBuffer && products.nearTrueColor) {
      try {
        const satelliteImages: Array<{ label: string; buffer: Buffer; mimeType: string }> = [];
        const loadProduct = async (label: string, url?: string) => {
          if (!url) return;
          const response = await fetch(url.startsWith("http") ? url : `http://localhost:${process.env.PORT || 8787}${url}`);
          if (response.ok) satelliteImages.push({ label, buffer: Buffer.from(await response.arrayBuffer()), mimeType: "image/png" });
        };
        await loadProduct("IMAGE 2 — Near-report overhead true colour", products.nearTrueColor);
        await loadProduct("IMAGE 3 — Pre-event overhead baseline", products.baselineTrueColor);
        await loadProduct("IMAGE 5 — SWIR–NIR contextual composite", products.swirNirContext);
        await loadProduct("IMAGE 6 — NBR/surface-change context", products.nbrContext);
        assessment = await analyzeSatelliteComparison({ citizenPhoto: { label: "IMAGE 1 — Citizen ground-level photo", buffer: citizenBuffer, mimeType: citizen.mimeType }, satelliteImages, metadata: { pollutionType: report.gemini?.pollution_type, coordinates: [location.lat, location.lng], photoCapturedAt: event.value, nearAcquisitionTime: near.acquisitionTime, temporalOffsetHours: near.temporalOffsetHours, aoiRadiusMeters: radiusMeters, localCloudPercent, validPixelPercent, sourceResolution: "Sentinel-2 L2A bands at 10m/20m; output is resampled for display", formulas: { NBR: "(B08-B12)/(B08+B12)", BSI: "((B11+B04)-(B08+B02))/(B08+B04)" }, comparison } });
      } catch (error) {
        assessment = deterministicAssessment(suitability, status, "Satellite images were available, but the multimodal comparison was inconclusive.", near);
      }
    }
    const evidence: SatelliteEvidence = {
      provider: "sentinel_hub", status: "ready", reportLocation: { lat: location.lat, lng: location.lng, source: location.source, aoiRadiusMeters: radiusMeters }, eventTime: { photoCapturedAt: event.value, source: event.source }, eventSuitability: { level: suitability.suitability, reason: suitability.reason },
      observability: { status, score: status === "observable" ? 100 : 0, localCloudPercent, validPixelPercent, geometryPixelCount: stats.geometryPixelCount, temporalOffsetHours: near.temporalOffsetHours, reasons: [observationReason] }, assessment, evidenceContributionPoints: satelliteContributionPoints(assessment), decisionEffect: satelliteContributionPoints(assessment) > 0 ? "supporting_context" : "none", attribution: `Contains modified Copernicus Sentinel data ${new Date(event.value).getUTCFullYear()} processed by Sentinel Hub.`, warnings: ["Satellite context is overhead spatial and temporal context, not proof of the citizen incident.", ...(nearProcess.warning ? [nearProcess.warning] : [])], checkedAt: new Date().toISOString(), completedAt: new Date().toISOString(), scenes, products, productMedia, metrics, comparison, explanation: assessment.explanation, limitations: [...new Set(["Sentinel-2 resolution may miss small, short-lived or street-level events.", "Cloud, atmospheric conditions and acquisition timing limit interpretation.", "Satellite context does not replace the citizen photo or field inspection.", ...assessment.limitations])]
    };
    await saveEvidence(evidence);
    return { success: true, report: { ...report, satelliteEvidence: evidence }, evidence, retryable: false };
  } catch (error) {
    const provider = error instanceof SentinelProviderError;
    const retryable = provider ? error.retryable : true;
    const message = error instanceof Error ? error.message : "Satellite context processing failed.";
    const evidence = baseEvidence({ report, location, event, suitability, status: retryable ? "failed" : "unavailable", assessment: deterministicAssessment(suitability, "provider_unavailable", message), reason: message, error: { code: provider ? error.code : "SATELLITE_PROCESSING_FAILED", message, retryable } });
    await saveEvidence(evidence);
    return { success: false, report: { ...report, satelliteEvidence: evidence }, evidence, retryable };
  }
}
