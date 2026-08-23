/**
 * server/services/recurringHotspotService.ts
 *
 * Deterministic, GIS-based historical recurrence intelligence for CleanAir Sentinel.
 * Analyzes historical reports/situations within a configurable geographic radius (default 2km)
 * and temporal window (default 90 days) without opaque LLM scoring.
 */

import type {
  HotspotRecurrenceClassification,
  PollutionReport,
  PollutionType,
  RecurringHotspotContext
} from "../types.js";
import { distanceMeters } from "../utils/geo.js";

const DEFAULT_RECURRENCE_RADIUS_METERS = 2000; // 2 km
const DEFAULT_RECURRENCE_WINDOW_DAYS = 90; // 90 days

// Related pollution groupings for context similarity
const RELATED_POLLUTION_GROUPS: Record<PollutionType, PollutionType[]> = {
  garbage_burning: ["garbage_burning", "open_waste", "illegal_dumping"],
  open_waste: ["open_waste", "garbage_burning", "illegal_dumping"],
  illegal_dumping: ["illegal_dumping", "open_waste", "garbage_burning"],
  road_dust: ["road_dust", "construction_dust"],
  construction_dust: ["construction_dust", "road_dust"],
  industrial_smoke: ["industrial_smoke", "vehicle_smoke"],
  vehicle_smoke: ["vehicle_smoke", "industrial_smoke"],
  sewage_overflow: ["sewage_overflow", "stagnant_water", "water_pollution"],
  stagnant_water: ["stagnant_water", "sewage_overflow", "water_pollution"],
  water_pollution: ["water_pollution", "sewage_overflow", "stagnant_water"],
  unclear: ["unclear"],
  not_pollution: []
};

export interface AnalyzeRecurrenceOptions {
  radiusMeters?: number;
  windowDays?: number;
  referenceTime?: string | number | Date;
}

export interface TargetIncident {
  id?: string;
  lat: number;
  lng: number;
  pollutionType?: PollutionType;
  createdAt?: string;
}

function calculatePollutionSimilarity(targetType?: PollutionType, candidateType?: PollutionType): number {
  if (!targetType || !candidateType) return 0.5;
  if (targetType === candidateType) return 1.0;
  const related = RELATED_POLLUTION_GROUPS[targetType];
  if (related && related.includes(candidateType)) return 0.7;
  return 0.4;
}

function calculateVerificationWeight(report: PollutionReport): number {
  if (report.trustLevel === "Verified" || report.evidenceStatus === "verified" || (report.evidenceScore ?? 50) >= 75) {
    return 1.0;
  }
  if (report.trustLevel === "Likely Valid" || (report.evidenceScore ?? 50) >= 60) {
    return 0.75;
  }
  return 0.4;
}

function calculateProximityFactor(distance: number, radiusMeters: number): number {
  const normalizedDist = Math.min(1, Math.max(0, distance / radiusMeters));
  return Math.max(0.4, 1 - normalizedDist * 0.5);
}

function calculateRecencyFactor(ageDays: number): number {
  if (ageDays <= 14) return 1.0;
  if (ageDays <= 30) return 0.85;
  if (ageDays <= 60) return 0.70;
  return 0.55;
}

