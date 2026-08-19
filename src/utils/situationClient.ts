/**
 * Client-side lightweight situation ranking utility.
 * Used by AdminPage for officer overview without an extra API call.
 * Logic mirrors the server situationRankingService but runs in the browser.
 */
import type { PollutionReport, PollutionSituation, PollutionType, Severity, SituationPriority } from "../types";
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
function priority(s: number): SituationPriority {
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
    return {
      id: `SIT-${String(i+1).padStart(3,"0")}`,
      rank: i+1, priority: priority(s), situationScore: s,
      centerLat, centerLng, radiusMeters: 250,
      placeLabel: place,
      shortDescription: `${cl.length} ${type.replace(/_/g," ")} report${cl.length>1?"s":""} near ${place}.`,
      reportCount: cl.length, activeReportCount: unresolved.length, unresolvedCount: unresolved.length,
      dominantPollutionType: type, dominantSeverity: sev,
      latestReportAt: latestAt, firstReportAt: firstAt,
      reportIds: cl.map(r => r.id), photoUrls, scoreBreakdown: bd,
      effects: [], recommendedActions: [],
      statusSummary: unresolved.length === 0 ? "All resolved." : `${unresolved.length} of ${cl.length} unresolved.`
    };
  });

  situations.sort((a,b) => b.situationScore-a.situationScore || b.activeReportCount-a.activeReportCount);
  situations.forEach((s,i) => { s.rank = i+1; });
  return situations;
}
