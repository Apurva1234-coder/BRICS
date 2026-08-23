/**
 * server/services/contextualPriorityService.ts
 *
 * Deterministic contextual priority evaluation for CleanAir Sentinel.
 * Modifies base report/situation priorities using historical recurrence and
 * sensitive location impacts with strict evidence gating.
 */

import type {
  ContextualPriorityContext,
  PollutionReport,
  PollutionSituation,
  RecurringHotspotContext,
  SensitiveLocationImpactContext,
  Severity,
  SituationPriority,
  TrustLevel
} from "../types.js";

export interface EvaluateContextualReportPriorityParams {
  basePriority: PollutionReport["priority"];
  severity: Severity;
  evidenceScore: number;
  trustLevel: TrustLevel;
  hotspotScore: number;
  recurrence: RecurringHotspotContext;
  sensitiveLocations: SensitiveLocationImpactContext;
}

export interface EvaluateContextualSituationPriorityParams {
  basePriority: SituationPriority;
  dominantSeverity: Severity;
  evidenceScore: number;
  situationScore: number;
  recurrence: RecurringHotspotContext;
  sensitiveLocations: SensitiveLocationImpactContext;
}

/**
 * Calculates contextual priority for an individual pollution report.
 * Strict evidence gating prevents unverified or low-trust reports from escalating.
 */
export function evaluateReportContextualPriority(
  params: EvaluateContextualReportPriorityParams
): ContextualPriorityContext {
  const {
    basePriority,
    severity,
    evidenceScore,
    trustLevel,
    recurrence,
    sensitiveLocations
  } = params;

  if (basePriority === "resolved") {
    return {
      basePriority: "resolved",
      finalPriority: "resolved",
      priorityElevated: false,
      elevationReasons: [],
      explanation: "Report has been remediated and resolved."
    };
  }

  // Evidence gating: never escalate rejected or unverified reports
  const isVerifiedQuality =
    (trustLevel === "Verified" || trustLevel === "Likely Valid") &&
    evidenceScore >= 55;

  let finalPriority = basePriority;
  let priorityElevated = false;
  const elevationReasons: string[] = [];

  if (!isVerifiedQuality) {
    return {
      basePriority,
      finalPriority: basePriority,
      priorityElevated: false,
      elevationReasons: [],
      explanation: "Priority maintained at baseline because evidence is pending manual review or verification."
    };
  }

  // Contextual escalation evaluation
  if (basePriority === "high") {
    const hasHospitalOrCare =
      (sensitiveLocations.categoryCounts.hospital ?? 0) > 0 ||
      (sensitiveLocations.categoryCounts.elderly_care ?? 0) > 0;
    const isPersistent = recurrence.classification === "persistent_hotspot";
    const hasMultipleSensitives = sensitiveLocations.totalCount >= 2;
    const isBothHotspotAndSensitive =
      recurrence.isRecurringHotspot && sensitiveLocations.hasSensitiveLocations;

    if (hasHospitalOrCare || isPersistent || hasMultipleSensitives || isBothHotspotAndSensitive) {
      finalPriority = "severe";
      priorityElevated = true;
    }
  } else if (basePriority === "watch") {
    const isSevereIncident = severity === "severe" || severity === "high";
    const hasSignificantContext =
      recurrence.isRecurringHotspot || sensitiveLocations.hasSensitiveLocations;

    if (isSevereIncident && hasSignificantContext && evidenceScore >= 65) {
      finalPriority = "high";
      priorityElevated = true;
    }
  }

  // Build transparent deterministic elevation reasons
  if (priorityElevated) {
    if (recurrence.isRecurringHotspot) {
      elevationReasons.push(
        `Recurring hotspot detected (${recurrence.similarIncidentCount} incidents within ${(recurrence.radiusMeters / 1000).toFixed(0)} km in last ${recurrence.windowDays} days).`
      );
    }
    if (sensitiveLocations.hasSensitiveLocations) {
      elevationReasons.push(
        `Sensitive facilities inside impact zone: ${sensitiveLocations.summary}`
      );
    }
    elevationReasons.push(
      `Verified visual and sensor evidence score: ${evidenceScore}/100.`
    );
  }

  // Build human-readable executive summary
  let explanation = "";
  if (priorityElevated) {
    const contextParts: string[] = [];
    if (recurrence.isRecurringHotspot) {
      contextParts.push(
        recurrence.classification === "persistent_hotspot"
          ? "a persistent hotspot"
          : "a recurring pollution hotspot"
      );
    }
    if (sensitiveLocations.hasSensitiveLocations) {
      contextParts.push("sensitive facilities inside the predicted impact zone");
    }
    explanation = `Priority elevated to ${finalPriority.toUpperCase()}: ${severity} severity pollution occurring in ${contextParts.join(" with ")}.`;
  } else {
    explanation = `Priority evaluated as ${finalPriority.toUpperCase()} based on evidence score ${evidenceScore}/100.`;
  }

  return {
    basePriority,
    finalPriority,
    priorityElevated,
    elevationReasons,
    explanation
  };
}

