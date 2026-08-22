import type {
  RegulatoryAuthority,
  RegulatoryResource,
  RegulatoryAlert,
  CreateRegulatoryAlertInput,
  AlertResponseStatus,
  PropagationImpactLevel,
  CrossBorderImpactPrediction,
  CorridorImpactPrediction
} from "../types.js";
import {
  BRICS_REGULATORY_AUTHORITIES,
  BRICS_REGULATORY_RESOURCES,
  getAllRegulatoryAuthorities,
  getRegulatoryAuthorityById,
  getRegulatoryAuthoritiesByCountry,
  getAllRegulatoryResources
} from "../data/bricsAuthorities.js";

// In-memory stores
const activeAlertsStore: RegulatoryAlert[] = [];
const resourcesStore: RegulatoryResource[] = [...BRICS_REGULATORY_RESOURCES];

/** Generate default recommended actions based on risk level and pollution type */
export function generateRecommendedActions(
  riskLevel: PropagationImpactLevel,
  pollutionType: string,
  hasBorderCrossing: boolean
): string[] {
  const actions: string[] = [];

  if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
    actions.push("Issue immediate Tier-1 industrial emission curtailment notice to heavy manufacturing facilities.");
    actions.push("Deploy mobile air quality monitoring lab to measure downwind ground-level particulate spike.");
  }

  if (hasBorderCrossing) {
    actions.push("Dispatch bilateral transboundary advisory notice via BRICS Environmental Exchange Mesh.");
    actions.push("Coordinate with cross-border customs & transport checkpoints for traffic mitigation.");
  }

  if (pollutionType.includes("industrial") || pollutionType.includes("smoke")) {
    actions.push("Inspect scrubbers and continuous emission monitoring systems (CEMS) at nearby thermal & metallurgical plants.");
  } else if (pollutionType.includes("stubble") || pollutionType.includes("fire")) {
    actions.push("Activate agricultural biomass fire suppression units and satellite rapid-detection patrols.");
  }

  actions.push("Issue public health and sensitive-group air quality advisory in downwind districts.");
  return actions;
}

/** Match responsible regulatory authority based on affected country, region, and corridor */
export function matchAuthorityForEvent(
  countryCode: string,
  regionName?: string,
  _pollutionType?: string,
  corridorId?: string
): RegulatoryAuthority {
  const code = countryCode.toUpperCase();
  const countryAuthorities = getRegulatoryAuthoritiesByCountry(code);

  if (countryAuthorities.length === 0) {
    // Fallback default
    return (
      BRICS_REGULATORY_AUTHORITIES[0] || {
        id: `auth-${code.toLowerCase()}-default`,
        name: `${countryCode} Environmental Protection Department`,
        countryCode: code,
        countryFlag: "🌐",
        region: regionName || "National",
        jurisdiction: "Federal Oversight",
        authorityType: "NATIONAL_MINISTRY",
        responsiblePollutionTypes: ["industrial_smoke", "dust"],
        contactEndpoint: { channel: "internal_dashboard", target: "central-ops@sentinel.internal" },
        activeStatus: true
      }
    );
  }

  // 1. Check for corridor-specific authority
  if (corridorId) {
    if (corridorId.includes("delhi-lahore") && code === "IND") {
      const caqm = countryAuthorities.find((a) => a.id === "auth-ind-caqm");
      if (caqm) return caqm;
    }
    if (corridorId.includes("amur-heilongjiang") && code === "CHN") {
      const hlj = countryAuthorities.find((a) => a.id === "auth-chn-hlj-epb");
      if (hlj) return hlj;
    }
    if (corridorId.includes("amur-heilongjiang") && code === "RUS") {
      const fe = countryAuthorities.find((a) => a.id === "auth-rus-far-east");
      if (fe) return fe;
    }
    if (corridorId.includes("parana") && code === "BRA") {
      const iat = countryAuthorities.find((a) => a.id === "auth-bra-iat-parana");
      if (iat) return iat;
    }
    if (corridorId.includes("highveld") && code === "ZAF") {
      const gs = countryAuthorities.find((a) => a.id === "auth-zaf-mpumalanga-green-scorpions");
      if (gs) return gs;
    }
  }

  // 2. Check for region-specific authority
  if (regionName) {
    const regLower = regionName.toLowerCase();
    if (regLower.includes("tibet") || regLower.includes("himalay")) {
      const tibet = countryAuthorities.find((a) => a.id === "auth-chn-tibet-epb");
      if (tibet) return tibet;
    }
    if (regLower.includes("punjab") && code === "IND") {
      const ppcb = countryAuthorities.find((a) => a.id === "auth-ind-ppcb");
      if (ppcb) return ppcb;
    }
    if (regLower.includes("heilongjiang") || regLower.includes("amur")) {
      const hlj = countryAuthorities.find((a) => a.id === "auth-chn-hlj-epb");
      if (hlj) return hlj;
      const fe = countryAuthorities.find((a) => a.id === "auth-rus-far-east");
      if (fe) return fe;
    }
  }

  // 3. Fallback to national ministry
  const national = countryAuthorities.find((a) => a.authorityType === "NATIONAL_MINISTRY");
  return national || countryAuthorities[0];
}

