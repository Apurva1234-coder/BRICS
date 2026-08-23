import type {
  HotspotRecurrenceClassification,
  PollutionReport,
  PollutionSituation,
  PollutionType,
  RecurringHotspotContext,
  SensitiveLocation,
  SensitiveLocationCategory,
  SensitiveLocationImpactContext,
  Severity,
  SituationPriority
} from "../types";
import { distanceMeters } from "./geo";

const ACTIVE_STATUSES = new Set([
  "Submitted", "New", "Assigned", "In Progress", "Manual review needed"
]);

const BASE_IMPACT: Record<PollutionType, number> = {
  garbage_burning: 90, industrial_smoke: 90, sewage_overflow: 85,
  water_pollution: 80, stagnant_water: 75, vehicle_smoke: 75,
  construction_dust: 70, road_dust: 65, open_waste: 65,
  illegal_dumping: 65, unclear: 40, not_pollution: 0
};
const SEV_MUL: Record<Severity, number> = { low: 0.5, medium: 0.7, high: 0.9, severe: 1.0 };

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

// Client registry of key facilities (matches server curated dataset)
const CLIENT_FACILITIES: Array<Omit<SensitiveLocation, "distanceMeters">> = [
  { id: "POI-PUN-HOSP-01", name: "Ruby Hall Clinic", category: "hospital", lat: 18.5312, lng: 73.8765, impactRadiusMeters: 1200, source: "curated_demo" },
  { id: "POI-PUN-HOSP-02", name: "Jehangir Hospital", category: "hospital", lat: 18.5294, lng: 73.8738, impactRadiusMeters: 1200, source: "curated_demo" },
  { id: "POI-PUN-HOSP-03", name: "Sahyadri Super Speciality Hospital Deccan", category: "hospital", lat: 18.5146, lng: 73.8402, impactRadiusMeters: 1200, source: "curated_demo" },
  { id: "POI-PUN-HOSP-04", name: "Dr. D.Y. Patil Hospital Pimpri", category: "hospital", lat: 18.6231, lng: 73.8188, impactRadiusMeters: 1200, source: "curated_demo" },
  { id: "POI-PUN-SCH-01", name: "The Bishop's School Kalyani Nagar", category: "school", lat: 18.5492, lng: 73.9034, impactRadiusMeters: 1000, source: "curated_demo" },
  { id: "POI-PUN-SCH-02", name: "Symbiosis International School Viman Nagar", category: "school", lat: 18.5661, lng: 73.9128, impactRadiusMeters: 1000, source: "curated_demo" },
  { id: "POI-PUN-SCH-03", name: "St. Vincent's High School Camp", category: "school", lat: 18.5127, lng: 73.8789, impactRadiusMeters: 1000, source: "curated_demo" },
  { id: "POI-PUN-CC-01", name: "Little Millennium Childcare Koregaon Park", category: "childcare", lat: 18.5367, lng: 73.8924, impactRadiusMeters: 800, source: "curated_demo" },
  { id: "POI-PUN-ELD-01", name: "Anand Niketan Senior Care Home Pune", category: "elderly_care", lat: 18.5085, lng: 73.8315, impactRadiusMeters: 800, source: "curated_demo" },
  { id: "POI-DEL-HOSP-01", name: "AIIMS New Delhi", category: "hospital", lat: 28.5672, lng: 77.2100, impactRadiusMeters: 1200, source: "curated_demo" },
  { id: "POI-DEL-SCH-01", name: "Delhi Public School R.K. Puram", category: "school", lat: 28.5648, lng: 77.1782, impactRadiusMeters: 1000, source: "curated_demo" },
  { id: "POI-MUM-HOSP-01", name: "KEM Hospital Parel", category: "hospital", lat: 19.0024, lng: 72.8424, impactRadiusMeters: 1200, source: "curated_demo" },
  { id: "POI-MUM-SCH-01", name: "Cathedral & John Connon School Fort", category: "school", lat: 18.9345, lng: 72.8335, impactRadiusMeters: 1000, source: "curated_demo" }
];

