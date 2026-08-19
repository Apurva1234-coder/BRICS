import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { findReport, listReports } from "../server/services/reportStore.js";
import { readMediaBuffer } from "../server/services/mediaStorageService.js";
import { getSentinelHubAuthStatus, testTokenCheck } from "../server/services/sentinelHubAuthService.js";
import { verifyReportObjectWithSatellite, verifyReportWithSatellite } from "../server/services/satelliteVerificationService.js";
import type { MediaEvidence, PollutionReport, SatelliteEvidence } from "../server/types.js";

type Args = { reportId?: string; photo?: string; lat?: number; lng?: number; capturedAt?: string; pollutionType?: string };

const supportedPollutionTypes = new Set([
  "garbage_burning", "open_waste", "illegal_dumping", "construction_dust", "road_dust",
  "vehicle_smoke", "industrial_smoke", "sewage", "water_pollution"
]);

function parseArgs(argv: string[]): Args {
  const result: Args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) continue;
    if (key === "--report-id") result.reportId = value;
    if (key === "--photo") result.photo = path.resolve(value);
    if (key === "--lat") result.lat = Number(value);
    if (key === "--lng") result.lng = Number(value);
    if (key === "--captured-at") result.capturedAt = value;
    if (key === "--pollution-type") result.pollutionType = value;
  }
  return result;
}

function fail(message: string): never {
  throw new Error(message);
}

function primaryPhoto(report: PollutionReport): MediaEvidence {
  const media = report.media.find(item => item.mediaId === report.primaryMediaId) || report.media.find(item => item.type === "photo") || report.media[0];
  if (!media || media.type !== "photo") fail("The selected report has no primary citizen photo.");
  return media;
}

function validateReport(report: PollutionReport) {
  const capture = report.captureEvidence;
  if (!capture || capture.captureMethod !== "live_camera") fail("The report does not contain live-camera capture evidence.");
  if (!Number.isFinite(capture.captureLocation.lat) || !Number.isFinite(capture.captureLocation.lng)) fail("The report has no finite frozen capture coordinates.");
  if (!capture.photoCapturedAt || !Number.isFinite(Date.parse(capture.photoCapturedAt))) fail("The report has no valid photo capture timestamp.");
  if (report.status === "Rejected" || report.gemini.trust_decision === "rejected" || report.gemini.is_pollution_related === false) fail("The report was rejected or classified as unrelated.");
  if (!supportedPollutionTypes.has(report.gemini.pollution_type)) fail(`The report pollution type is not supported for satellite context: ${report.gemini.pollution_type}`);
  primaryPhoto(report);
}

async function selectReport(args: Args): Promise<PollutionReport> {
  if (args.reportId) {
    const report = await findReport(args.reportId);
    if (!report) fail(`Report not found: ${args.reportId}`);
    validateReport(report);
    return report;
  }
  const reports = await listReports();
  const report = reports.find(candidate => {
    try { validateReport(candidate); return true; } catch { return false; }
  });
  if (!report) fail("No eligible real report found. Provide --report-id or explicit photo/GPS/time arguments.");
  return report;
}

function explicitInput(args: Args) {
  if (!args.photo || !Number.isFinite(args.lat) || !Number.isFinite(args.lng) || !args.capturedAt || !Number.isFinite(Date.parse(args.capturedAt)) || !args.pollutionType) return undefined;
  if (args.lat < -90 || args.lat > 90 || args.lng < -180 || args.lng > 180) fail("Explicit coordinates are outside valid bounds.");
  if (!supportedPollutionTypes.has(args.pollutionType)) fail(`Unsupported --pollution-type: ${args.pollutionType}`);
  return args;
}

function evidenceSummary(evidence?: SatelliteEvidence) {
  const near = evidence?.scenes.nearReport;
  return {
    status: evidence?.status,
    selectedSceneId: near?.sceneId,
    selectedAcquisitionTime: near?.acquisitionTime,
    temporalOffsetHours: near?.temporalOffsetHours,
    tileCloudCover: near?.cloudCover,
    localCloudPercent: evidence?.observability.localCloudPercent,
    validPixelPercent: evidence?.observability.validPixelPercent,
    geometryPixelCount: evidence?.observability.geometryPixelCount,
    processedAcquisitionTimes: near?.processedAcquisitionTimes || [],
    sameAcquisitionConfirmed: near?.sameAcquisitionConfirmed ?? false,
    products: evidence?.products || {},
    assessment: evidence?.assessment,
    metrics: evidence?.metrics || [],
    warnings: evidence?.warnings || [],
    error: evidence?.error
  };
}

