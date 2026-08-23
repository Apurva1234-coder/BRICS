import type { AirQualitySummary, AqiForecastResult, ForecastHorizon } from "../types";

export const FORECAST_HORIZONS: ForecastHorizon[] = ["1h", "6h", "12h", "24h"];

export type PublicAqiState = {
  state: "reliable" | "limited" | "unavailable";
  aqi?: number;
  category?: string;
  reason?: string;
};

export function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function aqiCategory(aqi?: number) {
  if (!isFiniteNonNegative(aqi)) return "Unavailable";
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

export function aqiColor(aqi?: number) {
  if (!isFiniteNonNegative(aqi)) return "#64748b";
  if (aqi <= 50) return "#00e07a";
  if (aqi <= 100) return "#a3e635";
  if (aqi <= 200) return "#f7c948";
  if (aqi <= 300) return "#fb923c";
  if (aqi <= 400) return "#ff5c7a";
  return "#b91c1c";
}

function ageHours(date?: string) {
  if (!date) return undefined;
  const timestamp = Date.parse(date);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, (Date.now() - timestamp) / 3600000);
}

export function getPublicCurrentAqiState(result?: AirQualitySummary | null): PublicAqiState {
  if (!result || result.status === "unavailable") {
    return { state: "unavailable", reason: "No usable monitoring station is available for this location." };
  }

  const stationDistance = result.station?.distanceMeters ?? result.nearestStationDistanceMeters;
  const stationInRange = Number.isFinite(stationDistance) && (stationDistance as number) <= 25000;
  const derivedQuality = result.aqiQuality;
  const reading = result.readings
    ? Object.values(result.readings).find((item) => item?.usableForAqi && isFiniteNonNegative(item.value))
    : undefined;
  const currentAge = ageHours(result.lastUpdate || result.dateTime || result.station?.lastUpdate);
  const freshEnough = currentAge !== undefined && currentAge <= 12;
  const hasFiniteAqi = isFiniteNonNegative(result.aqi);

  if (!stationInRange) {
    return { state: "unavailable", reason: "The nearest usable monitoring station is more than 25 km away." };
  }
  if (hasFiniteAqi && derivedQuality === "rolling_validated") {
    return { state: "reliable", aqi: result.aqi, category: result.category || aqiCategory(result.aqi), reason: "Calculated from validated rolling station history." };
  }
  if (hasFiniteAqi && derivedQuality === "indicative") {
    return { state: "limited", aqi: result.aqi, category: result.category || aqiCategory(result.aqi), reason: "Indicative CPCB estimate; the averaging period is not verified." };
  }
  if (hasFiniteAqi && (!derivedQuality || derivedQuality === "provider_reported") && freshEnough && reading) {
    return { state: "reliable", aqi: result.aqi, category: result.category || aqiCategory(result.aqi) };
  }
  if (hasFiniteAqi || reading || Object.keys(result.pollutants || {}).length > 0) {
    return { state: "limited", aqi: hasFiniteAqi ? result.aqi : undefined, category: hasFiniteAqi ? result.category || aqiCategory(result.aqi) : undefined, reason: currentAge !== undefined && currentAge > 12 ? "Station data is older than 12 hours." : "Limited station coverage or pollutant completeness." };
  }
  return { state: "unavailable", reason: "No finite AQI or usable pollutant reading is available." };
}

export function getForecastDisplayState(forecast?: AqiForecastResult | null) {
  const availableHorizons = forecast?.provider === "locally_forecast"
    ? FORECAST_HORIZONS.filter((horizon) => isFiniteNonNegative(forecast.predictions[horizon]))
    : [];
  const hourlyValues = forecast?.provider === "locally_forecast"
    ? (forecast.hourly || []).filter((hour) => isFiniteNonNegative(hour.aqi))
    : [];
  return {
    available: availableHorizons.length > 0 || hourlyValues.length > 0,
    availableHorizons,
    hourlyValues,
    reason: forecast?.reason || "A useful forecast is not available for this location yet."
  };
}

export function formatAge(date?: string) {
  if (!date) return "Update time unavailable";
  const hours = ageHours(date);
  if (hours === undefined) return "Update time unavailable";
  if (hours < 1) return "Updated within the last hour";
  if (hours < 24) return `Updated ${Math.round(hours)}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}
