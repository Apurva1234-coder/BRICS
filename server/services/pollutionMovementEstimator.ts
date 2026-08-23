import type {
  MeteorologicalContext,
  HourlyForecastPoint,
  MovementPathPoint,
  PollutionMovementEstimate
} from "../types.js";
import { degreesToCompass, oppositeBearingDegrees } from "./googleWeatherProvider.js";

const EARTH_RADIUS_KM = 6371.0;

/** Calculate geodesic destination coordinate given start point, distance, and bearing */
export function computeDestinationPoint(
  lat: number,
  lng: number,
  distanceKm: number,
  bearingDegrees: number
): { latitude: number; longitude: number } {
  if (distanceKm <= 0) return { latitude: lat, longitude: lng };

  const dByR = distanceKm / EARTH_RADIUS_KM;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const brng = (bearingDegrees * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dByR) +
    Math.cos(lat1) * Math.sin(dByR) * Math.cos(brng)
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(dByR) * Math.cos(lat1),
      Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat2)
    );

  const finalLat = (lat2 * 180) / Math.PI;
  const finalLng = (((lng2 * 180) / Math.PI + 540) % 360) - 180;

  return {
    latitude: Math.round(finalLat * 10000) / 10000,
    longitude: Math.round(finalLng * 10000) / 10000
  };
}

/** Calculate great-circle distance between two coordinate pairs in kilometers */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

/** Calculate initial bearing from point A to point B in degrees (0-360) */
export function calculateBearingDegrees(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const y = Math.sin(((lng2 - lng1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lng2 - lng1) * Math.PI) / 180);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round(((brng + 360) % 360) * 10) / 10;
}

