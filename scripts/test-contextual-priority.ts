import assert from "node:assert/strict";
import {
  evaluateReportContextualPriority,
  evaluateSituationContextualPriority
} from "../server/services/contextualPriorityService.js";
import type { RecurringHotspotContext, SensitiveLocationImpactContext } from "../server/types.js";

const dummyRecurring: RecurringHotspotContext = {
  isRecurringHotspot: true,
  classification: "recurring_hotspot",
  recurrenceScore: 65,
  similarIncidentCount: 5,
  verifiedIncidentCount: 4,
  activeIncidentCount: 2,
  radiusMeters: 2000,
  windowDays: 90,
  observedPollutionTypes: ["garbage_burning"],
  explanation: "Recurring hotspot with 5 incidents",
  reasons: ["5 relevant incidents in 2 km / 90 days."],
  historicalIncidentIds: ["REP-1", "REP-2"]
};

const dummySensitive: SensitiveLocationImpactContext = {
  hasSensitiveLocations: true,
  impactScore: 70,
  totalCount: 3,
  categoryCounts: { school: 2, hospital: 1, childcare: 0, elderly_care: 0 },
  locations: [
    { id: "S1", name: "School A", category: "school", lat: 18.52, lng: 73.85, distanceMeters: 250, impactRadiusMeters: 1000, source: "curated_demo" },
    { id: "S2", name: "School B", category: "school", lat: 18.53, lng: 73.86, distanceMeters: 450, impactRadiusMeters: 1000, source: "curated_demo" },
    { id: "H1", name: "Hospital C", category: "hospital", lat: 18.525, lng: 73.855, distanceMeters: 300, impactRadiusMeters: 1200, source: "curated_demo" }
  ],
  primaryImpactRadiusMeters: 1000,
  summary: "2 schools, 1 hospital inside 1.0 km impact zone.",
  reasons: ["Impact area overlaps 2 schools and 1 hospital."],
  affectedFacilitiesSummary: ["School A (250m)", "Hospital C (300m)"]
};

const dummyEmptyRecurring: RecurringHotspotContext = {
  isRecurringHotspot: false,
  classification: "no_recurring_history",
  recurrenceScore: 0,
  similarIncidentCount: 0,
  verifiedIncidentCount: 0,
  activeIncidentCount: 0,
  radiusMeters: 2000,
  windowDays: 90,
  observedPollutionTypes: ["garbage_burning"],
  explanation: "No history",
  reasons: [],
  historicalIncidentIds: []
};

const dummyEmptySensitive: SensitiveLocationImpactContext = {
  hasSensitiveLocations: false,
  impactScore: 0,
  totalCount: 0,
  categoryCounts: { school: 0, hospital: 0, childcare: 0, elderly_care: 0 },
  locations: [],
  primaryImpactRadiusMeters: 1000,
  summary: "None",
  reasons: [],
  affectedFacilitiesSummary: []
};

// 1. Evidence Quality Gating: unverified or low-evidence report must NEVER be escalated
{
  const lowQualityResult = evaluateReportContextualPriority({
    basePriority: "watch",
    severity: "high",
    evidenceScore: 40,
    trustLevel: "Needs Review",
    hotspotScore: 30,
    recurrence: dummyRecurring,
    sensitiveLocations: dummySensitive
  });

  assert.equal(lowQualityResult.priorityElevated, false, "low evidence score must block priority escalation");
  assert.equal(lowQualityResult.finalPriority, "watch");
  assert.equal(lowQualityResult.elevationReasons.length, 0);

  const rejectedResult = evaluateReportContextualPriority({
    basePriority: "watch",
    severity: "severe",
    evidenceScore: 20,
    trustLevel: "Rejected",
    hotspotScore: 30,
    recurrence: dummyRecurring,
    sensitiveLocations: dummySensitive
  });
  assert.equal(rejectedResult.priorityElevated, false, "rejected trust must never escalate");
  assert.equal(rejectedResult.finalPriority, "watch");

  console.log("✓ test-contextual-priority: evidence quality gating passed");
}

// 2. High-quality report in recurring hotspot near hospital -> escalates to severe
{
  const verifiedResult = evaluateReportContextualPriority({
    basePriority: "high",
    severity: "high",
    evidenceScore: 85,
    trustLevel: "Verified",
    hotspotScore: 72,
    recurrence: dummyRecurring,
    sensitiveLocations: dummySensitive
  });

  assert.equal(verifiedResult.priorityElevated, true, "verified high priority with hospital & recurrence must escalate");
  assert.equal(verifiedResult.finalPriority, "severe");
  assert.ok(verifiedResult.elevationReasons.length > 0);
  assert.ok(verifiedResult.explanation.includes("SEVERE"));
  console.log("✓ test-contextual-priority: verified report escalation passed");
}

// 3. Situation contextual priority evaluation
{
  const situationResult = evaluateSituationContextualPriority({
    basePriority: "high",
    dominantSeverity: "high",
    evidenceScore: 82,
    situationScore: 74,
    recurrence: dummyRecurring,
    sensitiveLocations: dummySensitive
  });

  assert.equal(situationResult.priorityElevated, true);
  assert.equal(situationResult.finalPriority, "critical");
  assert.ok(situationResult.elevationReasons.some(r => r.includes("Recurring hotspot")));
  assert.ok(situationResult.elevationReasons.some(r => r.includes("2 schools, 1 hospital")));
  console.log("✓ test-contextual-priority: situation priority escalation passed");
}

// 4. Baseline without context maintains priority
{
  const cleanSituation = evaluateSituationContextualPriority({
    basePriority: "high",
    dominantSeverity: "high",
    evidenceScore: 80,
    situationScore: 70,
    recurrence: dummyEmptyRecurring,
    sensitiveLocations: dummyEmptySensitive
  });

  assert.equal(cleanSituation.priorityElevated, false);
  assert.equal(cleanSituation.finalPriority, "high");
  console.log("✓ test-contextual-priority: clean baseline priority maintenance passed");
}

console.log("\nAll contextual priority tests passed successfully!");