function formatDaysAgo(ageDays: number): string {
  const days = Math.round(ageDays);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function classifyRecurrence(score: number, incidentCount: number): HotspotRecurrenceClassification {
  if (incidentCount <= 1 || score < 20) {
    return "no_recurring_history";
  }
  if (score < 45 || incidentCount <= 3) {
    return "emerging_hotspot";
  }
  if (score < 75 || incidentCount <= 6) {
    return "recurring_hotspot";
  }
  return "persistent_hotspot";
}

function formatPollutionType(type: PollutionType): string {
  return type.replace(/_/g, " ");
}

/**
 * Analyzes historical reports near a target coordinate to detect recurring pollution hotspots.
 * This function is deterministic and does not mutate input reports.
 */
export function analyzeRecurringHotspot(
  target: TargetIncident,
  allReports: readonly PollutionReport[],
  options?: AnalyzeRecurrenceOptions
): RecurringHotspotContext {
  const radiusMeters = options?.radiusMeters ?? DEFAULT_RECURRENCE_RADIUS_METERS;
  const windowDays = options?.windowDays ?? DEFAULT_RECURRENCE_WINDOW_DAYS;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const refTimeMs = options?.referenceTime
    ? new Date(options.referenceTime).getTime()
    : target.createdAt
    ? new Date(target.createdAt).getTime()
    : Date.now();

  // Find candidate historical reports within geographic radius & temporal window
  interface ScoredCandidate {
    report: PollutionReport;
    distance: number;
    ageDays: number;
    similarityScore: number;
  }

  const candidates: ScoredCandidate[] = [];

  for (const report of allReports) {
    // Exclude target itself
    if (target.id && report.id === target.id) continue;

    // Exclude invalid/false/rejected reports
    if (
      report.status === "False Report" ||
      report.status === "Rejected" ||
      report.gemini?.pollution_type === "not_pollution" ||
      report.trustLevel === "Rejected"
    ) {
      continue;
    }

    const dist = distanceMeters(target.lat, target.lng, report.lat, report.lng);
    if (dist > radiusMeters) continue;

    const reportTimeMs = new Date(report.createdAt).getTime();
    const ageMs = refTimeMs - reportTimeMs;

    // Allow reports within the past windowDays (or up to 1 day ahead to tolerate clock skew)
    if (ageMs < -24 * 60 * 60 * 1000 || ageMs > windowMs) continue;

    const ageDays = Math.max(0, ageMs / (24 * 60 * 60 * 1000));
    const candType = report.gemini?.pollution_type;
    const typeSim = calculatePollutionSimilarity(target.pollutionType, candType);
    const verWeight = calculateVerificationWeight(report);
    const proxFactor = calculateProximityFactor(dist, radiusMeters);
    const recFactor = calculateRecencyFactor(ageDays);

    const contribution = typeSim * verWeight * proxFactor * recFactor;

    candidates.push({
      report,
      distance: Math.round(dist),
      ageDays,
      similarityScore: contribution
    });
  }

  // Sort candidates by creation date descending (most recent first)
  candidates.sort(
    (a, b) =>
      new Date(b.report.createdAt).getTime() - new Date(a.report.createdAt).getTime()
  );

  const count = candidates.length;

  if (count === 0) {
    return {
      isRecurringHotspot: false,
      classification: "no_recurring_history",
      recurrenceScore: 0,
      similarIncidentCount: 0,
      verifiedIncidentCount: 0,
      activeIncidentCount: 0,
      radiusMeters,
      windowDays,
      observedPollutionTypes: target.pollutionType ? [target.pollutionType] : [],
      explanation: `No historical pollution incidents recorded within ${(radiusMeters / 1000).toFixed(1)} km in the last ${windowDays} days.`,
      reasons: ["No historical incidents detected within the evaluation window."],
      historicalIncidentIds: []
    };
  }

  // Aggregate statistics
  const verifiedCount = candidates.filter(
    (c) =>
      c.report.trustLevel === "Verified" ||
      c.report.evidenceStatus === "verified" ||
      (c.report.evidenceScore ?? 50) >= 75
  ).length;

  const activeCount = candidates.filter(
    (c) =>
      c.report.status !== "Resolved" &&
      c.report.status !== "Rejected" &&
      c.report.status !== "False Report"
  ).length;

  const observedTypesSet = new Set<PollutionType>();
  if (target.pollutionType) observedTypesSet.add(target.pollutionType);
  for (const c of candidates) {
    if (c.report.gemini?.pollution_type) {
      observedTypesSet.add(c.report.gemini.pollution_type);
    }
  }

  const earliestIncidentAt = candidates[candidates.length - 1].report.createdAt;
  const latestIncidentAt = candidates[0].report.createdAt;
  const mostRecentAgeDays = candidates[0].ageDays;

  // Compute deterministic recurrence score (0 - 100)
  const sumWeightedScores = candidates.reduce((sum, c) => sum + c.similarityScore, 0);

  let rawScore = 0;
  if (count === 1) {
    rawScore = Math.min(18, Math.round(sumWeightedScores * 18));
  } else if (count <= 3) {
    rawScore = Math.min(44, Math.round(20 + sumWeightedScores * 8));
  } else if (count <= 6) {
    rawScore = Math.min(74, Math.round(45 + sumWeightedScores * 5));
  } else {
    rawScore = Math.min(100, Math.round(75 + sumWeightedScores * 3.5));
  }

  const recurrenceScore = Math.min(100, Math.max(0, rawScore));
  const classification = classifyRecurrence(recurrenceScore, count);
  const isRecurringHotspot = classification !== "no_recurring_history";

  // Build human-readable explainability list
  const reasons: string[] = [];
  const radiusKmStr = (radiusMeters / 1000).toFixed(radiusMeters % 1000 === 0 ? 0 : 1);

  reasons.push(`${count} relevant incident${count > 1 ? "s" : ""} within ${radiusKmStr} km during the last ${windowDays} days.`);
  if (verifiedCount > 0) {
    reasons.push(`${verifiedCount} of ${count} were verified by photo and sensor evidence.`);
  }
  reasons.push(`Most recent similar incident occurred ${formatDaysAgo(mostRecentAgeDays)}.`);
  if (activeCount > 0) {
    reasons.push(`${activeCount} active incident${activeCount > 1 ? "s" : ""} still undergoing remediation.`);
  }

  const typesStr = Array.from(observedTypesSet)
    .map(formatPollutionType)
    .join(", ");

  let explanation = "";
  if (classification === "persistent_hotspot") {
    explanation = `Persistent pollution hotspot: ${count} incidents (${verifiedCount} verified) recorded within ${radiusKmStr} km over ${windowDays} days involving ${typesStr}.`;
  } else if (classification === "recurring_hotspot") {
    explanation = `Recurring pollution hotspot: ${count} incidents (${verifiedCount} verified) recorded within ${radiusKmStr} km over ${windowDays} days.`;
  } else if (classification === "emerging_hotspot") {
    explanation = `Emerging pollution hotspot: ${count} recent incidents detected within ${radiusKmStr} km.`;
  } else {
    explanation = `Isolated history: only ${count} prior incident within ${radiusKmStr} km.`;
  }

  return {
    isRecurringHotspot,
    classification,
    recurrenceScore,
    similarIncidentCount: count,
    verifiedIncidentCount: verifiedCount,
    activeIncidentCount: activeCount,
    radiusMeters,
    windowDays,
    earliestIncidentAt,
    latestIncidentAt,
    observedPollutionTypes: Array.from(observedTypesSet),
    explanation,
    reasons,
    historicalIncidentIds: candidates.map((c) => c.report.id)
  };
}
