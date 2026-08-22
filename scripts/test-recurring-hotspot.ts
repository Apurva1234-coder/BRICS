import assert from "node:assert/strict";
import type { PollutionReport } from "../server/types.js";
import { analyzeRecurringHotspot } from "../server/services/recurringHotspotService.js";

function makeTestReport(params: Partial<PollutionReport> & { id: string; lat: number; lng: number; createdAt: string }): PollutionReport {
  return {
    id: params.id,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
    userId: "test-user",
    status: params.status ?? "Submitted",
    lat: params.lat,
    lng: params.lng,
    areaText: "Test Area",
    media: [],
    evidenceStatus: params.evidenceStatus ?? "verified",
    authenticityScore: 90,
    authenticityFlags: [],
    evidenceScore: params.evidenceScore ?? 80,
    trustLevel: params.trustLevel ?? "Verified",
    evidenceReasons: ["Clear visual smoke"],
    actionLog: [],
    imageHash: `hash-${params.id}`,
    userDescription: "Visible pollution incident",
    gemini: {
      is_pollution_related: true,
      pollution_visible: true,
      image_quality: "usable",
      image_quality_score: 90,
      pollution_type: params.gemini?.pollution_type ?? "garbage_burning",
      confidence: 90,
      severity: params.gemini?.severity ?? "high",
      visible_evidence: ["Smoke"],
      possible_pollutants: ["PM2.5"],
      public_summary: "Garbage burning incident",
      municipal_action: "Extinguish burning waste",
      needs_manual_review: false,
      trust_decision: "verified",
      safety_note: "Keep clear"
    },
    airQuality: { provider: "unavailable", category: "Moderate" },
    nearby: { similarReportCount: 0, nearbyReportIds: [] },
    hotspotScore: 60,
    priority: "high"
  };
}

const now = new Date("2026-08-20T12:00:00.000Z");
const centerLat = 18.5204;
const centerLng = 73.8567;

// 1. Zero historical incidents
{
  const result = analyzeRecurringHotspot(
    { lat: centerLat, lng: centerLng, pollutionType: "garbage_burning", createdAt: now.toISOString() },
    [],
    { radiusMeters: 2000, windowDays: 90, referenceTime: now }
  );
  assert.equal(result.isRecurringHotspot, false, "empty history must not be a recurring hotspot");
  assert.equal(result.classification, "no_recurring_history");
  assert.equal(result.recurrenceScore, 0);
  assert.equal(result.similarIncidentCount, 0);
  console.log("✓ test-recurring-hotspot: zero historical incidents passed");
}

// 2. Incidents outside 2km radius must be excluded
{
  // 1 degree lat is ~111km, 0.03 deg is ~3.3km away
  const farReport = makeTestReport({
    id: "REP-FAR",
    lat: centerLat + 0.03,
    lng: centerLng + 0.03,
    createdAt: new Date(now.getTime() - 5 * 86_400_000).toISOString()
  });
  const result = analyzeRecurringHotspot(
    { lat: centerLat, lng: centerLng, pollutionType: "garbage_burning", createdAt: now.toISOString() },
    [farReport],
    { radiusMeters: 2000, windowDays: 90, referenceTime: now }
  );
  assert.equal(result.similarIncidentCount, 0, "incidents outside 2km must be excluded");
  assert.equal(result.isRecurringHotspot, false);
  console.log("✓ test-recurring-hotspot: spatial distance filtering passed");
}

// 3. Incidents older than 90 days must be excluded
{
  const oldReport = makeTestReport({
    id: "REP-OLD",
    lat: centerLat + 0.002,
    lng: centerLng + 0.002,
    createdAt: new Date(now.getTime() - 95 * 86_400_000).toISOString()
  });
  const result = analyzeRecurringHotspot(
    { lat: centerLat, lng: centerLng, pollutionType: "garbage_burning", createdAt: now.toISOString() },
    [oldReport],
    { radiusMeters: 2000, windowDays: 90, referenceTime: now }
  );
  assert.equal(result.similarIncidentCount, 0, "incidents older than 90 days must be excluded");
  console.log("✓ test-recurring-hotspot: temporal window filtering passed");
}