/** Calculate circular angular difference between two bearings in degrees (0-180) */
function angleDifferenceDegrees(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Estimate pollution movement over a time horizon using geodesic step-by-step displacement.
 * Wind vector is inverted (wind blowing FROM direction pushes pollution TOWARD opposite direction).
 */
export function estimatePollutionMovement(params: {
  latitude: number;
  longitude: number;
  timestamp?: string;
  horizonHours?: number;
  meteorology: MeteorologicalContext;
  hourlyForecast?: HourlyForecastPoint[];
}): PollutionMovementEstimate {
  const { latitude, longitude, meteorology, hourlyForecast } = params;
  const horizonHours = Math.min(24, Math.max(1, params.horizonHours || 6));
  const startTimeMs = params.timestamp ? new Date(params.timestamp).getTime() : Date.now();
  const startTimeIso = new Date(startTimeMs).toISOString();

  // Validate coordinates
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Invalid latitude for movement prediction: must be between -90 and 90.");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Invalid longitude for movement prediction: must be between -180 and 180.");
  }

  const movementPath: MovementPathPoint[] = [
    {
      timestamp: startTimeIso,
      stepHours: 0,
      latitude,
      longitude,
      distanceFromSourceKm: 0,
      segmentSpeedKmh: meteorology.windSpeedKmh,
      segmentBearingDegrees: meteorology.movementDirectionDegrees,
      segmentCompass: meteorology.movementDirectionCompass
    }
  ];

  let currentLat = latitude;
  let currentLng = longitude;
  let accumulatedDistanceKm = 0;
  const directionBearings: number[] = [];
  const warnings: string[] = [];

  // If hourly forecast is available, step hour-by-hour through forecast conditions
  const availableForecast = hourlyForecast && hourlyForecast.length > 0 ? hourlyForecast : [];

  for (let step = 1; step <= horizonHours; step++) {
    const forecastPoint = availableForecast.find((f) => f.hoursAhead === step);
    
    const windSpeed = forecastPoint ? forecastPoint.windSpeedKmh : meteorology.windSpeedKmh;
    const moveBearing = forecastPoint ? forecastPoint.movementDirectionDegrees : meteorology.movementDirectionDegrees;
    const moveCompass = forecastPoint ? forecastPoint.movementDirectionCompass : meteorology.movementDirectionCompass;

    directionBearings.push(moveBearing);

    // 1 hour step distance (km)
    const stepDistanceKm = Math.max(0, windSpeed * 1.0);
    const nextPoint = computeDestinationPoint(currentLat, currentLng, stepDistanceKm, moveBearing);

    accumulatedDistanceKm += stepDistanceKm;
    currentLat = nextPoint.latitude;
    currentLng = nextPoint.longitude;

    const stepTime = new Date(startTimeMs + step * 3600 * 1000).toISOString();
    const distFromSource = haversineDistanceKm(latitude, longitude, currentLat, currentLng);

    movementPath.push({
      timestamp: stepTime,
      stepHours: step,
      latitude: currentLat,
      longitude: currentLng,
      distanceFromSourceKm: distFromSource,
      segmentSpeedKmh: windSpeed,
      segmentBearingDegrees: moveBearing,
      segmentCompass: moveCompass
    });
  }

  // Calculate dominant direction
  const finalLocation = { latitude: currentLat, longitude: currentLng };
  const overallBearing = calculateBearingDegrees(latitude, longitude, currentLat, currentLng);
  const dominantDirection = degreesToCompass(overallBearing);

  // Confidence & Warning analysis
  let confidenceScore = 85;
  const reasons: string[] = [];

  if (meteorology.dataStatus === "DEMO_DATA") {
    confidenceScore -= 20;
    reasons.push("Based on simulated demo meteorological patterns");
  }

  // Wind speed check
  if (meteorology.windSpeedKmh < 3) {
    confidenceScore -= 40;
    warnings.push("Calm or very light wind (< 3 km/h); particulate dispersion will be dominated by local thermal convection rather than advection.");
    reasons.push("Low wind velocity reduces directional advection certainty");
  } else if (meteorology.windSpeedKmh > 35) {
    warnings.push("High wind speed (> 35 km/h) creates intense turbulence and accelerated dilution along plume corridor.");
    reasons.push("High atmospheric transport rate");
  }

  // Wind variability check across forecast intervals
  if (directionBearings.length > 1) {
    let maxDiff = 0;
    for (let i = 1; i < directionBearings.length; i++) {
      const diff = angleDifferenceDegrees(directionBearings[0], directionBearings[i]);
      if (diff > maxDiff) maxDiff = diff;
    }

    if (maxDiff > 60) {
      confidenceScore -= 25;
      warnings.push(`Wind direction shifts significantly (${Math.round(maxDiff)}°) over the next ${horizonHours} hours.`);
      reasons.push(`High wind directional variance of ${Math.round(maxDiff)}°`);
    } else if (maxDiff > 25) {
      confidenceScore -= 10;
      reasons.push(`Moderate wind directional variance of ${Math.round(maxDiff)}°`);
    } else {
      reasons.push(`Stable wind direction across ${horizonHours}-hour horizon (±${Math.round(maxDiff)}°)`);
    }
  } else {
    reasons.push("Single-point wind vector extrapolated over horizon");
  }

  // Precipitation check
  if (meteorology.precipitationMm > 5 || meteorology.precipitationType === "RAIN") {
    confidenceScore -= 15;
    warnings.push("Active precipitation will cause wet scavenging (rainout/washout) of aerosol particulates, reducing airborne plume extent.");
    reasons.push("Rainfall enhances particulate ground deposition");
  }

  confidenceScore = Math.max(20, Math.min(95, confidenceScore));
  const confidenceLevel: "HIGH" | "MEDIUM" | "LOW" =
    confidenceScore >= 75 ? "HIGH" : confidenceScore >= 50 ? "MEDIUM" : "LOW";

  const arrivalTime = movementPath[movementPath.length - 1].timestamp;

  return {
    source: {
      latitude,
      longitude,
      timestamp: startTimeIso
    },
    horizonHours,
    dominantMovementDirection: dominantDirection,
    dominantMovementBearingDegrees: overallBearing,
    estimatedTotalDistanceKm: Math.round(accumulatedDistanceKm * 10) / 10,
    estimatedFinalLocation: finalLocation,
    estimatedArrivalTime: arrivalTime,
    confidence: confidenceLevel,
    confidenceScore,
    confidenceReason: reasons.join("; ") || "Consistent wind direction and velocity",
    warnings,
    movementPath,
    method: "WIND_BASED_APPLICATION_ESTIMATE",
    disclaimer: "Application-generated wind-based estimate. For operational guidance only; does not replace complex 3D photochemical dispersion modeling."
  };
}