/**
 * Calculates contextual priority for an aggregated pollution situation cluster.
 */
export function evaluateSituationContextualPriority(
  params: EvaluateContextualSituationPriorityParams
): ContextualPriorityContext {
  const {
    basePriority,
    dominantSeverity,
    evidenceScore,
    recurrence,
    sensitiveLocations
  } = params;

  let finalPriority = basePriority;
  let priorityElevated = false;
  const elevationReasons: string[] = [];

  const isVerifiedQuality = evidenceScore >= 55;

  if (isVerifiedQuality) {
    if (basePriority === "high") {
      const hasHospital = (sensitiveLocations.categoryCounts.hospital ?? 0) > 0;
      const isPersistent = recurrence.classification === "persistent_hotspot";
      const hasMultipleSensitives = sensitiveLocations.totalCount >= 2;
      const isBothHotspotAndSensitive =
        recurrence.isRecurringHotspot && sensitiveLocations.hasSensitiveLocations;

      if (hasHospital || isPersistent || hasMultipleSensitives || isBothHotspotAndSensitive) {
        finalPriority = "critical";
        priorityElevated = true;
      }
    } else if (basePriority === "moderate") {
      const hasSignificantContext =
        recurrence.isRecurringHotspot && sensitiveLocations.hasSensitiveLocations;
      const hasHospital = (sensitiveLocations.categoryCounts.hospital ?? 0) > 0;

      if ((hasSignificantContext || hasHospital) && evidenceScore >= 60) {
        finalPriority = "high";
        priorityElevated = true;
      }
    }
  }

  if (priorityElevated) {
    if (recurrence.isRecurringHotspot) {
      elevationReasons.push(
        `Recurring hotspot: ${recurrence.similarIncidentCount} incidents in ${(recurrence.radiusMeters / 1000).toFixed(0)} km / ${recurrence.windowDays} days.`
      );
    }
    if (sensitiveLocations.hasSensitiveLocations) {
      elevationReasons.push(
        `Impact area overlaps ${sensitiveLocations.summary}`
      );
    }
    elevationReasons.push(
      `Cluster evidence score: ${evidenceScore}/100.`
    );
  }

  let explanation = "";
  if (priorityElevated) {
    const reasons: string[] = [];
    if (recurrence.isRecurringHotspot) reasons.push("recurring pollution pattern");
    if (sensitiveLocations.hasSensitiveLocations) reasons.push("sensitive locations within impact radius");
    explanation = `Situation priority elevated to ${finalPriority.toUpperCase()} due to ${reasons.join(" and ")}.`;
  } else {
    explanation = `Situation priority evaluated as ${finalPriority.toUpperCase()}.`;
  }

  return {
    basePriority,
    finalPriority,
    priorityElevated,
    elevationReasons,
    explanation
  };
}