// 4. Multiple nearby incidents -> classification scaling
{
  // 2 nearby incidents within 500m in last 20 days -> Emerging hotspot
  const reports2 = [
    makeTestReport({ id: "REP-1", lat: centerLat + 0.001, lng: centerLng, createdAt: new Date(now.getTime() - 2 * 86_400_000).toISOString() }),
    makeTestReport({ id: "REP-2", lat: centerLat - 0.001, lng: centerLng, createdAt: new Date(now.getTime() - 10 * 86_400_000).toISOString() })
  ];
  const res2 = analyzeRecurringHotspot(
    { lat: centerLat, lng: centerLng, pollutionType: "garbage_burning", createdAt: now.toISOString() },
    reports2,
    { radiusMeters: 2000, windowDays: 90, referenceTime: now }
  );
  assert.equal(res2.isRecurringHotspot, true);
  assert.equal(res2.classification, "emerging_hotspot");
  assert.equal(res2.similarIncidentCount, 2);

  // 5 nearby incidents -> Recurring hotspot
  const reports5 = [
    ...reports2,
    makeTestReport({ id: "REP-3", lat: centerLat + 0.002, lng: centerLng, createdAt: new Date(now.getTime() - 15 * 86_400_000).toISOString() }),
    makeTestReport({ id: "REP-4", lat: centerLat - 0.002, lng: centerLng, createdAt: new Date(now.getTime() - 25 * 86_400_000).toISOString() }),
    makeTestReport({ id: "REP-5", lat: centerLat, lng: centerLng + 0.002, createdAt: new Date(now.getTime() - 40 * 86_400_000).toISOString() })
  ];
  const res5 = analyzeRecurringHotspot(
    { lat: centerLat, lng: centerLng, pollutionType: "garbage_burning", createdAt: now.toISOString() },
    reports5,
    { radiusMeters: 2000, windowDays: 90, referenceTime: now }
  );
  assert.equal(res5.isRecurringHotspot, true);
  assert.equal(res5.classification, "recurring_hotspot");
  assert.equal(res5.similarIncidentCount, 5);

  // 8 nearby incidents -> Persistent hotspot
  const reports8 = [
    ...reports5,
    makeTestReport({ id: "REP-6", lat: centerLat, lng: centerLng - 0.002, createdAt: new Date(now.getTime() - 50 * 86_400_000).toISOString() }),
    makeTestReport({ id: "REP-7", lat: centerLat + 0.003, lng: centerLng, createdAt: new Date(now.getTime() - 60 * 86_400_000).toISOString() }),
    makeTestReport({ id: "REP-8", lat: centerLat - 0.003, lng: centerLng, createdAt: new Date(now.getTime() - 75 * 86_400_000).toISOString() })
  ];
  const res8 = analyzeRecurringHotspot(
    { lat: centerLat, lng: centerLng, pollutionType: "garbage_burning", createdAt: now.toISOString() },
    reports8,
    { radiusMeters: 2000, windowDays: 90, referenceTime: now }
  );
  assert.equal(res8.isRecurringHotspot, true);
  assert.equal(res8.classification, "persistent_hotspot");
  assert.equal(res8.similarIncidentCount, 8);
  assert.ok(res8.recurrenceScore >= 75);
  console.log("✓ test-recurring-hotspot: recurrence classification scaling passed");
}

// 5. Mixed pollution types & verified weighting
{
  const exactTypeVerified = [
    makeTestReport({ id: "REP-E1", lat: centerLat + 0.001, lng: centerLng, createdAt: new Date(now.getTime() - 5 * 86_400_000).toISOString(), trustLevel: "Verified", evidenceScore: 90 })
  ];
  const unverifiedDifferent = [
    makeTestReport({
      id: "REP-U1",
      lat: centerLat + 0.001,
      lng: centerLng,
      createdAt: new Date(now.getTime() - 5 * 86_400_000).toISOString(),
      trustLevel: "Needs Review",
      evidenceScore: 40,
      gemini: { ...exactTypeVerified[0].gemini, pollution_type: "vehicle_smoke" }
    })
  ];

  const scoreExact = analyzeRecurringHotspot(
    { lat: centerLat, lng: centerLng, pollutionType: "garbage_burning", createdAt: now.toISOString() },
    exactTypeVerified,
    { referenceTime: now }
  ).recurrenceScore;

  const scoreUnverified = analyzeRecurringHotspot(
    { lat: centerLat, lng: centerLng, pollutionType: "garbage_burning", createdAt: now.toISOString() },
    unverifiedDifferent,
    { referenceTime: now }
  ).recurrenceScore;

  assert.ok(scoreExact > scoreUnverified, "exact verified incident must score higher than unverified different type");
  console.log("✓ test-recurring-hotspot: similarity & verification weighting passed");
}

// 6. Immutability check
{
  const reportsList = [
    makeTestReport({ id: "REP-IMM-1", lat: centerLat, lng: centerLng, createdAt: now.toISOString() }),
    makeTestReport({ id: "REP-IMM-2", lat: centerLat + 0.001, lng: centerLng, createdAt: now.toISOString() })
  ];
  const snapshot = JSON.stringify(reportsList);
  analyzeRecurringHotspot({ lat: centerLat, lng: centerLng, createdAt: now.toISOString() }, reportsList);
  assert.equal(JSON.stringify(reportsList), snapshot, "analyzeRecurringHotspot must not mutate input reports");
  console.log("✓ test-recurring-hotspot: immutability check passed");
}

console.log("\nAll recurring hotspot tests passed successfully!");
