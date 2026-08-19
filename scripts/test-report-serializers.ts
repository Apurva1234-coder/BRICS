import assert from "node:assert/strict";
import type { PollutionReport } from "../server/types.js";
import {
  toCitizenReportDto,
  toMunicipalReportDto,
  toOfficerReportDto,
  toPublicReportDto
} from "../server/serializers/reportSerializers.js";

const report: PollutionReport = {
  id: "CLS-TEST-0001",
  createdAt: "2026-07-15T10:00:00.000Z",
  updatedAt: "2026-07-15T11:00:00.000Z",
  userId: "citizen-uid-123",
  status: "In Progress",
  lat: 18.520437,
  lng: 73.856743,
  areaText: "Koregaon Park, Pune",
  media: [{
    mediaId: "media-1",
    type: "photo",
    storagePath: "reports/CLS-TEST-0001/media-1/original.jpg",
    cloudUri: "gs://private-bucket/reports/CLS-TEST-0001/media-1/original.jpg",
    thumbnailPath: "reports/CLS-TEST-0001/media-1/thumbnail.jpg",
    publicUrl: "https://cdn.example.test/reports/CLS-TEST-0001/thumbnail.jpg",
    displayUrl: "https://cdn.example.test/reports/CLS-TEST-0001/original.jpg?signature=private",
    storageProvider: "firebase_storage",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    sha256Hash: "secret-image-hash",
    uploadedAt: "2026-07-15T10:00:00.000Z",
    capturedAt: "2026-07-15T09:58:00.000Z",
    width: 1280,
    height: 720,
    exifAvailable: true,
    metadataWarnings: []
  }],
  primaryMediaId: "media-1",
  evidenceStatus: "verified",
  authenticityScore: 91,
  authenticityFlags: ["capture-metadata-present"],
  evidenceScore: 84,
  trustLevel: "Verified",
  rejectionReason: "private verification note",
  scoreBreakdown: {
    visualEvidenceScore: 90,
    authenticityScore: 91,
    nearbyCorroborationScore: 66,
    locationConfidenceScore: 95,
    recencyScore: 88
  },
  evidenceReasons: ["Visible smoke"],
  locality: {
    locality_id: "locality-1",
    locality_name: "Koregaon Park",
    nearby_150m_count: 2,
    nearby_250m_count: 3,
    nearby_500m_count: 5,
    relatedReportIds: ["CLS-OTHER"],
    relatedMedia: []
  },
  actionLog: [
    { type: "report_created", at: "2026-07-15T10:00:00.000Z", note: "private initial note" },
    { type: "ngo_progress_updated", at: "2026-07-15T10:30:00.000Z", note: "Crew dispatched" }
  ],
  statusHistory: [
    { status: "Manual review needed", label: "Internal review", timestamp: "2026-07-15T10:01:00.000Z", updatedByRole: "system", message: "AI trust flag" },
    { status: "Cleanup In Progress", label: "Cleanup In Progress", timestamp: "2026-07-15T10:30:00.000Z", updatedByRole: "municipal", message: "private municipal note" }
  ],
  imageUrl: "https://cdn.example.test/reports/CLS-TEST-0001/fallback.jpg",
  imageHash: "top-level-secret-image-hash",
  userDescription: "Heavy smoke behind the market.",
  gemini: {
    is_pollution_related: true,
    pollution_visible: true,
    image_quality: "clear",
    image_quality_score: 95,
    pollution_type: "garbage_burning",
    confidence: 92,
    severity: "high",
    evidence_strength: 88,
    visible_evidence: ["Smoke plume"],
    rejection_reason: "internal raw Gemini rejection reason",
    possible_pollutants: ["PM2.5"],
    public_summary: "Visible smoke needs attention.",
    municipal_action: "Inspect and remove burning waste.",
    needs_manual_review: true,
    trust_decision: "verified",
    safety_note: "internal safety note"
  },
  airQuality: {
    provider: "cpcb_data_gov",
    aqi: 154,
    category: "Unhealthy",
    nearestStation: "Pune Station",
    debug: { secret: "debug payload" },
    warnings: [{ code: "stale_data", message: "Readings are stale" }]
  },
  captureEvidence: {
    captureMethod: "live_camera",
    cameraFacingMode: "environment",
    photoCapturedAt: "2026-07-15T09:58:00.000Z",
    captureLocation: {
      lat: 18.520437,
      lng: 73.856743,
      accuracyMeters: 12,
      capturedAt: "2026-07-15T09:58:00.000Z"
    }
  },
  nearby: { similarReportCount: 4, nearbyReportIds: ["CLS-OTHER"] },
  hotspotScore: 77,
  priority: "high",
  ngoAssignment: {
    ngoName: "Pune Cleanup Team",
    assignedAt: "2026-07-15T10:20:00.000Z",
    status: "Cleanup In Progress"
  },
  cleanupProof: {
    afterMedia: {
      mediaId: "after-1",
      type: "photo",
      storagePath: "reports/CLS-TEST-0001/resolution/after.jpg",
      publicUrl: "https://cdn.example.test/reports/CLS-TEST-0001/after.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 2048,
      sha256Hash: "after-secret-hash",
      uploadedAt: "2026-07-15T10:45:00.000Z",
      metadataWarnings: []
    },
    submittedAt: "2026-07-15T10:45:00.000Z",
    uploaderId: "municipal-user-private",
    locality: "Koregaon Park",
    lat: 18.520437,
    lng: 73.856743,
    gpsAccuracy: 9,
    actionTaken: "Waste removed",
    note: "private cleanup note",
    cleanupPercentage: 90,
    locationMatch: true,
    remainingPollution: "Minor residue",
    summary: "Cleanup proof received."
  },
  actionTaken: "Coordinate municipal removal.",
  satelliteEvidence: {
    provider: "sentinel_hub",
    status: "ready",
    reportLocation: { lat: 18.520437, lng: 73.856743, source: "frozen_capture_gps", aoiRadiusMeters: 250 },
    eventTime: { photoCapturedAt: "2026-07-15T09:58:00.000Z", source: "photo_capture_time" },
    eventSuitability: { level: "suitable", reason: "Suitable evidence." },
    observability: { status: "observable", score: 80, reasons: ["Clear scene"] },
    assessment: {
      result: "potentially_consistent",
      confidence: 75,
      source: "deterministic",
      observability: "observable",
      eventSuitability: "suitable",
      citizenPhotoSignals: ["Smoke"],
      satelliteSignals: ["Change"],
      surfaceChangeSignals: [],
      contradictorySignals: [],
      temporalConsistency: "relevant",
      spatialContext: "potentially_consistent",
      explanation: "Operational assessment.",
      limitations: ["Limited resolution"]
    },
    evidenceContributionPoints: 10,
    decisionEffect: "supporting_context",
    attribution: "Sentinel Hub",
    warnings: [],
    scenes: {},
    products: {},
    metrics: [],
    explanation: "Satellite context available.",
    limitations: ["Cloud risk"]
  }
};