export function findSensitiveLocationsClient(lat: number, lng: number, radiusMeters = 1000): SensitiveLocationImpactContext {
  const impacted: SensitiveLocation[] = [];
  const categoryCounts: Record<SensitiveLocationCategory, number> = {
    school: 0, hospital: 0, childcare: 0, elderly_care: 0
  };

  for (const f of CLIENT_FACILITIES) {
    const dist = distanceMeters(lat, lng, f.lat, f.lng);
    const eff = Math.max(f.impactRadiusMeters, radiusMeters);
    if (dist <= eff) {
      const loc: SensitiveLocation = { ...f, distanceMeters: Math.round(dist) };
      impacted.push(loc);
      if (categoryCounts[f.category] !== undefined) categoryCounts[f.category]++;
    }
  }

  impacted.sort((a, b) => a.distanceMeters - b.distanceMeters);
  const total = impacted.length;

  if (total === 0) {
    return {
      hasSensitiveLocations: false,
      impactScore: 0,
      totalCount: 0,
      categoryCounts,
      locations: [],
      primaryImpactRadiusMeters: radiusMeters,
      summary: `No sensitive locations detected within ${(radiusMeters / 1000).toFixed(1)} km.`,
      reasons: ["No sensitive facilities within the impact zone."],
      affectedFacilitiesSummary: []
    };
  }

  const weights: Record<SensitiveLocationCategory, number> = { hospital: 35, childcare: 30, school: 25, elderly_care: 25 };
  let rawScore = 0;
  for (const loc of impacted) {
    const eff = Math.max(loc.impactRadiusMeters, radiusMeters);
    const prox = Math.max(0.4, 1 - (loc.distanceMeters / eff) * 0.5);
    rawScore += (weights[loc.category] ?? 20) * prox;
  }
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  const parts: string[] = [];
  if (categoryCounts.school) parts.push(`${categoryCounts.school} school${categoryCounts.school > 1 ? "s" : ""}`);
  if (categoryCounts.hospital) parts.push(`${categoryCounts.hospital} hospital${categoryCounts.hospital > 1 ? "s" : ""}`);
  if (categoryCounts.childcare) parts.push(`${categoryCounts.childcare} childcare centre${categoryCounts.childcare > 1 ? "s" : ""}`);
  if (categoryCounts.elderly_care) parts.push(`${categoryCounts.elderly_care} elderly-care facility${categoryCounts.elderly_care > 1 ? "ies" : ""}`);

  const radKm = (radiusMeters / 1000).toFixed(radiusMeters % 1000 === 0 ? 0 : 1);
  const summary = `${parts.join(", ")} inside ${radKm} km impact zone.`;

  return {
    hasSensitiveLocations: true,
    impactScore: score,
    totalCount: total,
    categoryCounts,
    locations: impacted,
    primaryImpactRadiusMeters: radiusMeters,
    summary,
    reasons: [`Impact area overlaps ${parts.join(" and ")}.`],
    affectedFacilitiesSummary: impacted.map(l => `${l.name} (${l.category}) — ${l.distanceMeters}m away`)
  };
}

export function analyzeRecurrenceClient(
  target: { lat: number; lng: number; pollutionType?: PollutionType; createdAt?: string; id?: string },
  allReports: PollutionReport[],
  radiusMeters = 2000,
  windowDays = 90
): RecurringHotspotContext {
  const refTime = target.createdAt ? new Date(target.createdAt).getTime() : Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const valid = allReports.filter(r => {
    if (target.id && r.id === target.id) return false;
    if (r.status === "False Report" || r.status === "Rejected" || r.gemini?.pollution_type === "not_pollution") return false;
    const dist = distanceMeters(target.lat, target.lng, r.lat, r.lng);
    if (dist > radiusMeters) return false;
    const age = refTime - new Date(r.createdAt).getTime();
    return age >= -86400000 && age <= windowMs;
  });

  const count = valid.length;
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
      explanation: `No historical pollution incidents recorded within ${(radiusMeters / 1000).toFixed(1)} km in last ${windowDays} days.`,
      reasons: ["No historical incidents detected."],
      historicalIncidentIds: []
    };
  }

  const verified = valid.filter(r => r.trustLevel === "Verified" || (r.evidenceScore ?? 50) >= 75).length;
  const active = valid.filter(r => !["Resolved", "Rejected", "False Report"].includes(r.status)).length;
  const types = new Set<PollutionType>(target.pollutionType ? [target.pollutionType] : []);
  valid.forEach(r => { if (r.gemini?.pollution_type) types.add(r.gemini.pollution_type); });

  let rawScore = 0;
  if (count === 1) rawScore = 15;
  else if (count <= 3) rawScore = 20 + count * 6;
  else if (count <= 6) rawScore = 45 + count * 5;
  else rawScore = 75 + count * 3;

  const score = Math.min(100, Math.max(0, rawScore));
  const classification: HotspotRecurrenceClassification =
    count <= 1 || score < 20 ? "no_recurring_history" :
    score < 45 || count <= 3 ? "emerging_hotspot" :
    score < 75 || count <= 6 ? "recurring_hotspot" : "persistent_hotspot";

  const radKm = (radiusMeters / 1000).toFixed(0);
  const reasons = [
    `${count} relevant incident${count > 1 ? "s" : ""} within ${radKm} km in last ${windowDays} days.`,
    ...(verified > 0 ? [`${verified} verified by evidence.`] : []),
    ...(active > 0 ? [`${active} active incident${active > 1 ? "s" : ""} pending.`] : [])
  ];

  return {
    isRecurringHotspot: classification !== "no_recurring_history",
    classification,
    recurrenceScore: score,
    similarIncidentCount: count,
    verifiedIncidentCount: verified,
    activeIncidentCount: active,
    radiusMeters,
    windowDays,
    earliestIncidentAt: valid[valid.length - 1]?.createdAt,
    latestIncidentAt: valid[0]?.createdAt,
    observedPollutionTypes: Array.from(types),
    explanation: `${classification.replace(/_/g, " ")}: ${count} incidents in ${radKm} km / ${windowDays} days.`,
    reasons,
    historicalIncidentIds: valid.map(r => r.id)
  };
}