async function buildExplicitReport(args: Args, artifactDir: string): Promise<{ report: PollutionReport; photo: MediaEvidence; sourcePhotoPath: string }> {
  const input = explicitInput(args);
  if (!input) fail("Explicit mode requires --photo, --lat, --lng, --captured-at, and --pollution-type.");
  const source = await readFile(input.photo!);
  if (!source.byteLength) fail("The explicit citizen photo is empty.");
  const id = `E2E-${Date.now()}`;
  const extension = path.extname(input.photo!).toLowerCase() || ".jpg";
  const storagePath = `reports/${id}/original${extension}`;
  await mkdir(path.join(process.cwd(), "storage", "media", path.dirname(storagePath)), { recursive: true });
  await writeFile(path.join(process.cwd(), "storage", "media", storagePath), source);
  const media: MediaEvidence = { mediaId: "E2E-PHOTO", type: "photo", storagePath, mimeType: "image/jpeg", sizeBytes: source.byteLength, sha256Hash: createHash("sha256").update(source).digest("hex"), uploadedAt: new Date().toISOString(), capturedAt: input.capturedAt, storageProvider: "local_dev", metadataWarnings: [] };
  const pollutionType = input.pollutionType as PollutionReport["gemini"]["pollution_type"];
  const now = new Date().toISOString();
  const captureEvidence = { captureMethod: "live_camera" as const, cameraFacingMode: "environment" as const, photoCapturedAt: input.capturedAt!, captureLocation: { lat: input.lat!, lng: input.lng!, accuracyMeters: 0, capturedAt: input.capturedAt! } };
  const report: PollutionReport = { id, createdAt: now, updatedAt: now, userId: "sentinel-e2e", status: "Submitted", lat: input.lat!, lng: input.lng!, areaText: "Explicit Sentinel E2E location", media: [media], primaryMediaId: media.mediaId, evidenceStatus: "stored", authenticityScore: 0, authenticityFlags: [], evidenceScore: 0, trustLevel: "Needs Review", evidenceReasons: [], actionLog: [], imageHash: media.sha256Hash, userDescription: "Explicit host-side Sentinel verification input", gemini: { is_pollution_related: true, pollution_visible: true, image_quality: "usable", image_quality_score: 80, pollution_type: pollutionType, confidence: 80, severity: "medium", evidence_strength: 50, visible_evidence: ["explicit E2E input"], possible_pollutants: [], public_summary: "Host-side verification input", municipal_action: "Review", needs_manual_review: true, trust_decision: "needs_review", safety_note: "Do not approach smoke or fire." }, airQuality: { provider: "unavailable", category: "Unavailable", pollutants: {}, rawSummary: "Host-side verification input" }, nearby: { similarReportCount: 0, nearbyReportIds: [] }, hotspotScore: 0, priority: "watch", captureEvidence };
  await writeFile(path.join(artifactDir, `citizen-photo${extension}`), source);
  return { report, photo: media, sourcePhotoPath: path.join(artifactDir, `citizen-photo${extension}`) };
}

async function saveProductArtifact(url: string | undefined, filename: string, artifactDir: string) {
  if (!url) return false;
  try {
    let buffer: Buffer;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const response = await fetch(url);
      if (!response.ok) return false;
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      const relative = url.replace(/^\/media\//, "");
      buffer = await readFile(path.join(process.cwd(), "storage", "media", relative));
    }
    await writeFile(path.join(artifactDir, filename), buffer);
    return buffer.byteLength > 0;
  } catch {
    return false;
  }
}

