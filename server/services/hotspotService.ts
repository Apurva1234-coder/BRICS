import type { AirQualitySummary, AqiForecastResult, CpcbLocalContext, PollutionReport, PollutionType, Severity } from "../types.js";
import { distanceMeters } from "../utils/geo.js";

export function findNearbyReports(report: PollutionReport, reports: PollutionReport[]) {
  const nearby = reports.filter(
    (candidate) =>
      candidate.id !== report.id &&
      Date.now() - new Date(candidate.createdAt).getTime() < 24 * 60 * 60 * 1000 &&
      distanceMeters(report.lat, report.lng, candidate.lat, candidate.lng) <= 500
  );
  return {
    similarReportCount: nearby.length,
    nearbyReportIds: nearby.slice(0, 8).map((item) => item.id)
  };
}

export function calculateHotspotScore(
  severity: Severity,
  nearbyCount: number,
  airQuality: AirQualitySummary,
  evidenceScore = 50,
  forecast?: AqiForecastResult,
  cpcbContext?: CpcbLocalContext,
  pollutionType?: PollutionType
): number {
  const pollutionSeverityScore = { low: 25, medium: 50, high: 78, severe: 100 }[severity];
  const nearbyDensityScore = Math.min(100, nearbyCount * 25);
  const currentAqiSeverityScore = airQuality.aqi !== undefined && airQuality.aqi !== null
    ? aqiSeverityScore(airQuality.aqi)
    : Object.keys(airQuality.pollutants || {}).length > 0
      ? 58
      : (airQuality.category || "").toLowerCase().includes("unavailable")
      ? 35
      : 58;
  const forecastSpikeScore = forecastScore(forecast?.spikeRisk);
  const cpcbSupport = cpcbSupportScore(cpcbContext, pollutionType);
  const weatherRiskScore = 40;
  return Math.min(100, Math.round(
    0.25 * evidenceScore +
      0.18 * currentAqiSeverityScore +
      0.17 * forecastSpikeScore +
      0.15 * pollutionSeverityScore +
      0.1 * nearbyDensityScore +
      0.1 * weatherRiskScore +
      cpcbSupport
  ));
}

function aqiSeverityScore(aqi: number) {
  if (aqi <= 50) return 15;
  if (aqi <= 100) return 30;
  if (aqi <= 200) return 55;
  if (aqi <= 300) return 75;
  if (aqi <= 400) return 90;
  return 100;
}

function forecastScore(risk?: AqiForecastResult["spikeRisk"]) {
  if (risk === "severe") return 100;
  if (risk === "high") return 100;
  if (risk === "medium") return 65;
  if (risk === "low") return 30;
  return 40;
}

function pollutantSeverity(value?: number) {
  if (!Number.isFinite(value)) return 0;
  if (value! >= 250) return 100;
  if (value! >= 150) return 75;
  if (value! >= 90) return 55;
  if (value! >= 50) return 35;
  return 15;
}

function cpcbSupportScore(context?: CpcbLocalContext, pollutionType?: PollutionType) {
  if (!context || !pollutionType) return 0;
  const pollutantGroups: Partial<Record<PollutionType, string[]>> = {
    garbage_burning: ["PM2.5", "PM10", "SO2"],
    open_waste: ["PM2.5", "PM10", "SO2"],
    industrial_smoke: ["PM2.5", "PM10", "SO2", "NO2"],
    construction_dust: ["PM10", "PM2.5"],
    road_dust: ["PM10", "PM2.5"],
    vehicle_smoke: ["NO2", "CO", "PM2.5"]
  };
  const values = (pollutantGroups[pollutionType] || []).map((pollutant) => context.pollutants[pollutant as keyof typeof context.pollutants]?.idwEstimate);
  const support = Math.max(0, ...values.map((value) => pollutantSeverity(value)));
  return Math.min(15, support * 0.15);
}

export function priorityForHotspotScore(
  hotspotScore: number,
  trustLevel: PollutionReport["trustLevel"]
): PollutionReport["priority"] {
  if (trustLevel === "Rejected" || trustLevel === "Needs Review") return "watch";
  return hotspotScore > 78 ? "severe" : hotspotScore > 58 ? "high" : "watch";
}