function volScore(n: number) {
  if (n >= 6) return 100; if (n >= 4) return 80;
  if (n === 3) return 65; if (n === 2) return 45; return 25;
}
function recScore(iso: string) {
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return 100; if (h < 6) return 85;
  if (h < 24) return 70; if (h < 168) return 45; return 20;
}
function domType(rs: PollutionReport[]): PollutionType {
  const m = new Map<PollutionType, number>();
  rs.forEach((r) => m.set(r.gemini.pollution_type, (m.get(r.gemini.pollution_type) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unclear";
}
function domSev(rs: PollutionReport[]): Severity {
  for (const s of ["severe","high","medium","low"] as Severity[])
    if (rs.some(r => r.gemini.severity === s)) return s;
  return "low";
}
function placeLabel(rs: PollutionReport[]) {
  const m = new Map<string, number>();
  rs.forEach(r => { if (r.areaText) m.set(r.areaText, (m.get(r.areaText) ?? 0) + 1); });
  return [...m.entries()].sort((a,b) => b[1]-a[1])[0]?.[0] ?? rs[0]?.areaText ?? "Unknown area";
}
function aqiSup(rs: PollutionReport[]) {
  const aqis = rs.map(r => r.airQuality?.aqi).filter((a): a is number => typeof a === "number");
  if (!aqis.length) return 0;
  const mx = Math.max(...aqis);
  if (mx >= 300) return 100; if (mx >= 200) return 75; if (mx >= 100) return 50; return 25;
}
function score(bd: PollutionSituation["scoreBreakdown"]) {
  return 0.25*bd.reportVolumeScore + 0.20*bd.publicImpactScore + 0.20*bd.evidenceScore +
         0.15*bd.recencyScore + 0.10*bd.unresolvedScore + 0.07*bd.hotspotScore + 0.03*bd.aqiSupportScore;
}
function basePriorityFromScore(s: number): SituationPriority {
  if (s >= 80) return "critical"; if (s >= 65) return "high";
  if (s >= 45) return "moderate"; return "low";
}

function cluster(active: PollutionReport[], radius = 250): PollutionReport[][] {
  const sorted = [...active].sort((a,b) => (b.hotspotScore??0)-(a.hotspotScore??0) || new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  const visited = new Set<string>();
  const clusters: PollutionReport[][] = [];
  for (const seed of sorted) {
    if (visited.has(seed.id)) continue;
    visited.add(seed.id);
    const cl = [seed];
    for (const c of sorted) {
      if (visited.has(c.id)) continue;
      if (distanceMeters(seed.lat, seed.lng, c.lat, c.lng) <= radius) { visited.add(c.id); cl.push(c); }
    }
    clusters.push(cl);
  }
  return clusters;
}

export function buildRankedSituationsClient(reports: PollutionReport[]): PollutionSituation[] {
  const active = reports.filter(r => ACTIVE_STATUSES.has(r.status));
  const clusters = cluster(active);

  const situations: PollutionSituation[] = clusters.map((cl, i) => {
    const centerLat = cl.reduce((s,r) => s+r.lat, 0) / cl.length;
    const centerLng = cl.reduce((s,r) => s+r.lng, 0) / cl.length;
    const type = domType(cl);
    const sev = domSev(cl);
    const place = placeLabel(cl);
    const sorted = [...cl].sort((a,b) => new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
    const latestAt = sorted[0].createdAt;
    const firstAt = sorted[sorted.length-1].createdAt;
    const unresolved = cl.filter(r => !["Resolved","Rejected","False Report"].includes(r.status));
    const avgEvidence = cl.reduce((s,r) => s+(r.evidenceScore??50), 0)/cl.length;
    const maxEvidence = Math.max(...cl.map(r => r.evidenceScore??50));
    const photoUrls = sorted.flatMap(r => [r.media?.[0]?.displayUrl, r.media?.[0]?.publicUrl, r.imageUrl]).filter((u): u is string => Boolean(u)).slice(0,4);

    const bd: PollutionSituation["scoreBreakdown"] = {
      reportVolumeScore: volScore(cl.length),
      publicImpactScore: Math.round((BASE_IMPACT[type]??40) * (SEV_MUL[sev]??0.7)),
      evidenceScore: Math.round(0.7*avgEvidence + 0.3*maxEvidence),
      recencyScore: recScore(latestAt),
      unresolvedScore: Math.round(unresolved.length / cl.length * 100),
      hotspotScore: Math.round(cl.reduce((s,r)=>s+(r.hotspotScore??0),0)/cl.length),
      aqiSupportScore: aqiSup(cl)
    };
    const s = Math.min(100, Math.max(0, Math.round(score(bd))));
    const basePrio = basePriorityFromScore(s);

    const recurrence = analyzeRecurrenceClient(
      { lat: centerLat, lng: centerLng, pollutionType: type, createdAt: latestAt },
      reports,
      2000,
      90
    );
    const sensitiveLocations = findSensitiveLocationsClient(centerLat, centerLng, 1000);

    let finalPriority = basePrio;
    let priorityElevated = false;
    const elevationReasons: string[] = [];

    if (bd.evidenceScore >= 55) {
      if (basePrio === "high") {
        if (sensitiveLocations.categoryCounts.hospital > 0 || recurrence.classification === "persistent_hotspot" || (recurrence.isRecurringHotspot && sensitiveLocations.hasSensitiveLocations)) {
          finalPriority = "critical";
          priorityElevated = true;
        }
      } else if (basePrio === "moderate") {
        if ((recurrence.isRecurringHotspot && sensitiveLocations.hasSensitiveLocations) || sensitiveLocations.categoryCounts.hospital > 0) {
          finalPriority = "high";
          priorityElevated = true;
        }
      }
    }

    if (priorityElevated) {
      if (recurrence.isRecurringHotspot) {
        elevationReasons.push(`Recurring hotspot: ${recurrence.similarIncidentCount} incidents in 2 km / 90 days.`);
      }
      if (sensitiveLocations.hasSensitiveLocations) {
        elevationReasons.push(`Impact area overlaps ${sensitiveLocations.summary}`);
      }
      elevationReasons.push(`Cluster evidence score: ${bd.evidenceScore}/100.`);
    }

    return {
      id: `SIT-${String(i+1).padStart(3,"0")}`,
      rank: i+1,
      priority: finalPriority,
      situationScore: s,
      centerLat, centerLng, radiusMeters: 250,
      placeLabel: place,
      shortDescription: `${cl.length} ${type.replace(/_/g," ")} report${cl.length>1?"s":""} near ${place}.`,
      reportCount: cl.length, activeReportCount: unresolved.length, unresolvedCount: unresolved.length,
      dominantPollutionType: type, dominantSeverity: sev,
      latestReportAt: latestAt, firstReportAt: firstAt,
      reportIds: cl.map(r => r.id), photoUrls, scoreBreakdown: bd,
      effects: [], recommendedActions: [],
      statusSummary: unresolved.length === 0 ? "All resolved." : `${unresolved.length} of ${cl.length} unresolved.`,
      recurrence,
      sensitiveLocations,
      contextualPriority: {
        basePriority: basePrio,
        finalPriority,
        priorityElevated,
        elevationReasons,
        explanation: priorityElevated
          ? `Situation priority elevated to ${finalPriority.toUpperCase()} due to recurring pollution and sensitive locations.`
          : `Situation priority evaluated as ${finalPriority.toUpperCase()}.`
      }
    };
  });

  situations.sort((a,b) => b.situationScore-a.situationScore || b.activeReportCount-a.activeReportCount);
  situations.forEach((s,i) => { s.rank = i+1; });
  return situations;
}
