import type {
  MeteorologicalContext,
  HourlyForecastPoint,
  PollutionMovementEstimate,
  MeteorologicalPredictionResponse,
  BricsFederationEvent
} from "../types.js";
import { GoogleWeatherProvider } from "./googleWeatherProvider.js";
import {
  getCachedCurrentConditions,
  setCachedCurrentConditions,
  getCachedHourlyForecast,
  setCachedHourlyForecast
} from "./meteorologyCache.js";
import { estimatePollutionMovement } from "./pollutionMovementEstimator.js";
import { getFederationEvents } from "./bricsFederationService.js";

// Singleton provider instance
const weatherProvider = new GoogleWeatherProvider();

/** Validate coordinate values */
function validateCoordinates(lat: number, lng: number) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude coordinate: ${lat}. Must be between -90 and 90.`);
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude coordinate: ${lng}. Must be between -180 and 180.`);
  }
}

/** Retrieve current normalized meteorological conditions for a geographic coordinate */
export async function getMeteorologyForCoordinates(
  latitude: number,
  longitude: number,
  timestamp?: string
): Promise<MeteorologicalContext> {
  validateCoordinates(latitude, longitude);

  // Check if historical timestamp is older than Google Weather API 24-hour limit
  if (timestamp) {
    const eventTime = new Date(timestamp).getTime();
    const now = Date.now();
    const hoursDiff = (now - eventTime) / (3600 * 1000);

    if (hoursDiff > 24 && process.env.DEMO_MODE !== "true") {
      return {
        source: "Google Weather API",
        observedAt: timestamp,
        latitude,
        longitude,
        temperatureC: 0,
        relativeHumidityPercent: 0,
        windSpeedKmh: 0,
        windDirectionDegrees: 0,
        windDirectionCompass: "N",
        movementDirectionDegrees: 180,
        movementDirectionCompass: "S",
        precipitationMm: 0,
        precipitationType: "NONE",
        dataStatus: "HISTORICAL_WEATHER_UNAVAILABLE",
        note: `Event timestamp is ${Math.round(hoursDiff)} hours old. Google Weather API hourly history supports up to 24 hours.`
      };
    }
  }

  // Check cache
  const cached = getCachedCurrentConditions(latitude, longitude);
  if (cached) {
    return cached;
  }

  const conditions = await weatherProvider.getCurrentConditions(latitude, longitude);
  setCachedCurrentConditions(latitude, longitude, conditions);
  return conditions;
}

/** Retrieve hourly meteorological forecast points for coordinates */
export async function getHourlyForecastForCoordinates(
  latitude: number,
  longitude: number,
  horizonHours = 6
): Promise<{ context: MeteorologicalContext; hourlyForecast: HourlyForecastPoint[] }> {
  validateCoordinates(latitude, longitude);
  const horizon = Math.min(24, Math.max(1, horizonHours));

  // Check cache
  const cached = getCachedHourlyForecast(latitude, longitude, horizon);
  if (cached) {
    return cached;
  }

  const result = await weatherProvider.getHourlyForecast(latitude, longitude, horizon);
  setCachedHourlyForecast(latitude, longitude, horizon, result);
  return result;
}

/** Predict wind-based movement vector and trajectory for coordinates or a specific event */
export async function predictMovement(params: {
  latitude: number;
  longitude: number;
  timestamp?: string;
  horizonHours?: number;
}): Promise<MeteorologicalPredictionResponse> {
  const { latitude, longitude, timestamp } = params;
  const horizonHours = Math.min(24, Math.max(1, params.horizonHours || Number(process.env.METEOROLOGY_MOVEMENT_HORIZON_HOURS || 6)));

  const { context, hourlyForecast } = await getHourlyForecastForCoordinates(latitude, longitude, horizonHours);

  const prediction = estimatePollutionMovement({
    latitude,
    longitude,
    timestamp: timestamp || context.observedAt,
    horizonHours,
    meteorology: context,
    hourlyForecast
  });

  return {
    source: {
      latitude,
      longitude,
      timestamp: timestamp || context.observedAt
    },
    meteorology: context,
    hourlyForecast,
    prediction,
    method: "WIND_BASED_APPLICATION_ESTIMATE"
  };
}

/** Attach meteorological context and movement prediction to a federation event */
export async function attachMeteorologyToEvent(
  event: BricsFederationEvent,
  horizonHours = 6
): Promise<BricsFederationEvent> {
  try {
    const { context, hourlyForecast } = await getHourlyForecastForCoordinates(
      event.latitude,
      event.longitude,
      horizonHours
    );

    const prediction = estimatePollutionMovement({
      latitude: event.latitude,
      longitude: event.longitude,
      timestamp: event.timestamp,
      horizonHours,
      meteorology: context,
      hourlyForecast
    });

    return {
      ...event,
      meteorology: context,
      movementEstimate: prediction
    };
  } catch (error) {
    console.error(`[MeteorologyService] Failed to attach weather to event '${event.eventId}':`, (error as Error).message);
    return event;
  }
}

/** Find a federation event by ID and return its full meteorological intelligence */
export async function getEventMeteorology(eventId: string, horizonHours = 6): Promise<{
  event: BricsFederationEvent;
  meteorology: MeteorologicalContext;
  prediction: PollutionMovementEstimate;
}> {
  const events = getFederationEvents({ limit: 100 });
  const event = events.find((e) => e.eventId === eventId);
  if (!event) {
    throw new Error(`Event '${eventId}' not found in BRICS federation pool.`);
  }

  const { context, hourlyForecast } = await getHourlyForecastForCoordinates(
    event.latitude,
    event.longitude,
    horizonHours
  );

  const prediction = estimatePollutionMovement({
    latitude: event.latitude,
    longitude: event.longitude,
    timestamp: event.timestamp,
    horizonHours,
    meteorology: context,
    hourlyForecast
  });

  return {
    event,
    meteorology: context,
    prediction
  };
}