const original = structuredClone(report);
const publicDto = toPublicReportDto(report);
const citizenDto = toCitizenReportDto(report);
const municipalDto = toMunicipalReportDto(report);
const officerDto = toOfficerReportDto(report);

assert.deepEqual(report, original, "serializers must not mutate reports");
assert.equal(publicDto.approximateLat, 18.52);
assert.equal(publicDto.approximateLng, 73.857);
assert.equal(publicDto.status, "Cleanup Proof Submitted");
assert.equal(publicDto.thumbnailUrl, report.media[0].publicUrl);
assert.equal(JSON.stringify(publicDto).includes("citizen-uid-123"), false);
assert.equal(JSON.stringify(publicDto).includes("secret-image-hash"), false);
assert.equal(JSON.stringify(publicDto).includes("storagePath"), false);
assert.equal(JSON.stringify(publicDto).includes("private initial note"), false);
assert.equal(JSON.stringify(publicDto).includes("trustLevel"), false);

assert.equal(citizenDto.lat, report.lat);
assert.equal(citizenDto.gpsAccuracyMeters, 12);
assert.equal(citizenDto.status, "Cleanup Proof Submitted");
assert.deepEqual(citizenDto.statusHistory.map((entry) => entry.status), ["Submitted", "In Progress"]);
assert.equal(JSON.stringify(citizenDto).includes("private municipal note"), false);
assert.equal(JSON.stringify(citizenDto).includes("uploaderId"), false);
assert.equal(citizenDto.cleanupProof?.afterEvidence?.url, report.cleanupProof?.afterMedia.publicUrl);

assert.equal(municipalDto.lat, report.lat);
assert.equal(municipalDto.assignment?.teamName, "Pune Cleanup Team");
assert.equal(municipalDto.cleanupProof?.note, "private cleanup note");
assert.equal(JSON.stringify(municipalDto).includes("citizen-uid-123"), false);
assert.equal(JSON.stringify(municipalDto).includes("after-secret-hash"), false);
assert.equal(JSON.stringify(municipalDto).includes("storagePath"), false);

assert.equal(officerDto.verification.trustLevel, "Verified");
assert.equal(officerDto.satelliteEvidence?.status, "ready");
assert.equal(officerDto.airQuality.aqi, 154);
assert.equal(JSON.stringify(officerDto).includes("debug payload"), false);
assert.equal(JSON.stringify(officerDto).includes("cloudUri"), false);
assert.equal(JSON.stringify(officerDto).includes("top-level-secret-image-hash"), false);

const legacy = {
  ...report,
  media: [],
  actionLog: undefined,
  statusHistory: undefined,
  cleanupProof: undefined,
  resolutionProof: undefined,
  captureEvidence: undefined,
  nearby: undefined,
  satelliteEvidence: undefined
} as PollutionReport;

assert.doesNotThrow(() => toPublicReportDto(legacy));
assert.doesNotThrow(() => toCitizenReportDto(legacy));
assert.doesNotThrow(() => toMunicipalReportDto(legacy));
assert.doesNotThrow(() => toOfficerReportDto(legacy));
assert.equal(toCitizenReportDto(legacy).evidence, undefined);
assert.equal(toOfficerReportDto(legacy).satelliteEvidence, undefined);

console.log("report serializer tests passed");