async function checkFrontendEndpoint(reportId: string) {
  const baseUrl = process.env.SENTINEL_E2E_BASE_URL || `http://localhost:${process.env.PORT || 8787}`;
  try {
    const response = await fetch(`${baseUrl}/api/satellite/report/${encodeURIComponent(reportId)}`);
    if (!response.ok) return { successful: false, httpStatus: response.status };
    const body = await response.json() as { satelliteEvidence?: SatelliteEvidence | null };
    return { successful: Boolean(body.satelliteEvidence), httpStatus: response.status };
  } catch (error) {
    return { successful: false, error: error instanceof Error ? error.message : "Endpoint request failed." };
  }
}

function tableRow(label: string, value: string) { return `${label.padEnd(28)} ${value}`; }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const explicit = explicitInput(args);
  const runId = `run-${new Date().toISOString().replace(/[.:]/g, "-")}`;
  const artifactDir = path.join(process.cwd(), "artifacts", "sentinel-e2e", runId);
  await mkdir(artifactDir, { recursive: true });

  const authStatus = await getSentinelHubAuthStatus();
  const auth = await testTokenCheck();
  const base = {
    runId,
    executionEnvironment: { sandbox: false, hostOperatingSystem: "Windows", networkReachabilityConfirmed: auth.status !== "network_error" },
    authentication: { successful: auth.ok, httpStatus: auth.ok ? 200 : undefined, status: auth.status, errorCode: auth.errorCode },
    input: explicit ? { reportId: undefined, photoPath: explicit.photo, lat: explicit.lat, lng: explicit.lng, photoCapturedAt: explicit.capturedAt, pollutionType: explicit.pollutionType, metadataSource: "explicit_arguments" } : undefined,
    artifacts: artifactDir,
    provider: { configured: authStatus.configured, endpoint: authStatus.baseEndpointHost }
  };
  if (!auth.ok) {
    const summary = { ...base, overall: { technicalIntegrationWorking: false, satelliteContextAvailable: false, reportScientificallyConfirmed: false, failedLayer: auth.status === "network_error" ? "OAuth network reachability" : "OAuth", warnings: ["No Catalog, Statistics, Process, Gemini, or report update calls were attempted."] } };
    await writeFile(path.join(artifactDir, "verification-summary.json"), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  const standalone = explicit ? await buildExplicitReport(explicit, artifactDir) : undefined;
  let report: PollutionReport;
  if (standalone) report = standalone.report;
  else {
    try { report = await selectReport(args); }
    catch (error) {
      if (args.reportId) throw error;
      console.log(JSON.stringify({ ...base, overall: { technicalIntegrationWorking: true, satelliteContextAvailable: false, reportScientificallyConfirmed: false, skipped: true, warnings: ["No eligible real citizen report was available for report-specific E2E verification."] } }, null, 2));
      return;
    }
  }
  const capture = report.captureEvidence!;
  const photo = standalone?.photo || primaryPhoto(report);
  const photoBuffer = standalone ? await readFile(standalone.sourcePhotoPath) : await readMediaBuffer(photo);
  if (!photoBuffer) fail("The selected report photo is not accessible from configured storage.");

  const result = standalone ? await verifyReportObjectWithSatellite(report, { persist: false }) : await verifyReportWithSatellite(report.id);
  const evidence = result.evidence;
  const productFiles: Record<string, boolean> = {};
  for (const [key, filename] of Object.entries({ nearTrueColor: "near-true-color.png", baselineTrueColor: "baseline-true-color.png", followUpTrueColor: "followup-true-color.png", swirNirContext: "near-swir-nir.png", nbrContext: "near-nbr.png", bareSurfaceContext: "bare-surface-context.png" })) {
    productFiles[key] = await saveProductArtifact(evidence?.products[key as keyof typeof evidence.products], filename, artifactDir);
  }
  const endpoint = standalone ? { successful: false, skipped: true, reason: "Standalone explicit-input mode does not update a report." } : await checkFrontendEndpoint(report.id);
  const scene = evidence?.scenes.nearReport;
  const assessment = evidence?.assessment;
  const summary = {
    ...base,
    input: { reportId: standalone ? undefined : report.id, photoPath: standalone?.sourcePhotoPath || path.join(artifactDir, `citizen-photo${path.extname(photo.storagePath) || ".jpg"}`), lat: capture.captureLocation.lat, lng: capture.captureLocation.lng, photoCapturedAt: capture.photoCapturedAt, pollutionType: report.gemini.pollution_type, frozenGpsSource: standalone ? "explicit_arguments" : "report.captureEvidence.captureLocation", photoTimeSource: standalone ? "explicit_arguments" : "report.captureEvidence.photoCapturedAt" },
    catalog: { successful: Boolean(scene || evidence?.error?.code !== "SENTINEL_CATALOG_FAILED"), candidateCount: evidence?.scenes ? Object.keys(evidence.scenes).length : 0, selectedSceneId: scene?.sceneId, selectedAcquisitionTime: scene?.acquisitionTime, temporalOffsetHours: scene?.temporalOffsetHours, tileCloudCover: scene?.cloudCover },
    observability: { successful: Boolean(scene && evidence?.metrics.some(metric => metric.name === "geometry_pixel_count")), localCloudPercent: evidence?.observability.localCloudPercent, validPixelPercent: evidence?.observability.validPixelPercent, geometryPixelCount: evidence?.observability.geometryPixelCount },
    process: { trueColorSuccessful: productFiles.nearTrueColor, swirNirSuccessful: productFiles.swirNirContext, nbrSuccessful: productFiles.nbrContext, baselineTrueColorSuccessful: productFiles.baselineTrueColor, sameAcquisitionConfirmed: scene?.sameAcquisitionConfirmed ?? false },
    gemini: { requestSuccessful: assessment?.source === "gemini_multimodal", result: assessment?.result, confidence: assessment?.confidence },
    report: { evidenceSaved: Boolean(evidence) && !standalone, frontendEndpoint: endpoint },
    evidence: evidenceSummary(evidence),
    overall: { technicalIntegrationWorking: Boolean(result.success && evidence && (productFiles.nearTrueColor || evidence.status === "unavailable") && (assessment?.source === "gemini_multimodal" || evidence.observability.status !== "observable")), satelliteContextAvailable: Boolean(evidence && evidence.status === "ready"), reportScientificallyConfirmed: false, warnings: evidence?.warnings || [] },
    productFiles
  };
  await writeFile(path.join(artifactDir, "sentinel-metadata.json"), JSON.stringify({ reportId: report.id, capture, photo, evidence: evidenceSummary(evidence) }, null, 2));
  await writeFile(path.join(artifactDir, "gemini-assessment.json"), JSON.stringify(assessment || null, null, 2));
  await writeFile(path.join(artifactDir, "verification-summary.json"), JSON.stringify(summary, null, 2));

  console.log(JSON.stringify(summary, null, 2));
  console.log("\n" + [
    tableRow("Sentinel OAuth", auth.ok ? "PASS" : "FAIL"),
    tableRow("Catalog search", summary.catalog.successful ? "PASS" : "FAIL"),
    tableRow("Near scene selected", scene ? "PASS" : "FAIL"),
    tableRow("Baseline selected", evidence?.scenes.baseline ? "PASS" : "SKIPPED"),
    tableRow("Local cloud stats", summary.observability.successful ? "PASS" : "FAIL"),
    tableRow("True-colour image", productFiles.nearTrueColor ? "PASS" : "FAIL"),
    tableRow("SWIR–NIR image", productFiles.swirNirContext ? "PASS" : "FAIL"),
    tableRow("NBR product", productFiles.nbrContext ? "PASS" : "FAIL"),
    tableRow("Acquisition consistency", scene?.sameAcquisitionConfirmed ? "PASS" : "WARNING"),
    tableRow("Gemini comparison", summary.gemini.requestSuccessful ? "PASS" : evidence?.observability.status === "observable" ? "FAIL" : "SKIPPED"),
    tableRow("Report evidence saved", summary.report.evidenceSaved ? "PASS" : "FAIL"),
    tableRow("Frontend endpoint updated", endpoint.successful ? "PASS" : "FAIL")
  ].join("\n"));
  console.log(`\nArtifacts: ${artifactDir}`);
  if (!summary.overall.technicalIntegrationWorking) process.exitCode = 1;
}

main().catch(async error => {
  const message = error instanceof Error ? error.message : "Sentinel E2E verification failed.";
  console.error(message);
  process.exitCode = 1;
});
