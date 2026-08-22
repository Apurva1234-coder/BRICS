import type { MeteorologicalContext, HourlyForecastPoint } from "../types.js";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const currentConditionsCache = new Map<string, CacheEntry<MeteorologicalContext>>();
const hourlyForecastCache = new Map<
  string,
  CacheEntry<{ context: MeteorologicalContext; hourlyForecast: HourlyForecastPoint[] }>
>();

function makeCoordKey(lat: number, lng: number): string {
  // Round to 2 decimal places (~1.1 km precision) to bucket nearby requests efficiently
  const rLat = lat.toFixed(2);
  const rLng = lng.toFixed(2);
  return `${rLat},${rLng}`;
}

export function getCachedCurrentConditions(lat: number, lng: number): MeteorologicalContext | null {
  const key = makeCoordKey(lat, lng);
  const entry = currentConditionsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    currentConditionsCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedCurrentConditions(
  lat: number,
  lng: number,
  data: MeteorologicalContext,
  ttlMinutes = Number(process.env.METEOROLOGY_CACHE_TTL_CURRENT_MINUTES || 5)
): void {
  const key = makeCoordKey(lat, lng);
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  currentConditionsCache.set(key, { data, expiresAt });
}

export function getCachedHourlyForecast(
  lat: number,
  lng: number,
  horizonHours = 6
): { context: MeteorologicalContext; hourlyForecast: HourlyForecastPoint[] } | null {
  const key = `${makeCoordKey(lat, lng)}:${horizonHours}`;
  const entry = hourlyForecastCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    hourlyForecastCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCachedHourlyForecast(
  lat: number,
  lng: number,
  horizonHours: number,
  data: { context: MeteorologicalContext; hourlyForecast: HourlyForecastPoint[] },
  ttlMinutes = Number(process.env.METEOROLOGY_CACHE_TTL_FORECAST_MINUTES || 15)
): void {
  const key = `${makeCoordKey(lat, lng)}:${horizonHours}`;
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  hourlyForecastCache.set(key, { data, expiresAt });
}

export function clearMeteorologyCache(): void {
  currentConditionsCache.clear;
  currentConditionsCache.clear();
  hourlyForecastCache.clear();
}