/** Initialize realistic baseline alerts for prototype demonstration */
function initializeDemoRegulatoryAlerts() {
  if (activeAlertsStore.length > 0) return;

  const now = new Date();
  const timeNow = now.getTime();

  // Baseline Alert 1: India -> China Himalayan Plume Alert
  const tibetAuth = getRegulatoryAuthorityById("auth-chn-tibet-epb")!;
  activeAlertsStore.push({
    alertId: "alert-brics-ind-chn-001",
    predictionId: "prop-ind-chn-sample-1",
    title: "⚠️ High-Altitude Particulate Influx: India → China (Tibet Airshed)",
    sourceCountry: "IND",
    sourceCountryName: "India",
    sourceFlag: "🇮🇳",
    affectedCountry: "CHN",
    affectedCountryName: "China",
    affectedFlag: "🇨🇳",
    affectedRegion: "Tibet / Himalayan Border Region",
    pollutionType: "industrial_smoke",
    sourcePollutionLevel: {
      pm2_5: 320,
      aqi: 370,
      severity: "critical"
    },
    predictedPollutionLevel: {
      pm2_5: 142,
      aqi: 215,
      remainingRatio: 0.44
    },
    estimatedArrivalHours: 8,
    estimatedArrivalTime: new Date(timeNow + 8 * 3600 * 1000).toISOString(),
    riskLevel: "CRITICAL",
    riskScore: 74,
    confidence: 78,
    confidenceLevel: "HIGH",
    targetAuthority: {
      authorityId: tibetAuth.id,
      authorityName: tibetAuth.name,
      jurisdiction: tibetAuth.jurisdiction
    },
    status: "CREATED",
    recommendedActions: [
      "Deploy Himalayan Mobile Monitoring Van to border observation station.",
      "Issue transboundary air quality advisory notice to civil environmental offices in Shigatse & Ngari prefectures.",
      "Track advection velocity via Sentinel-5P high-altitude aerosol optical depth feed."
    ],
    auditTrail: [
      {
        timestamp: new Date(timeNow - 15 * 60 * 1000).toISOString(),
        action: "AUTOMATED_ALERT_GENERATED",
        actor: "BRICS Automated Sentinel Intelligence",
        notes: "Automated trigger: Cross-border risk score reached 74% (CRITICAL) with estimated border transit in ~8 hours."
      }
    ],
    disclaimer: "Application-generated regulatory coordination alert. For multi-lateral triage and operational awareness.",
    createdAt: new Date(timeNow - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(timeNow - 15 * 60 * 1000).toISOString()
  });

  // Baseline Alert 2: China -> Russia Amur River Axis Alert
  const farEastAuth = getRegulatoryAuthorityById("auth-rus-far-east")!;
  const amurResource = resourcesStore.find((r) => r.id === "res-rus-amur-patrol");
  if (amurResource) amurResource.status = "DISPATCHED";

  activeAlertsStore.push({
    alertId: "alert-brics-chn-rus-002",
    predictionId: "prop-chn-rus-sample-2",
    corridorId: "corridor-amur-heilongjiang-industrial",
    title: "🚨 Heavy Metallurgical Emission Transport: China → Russia (Amur Basin)",
    sourceCountry: "CHN",
    sourceCountryName: "China",
    sourceFlag: "🇨🇳",
    affectedCountry: "RUS",
    affectedCountryName: "Russia",
    affectedFlag: "🇷🇺",
    affectedRegion: "Siberian / Amur-China Border Region",
    pollutionType: "industrial_smoke",
    sourcePollutionLevel: {
      pm2_5: 280,
      aqi: 330,
      severity: "severe"
    },
    predictedPollutionLevel: {
      pm2_5: 165,
      aqi: 240,
      remainingRatio: 0.59
    },
    estimatedArrivalHours: 6,
    estimatedArrivalTime: new Date(timeNow + 6 * 3600 * 1000).toISOString(),
    riskLevel: "CRITICAL",
    riskScore: 81,
    confidence: 82,
    confidenceLevel: "HIGH",
    targetAuthority: {
      authorityId: farEastAuth.id,
      authorityName: farEastAuth.name,
      jurisdiction: farEastAuth.jurisdiction
    },
    assignedResource: {
      resourceId: "res-rus-amur-patrol",
      resourceName: "Amur River Ecological Border Patrol",
      resourceType: "INSPECTION_TEAM",
      dispatchedAt: new Date(timeNow - 5 * 60 * 1000).toISOString()
    },
    status: "ASSIGNED",
    recommendedActions: [
      "Notify Khabarovsk municipal dispatch of estimated ground-level PM2.5 spike in ~6 hours.",
      "Deploy Amur River Ecological Border Patrol to monitor water and air quality stations.",
      "Issue joint bilateral data verification request through BRICS environmental data exchange."
    ],
    auditTrail: [
      {
        timestamp: new Date(timeNow - 25 * 60 * 1000).toISOString(),
        action: "AUTOMATED_ALERT_GENERATED",
        actor: "BRICS Automated Sentinel Intelligence",
        notes: "Automated trigger: Cross-border risk score reached 81% (CRITICAL)."
      },
      {
        timestamp: new Date(timeNow - 12 * 60 * 1000).toISOString(),
        action: "ACKNOWLEDGED",
        actor: "Duty Officer V. Morozov (Far Eastern Environmental Directorate)",
        notes: "Alert acknowledged by Khabarovsk central command."
      },
      {
        timestamp: new Date(timeNow - 5 * 60 * 1000).toISOString(),
        action: "RESOURCE_ASSIGNED",
        actor: "Director S. Ivanov",
        notes: "Dispatched Amur River Ecological Border Patrol to border crossing transect."
      }
    ],
    disclaimer: "Application-generated regulatory coordination alert. For multi-lateral triage and operational awareness.",
    createdAt: new Date(timeNow - 25 * 60 * 1000).toISOString(),
    updatedAt: new Date(timeNow - 5 * 60 * 1000).toISOString()
  });
}

// Initialize demo alerts
initializeDemoRegulatoryAlerts();

/** Create and publish a new regulatory alert */
export function createRegulatoryAlert(input: CreateRegulatoryAlertInput): RegulatoryAlert {
  const alertId = `alert-brics-${input.affectedCountry.toLowerCase()}-${Date.now()}`;
  const now = new Date().toISOString();

  // Match target authority if not explicitly given
  const matchedAuth = input.targetAuthorityId
    ? getRegulatoryAuthorityById(input.targetAuthorityId) || matchAuthorityForEvent(input.affectedCountry, input.affectedRegion, input.pollutionType, input.corridorId)
    : matchAuthorityForEvent(input.affectedCountry, input.affectedRegion, input.pollutionType, input.corridorId);

  const recommendedActions = input.recommendedActions || generateRecommendedActions(
    input.riskLevel,
    input.pollutionType,
    input.sourceCountry !== input.affectedCountry
  );

  const newAlert: RegulatoryAlert = {
    alertId,
    eventId: input.eventId,
    predictionId: input.predictionId,
    corridorId: input.corridorId,
    title: `⚠️ Environmental Regulatory Alert: ${input.sourceCountryName || input.sourceCountry} → ${input.affectedCountryName || input.affectedCountry}`,
    sourceCountry: input.sourceCountry,
    sourceCountryName: input.sourceCountryName || input.sourceCountry,
    sourceFlag: input.sourceFlag || "🌐",
    affectedCountry: input.affectedCountry,
    affectedCountryName: input.affectedCountryName || input.affectedCountry,
    affectedFlag: input.affectedFlag || "🌐",
    affectedRegion: input.affectedRegion,
    pollutionType: input.pollutionType,
    sourcePollutionLevel: input.sourcePollutionLevel,
    predictedPollutionLevel: input.predictedPollutionLevel,
    estimatedArrivalHours: input.estimatedArrivalHours,
    estimatedArrivalTime: input.estimatedArrivalTime,
    riskLevel: input.riskLevel,
    riskScore: input.riskScore,
    confidence: input.confidence || 80,
    confidenceLevel: (input.confidence || 80) >= 80 ? "HIGH" : (input.confidence || 80) >= 60 ? "MEDIUM" : "LOW",
    targetAuthority: {
      authorityId: matchedAuth.id,
      authorityName: matchedAuth.name,
      jurisdiction: matchedAuth.jurisdiction
    },
    status: "CREATED",
    recommendedActions,
    auditTrail: [
      {
        timestamp: now,
        action: "AUTOMATED_ALERT_GENERATED",
        actor: "BRICS Automated Sentinel Intelligence",
        notes: `Alert triggered with ${input.riskLevel} risk rating (${input.riskScore}%). Matched to ${matchedAuth.name}.`
      }
    ],
    disclaimer: "Application-generated regulatory coordination alert. For multi-lateral triage and operational awareness.",
    createdAt: now,
    updatedAt: now
  };

  // Prepend to store (upsert)
  activeAlertsStore.unshift(newAlert);
  if (activeAlertsStore.length > 50) activeAlertsStore.pop();

  return newAlert;
}

/** Acknowledge an alert by duty authority */
export function acknowledgeRegulatoryAlert(
  alertId: string,
  actor: string = "Duty Environmental Officer",
  notes?: string
): RegulatoryAlert {
  const alert = activeAlertsStore.find((a) => a.alertId === alertId);
  if (!alert) throw new Error(`Alert '${alertId}' not found.`);

  const now = new Date().toISOString();
  const previousStatus = alert.status;
  alert.status = "ACKNOWLEDGED";
  alert.updatedAt = now;

  alert.auditTrail.push({
    timestamp: now,
    action: "ACKNOWLEDGED",
    actor,
    notes: notes || "Alert acknowledged by monitoring desk.",
    previousStatus,
    newStatus: "ACKNOWLEDGED"
  });

  return alert;
}

/** Assign a response resource to an alert */
export function assignResourceToAlert(
  alertId: string,
  resourceId: string,
  actor: string = "Operations Commander",
  notes?: string
): RegulatoryAlert {
  const alert = activeAlertsStore.find((a) => a.alertId === alertId);
  if (!alert) throw new Error(`Alert '${alertId}' not found.`);

  const resource = resourcesStore.find((r) => r.id === resourceId);
  if (!resource) throw new Error(`Resource '${resourceId}' not found.`);

  const now = new Date().toISOString();
  const previousStatus = alert.status;

  resource.status = "DISPATCHED";
  resource.currentAssignmentAlertId = alertId;

  alert.status = "ASSIGNED";
  alert.assignedResource = {
    resourceId: resource.id,
    resourceName: resource.name,
    resourceType: resource.resourceType,
    dispatchedAt: now
  };
  alert.updatedAt = now;

  alert.auditTrail.push({
    timestamp: now,
    action: "RESOURCE_ASSIGNED",
    actor,
    notes: notes || `Dispatched ${resource.name} (${resource.contactCallsign}) to active incident perimeter.`,
    previousStatus,
    newStatus: "ASSIGNED"
  });

  return alert;
}

/** Update alert response status (e.g. to ACTION_IN_PROGRESS) */
export function updateRegulatoryAlertStatus(
  alertId: string,
  newStatus: AlertResponseStatus,
  actor: string = "Operations Officer",
  notes?: string
): RegulatoryAlert {
  const alert = activeAlertsStore.find((a) => a.alertId === alertId);
  if (!alert) throw new Error(`Alert '${alertId}' not found.`);

  const now = new Date().toISOString();
  const previousStatus = alert.status;
  alert.status = newStatus;
  alert.updatedAt = now;

  alert.auditTrail.push({
    timestamp: now,
    action: `STATUS_UPDATED_${newStatus}`,
    actor,
    notes: notes || `Alert status transitioned from ${previousStatus} to ${newStatus}.`,
    previousStatus,
    newStatus
  });

  return alert;
}

/** Mark alert as resolved and release assigned resources */
export function resolveRegulatoryAlert(
  alertId: string,
  resolutionNotes: string,
  actor: string = "Lead Environmental Inspector"
): RegulatoryAlert {
  const alert = activeAlertsStore.find((a) => a.alertId === alertId);
  if (!alert) throw new Error(`Alert '${alertId}' not found.`);

  const now = new Date().toISOString();
  const previousStatus = alert.status;

  // Release resource if assigned
  if (alert.assignedResource) {
    const res = resourcesStore.find((r) => r.id === alert.assignedResource?.resourceId);
    if (res) {
      res.status = "AVAILABLE";
      res.currentAssignmentAlertId = undefined;
    }
  }

  alert.status = "RESOLVED";
  alert.resolutionNotes = resolutionNotes;
  alert.resolvedAt = now;
  alert.updatedAt = now;

  alert.auditTrail.push({
    timestamp: now,
    action: "RESOLVED",
    actor,
    notes: `Incident resolved: ${resolutionNotes}`,
    previousStatus,
    newStatus: "RESOLVED"
  });

  return alert;
}

/** Retrieve all regulatory alerts with optional filtering */
export function getRegulatoryAlerts(filter?: {
  status?: AlertResponseStatus;
  countryCode?: string;
  riskLevel?: PropagationImpactLevel;
}): RegulatoryAlert[] {
  let list = [...activeAlertsStore];

  if (filter?.status) {
    list = list.filter((a) => a.status === filter.status);
  }
  if (filter?.countryCode) {
    const code = filter.countryCode.toUpperCase();
    list = list.filter((a) => a.affectedCountry.toUpperCase() === code || a.sourceCountry.toUpperCase() === code);
  }
  if (filter?.riskLevel) {
    list = list.filter((a) => a.riskLevel === filter.riskLevel);
  }

  return list;
}

/** Get a single alert by ID */
export function getRegulatoryAlertById(alertId: string): RegulatoryAlert | undefined {
  return activeAlertsStore.find((a) => a.alertId === alertId || a.alertId.toLowerCase() === alertId.toLowerCase());
}

/** Retrieve all deployable resources */
export function getRegulatoryResources(authorityId?: string, countryCode?: string): RegulatoryResource[] {
  let list = [...resourcesStore];
  if (authorityId) {
    list = list.filter((r) => r.authorityId === authorityId);
  }
  if (countryCode) {
    const code = countryCode.toUpperCase();
    list = list.filter((r) => r.countryCode === code);
  }
  return list;
}
