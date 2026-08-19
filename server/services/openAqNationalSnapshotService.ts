import { getOpenAqRateLimits, OpenAqError, fetchOpenAq } from "./openAqAuthService.js";
import { getOpenAqLatestDetailed, parseOpenAqLocation, type OpenAqLocation, type OpenAqReading, type OpenAqStationPoint } from "./openAqService.js";
import { distanceMeters } from "../utils/geo.js";

export interface OpenAqNationalStatus {
  configured: boolean;
  authenticationSuccessful: boolean;
  metadataComplete: boolean;
  latestSnapshotComplete: boolean;
  providerReportedLocationCount: number;
  fetchedLocationCount: number;
  processedLocationCount: number;
  successfulLatestCount: number;
  failedLatestCount: number;
  staleLocationCount: number;
  queuedLocationCount: number;
  fetchedPages: number;
  stopReason: string;
  lastRefreshAt?: string;
  nextRefreshAt?: string;
  refreshing: boolean;
}

export interface OpenAqNationalSnapshot {
  stations: OpenAqStationPoint[];
  status: OpenAqNationalStatus;
}

let snapshot: OpenAqNationalSnapshot = {
  stations: [],
  status: {
    configured: Boolean(process.env.OPENAQ_API_KEY),
    authenticationSuccessful: false,
    metadataComplete: false,
    latestSnapshotComplete: false,
    providerReportedLocationCount: 0,
    fetchedLocationCount: 0,
    processedLocationCount: 0,
    successfulLatestCount: 0,
    failedLatestCount: 0,
    staleLocationCount: 0,
    queuedLocationCount: 0,
    fetchedPages: 0,
    stopReason: "not_started",
    refreshing: false
  }
};
let refreshPromise: Promise<void> | undefined;
let locationsCache: { expires: number; locations: OpenAqLocation[]; complete: boolean; found: number; fetchedPages: number; stopReason: string } | undefined;
const latestByLocation = new Map<number, OpenAqStationPoint>();

function publishSnapshot(locationData: NonNullable<typeof locationsCache>, locations: OpenAqLocation[], counts: { successful: number; failed: number; stale: number }, refreshing: boolean) {
  const processed = counts.successful + counts.failed + counts.stale;
  const now = new Date();
  snapshot = {
    stations: [...latestByLocation.values()].sort((a, b) => a.locationId - b.locationId),
    status: {
      configured: true,
      authenticationSuccessful: counts.successful > 0 || counts.stale > 0 || snapshot.status.authenticationSuccessful,
      metadataComplete: locationData.complete,
      latestSnapshotComplete: !refreshing && locationData.complete && processed >= locations.length && counts.failed === 0,
      providerReportedLocationCount: locationData.found,
      fetchedLocationCount: locations.length,
      processedLocationCount: processed,
      successfulLatestCount: counts.successful,
      failedLatestCount: counts.failed,
      staleLocationCount: counts.stale,
      queuedLocationCount: Math.max(0, locations.length - processed),
      fetchedPages: locationData.fetchedPages,
      stopReason: refreshing ? "synchronizing" : locationData.stopReason,
      lastRefreshAt: now.toISOString(),
      nextRefreshAt: new Date(now.getTime() + minutes("OPENAQ_LATEST_CACHE_TTL_MINUTES", 10)).toISOString(),
      refreshing
    }
  };
}

function minutes(name: string, fallback: number) {
  const parsed = Number(process.env[name] || fallback);
  return (Number.isFinite(parsed) ? Math.max(1, parsed) : fallback) * 60_000;
}

function latestPoint(location: OpenAqLocation, readings: OpenAqReading[], additionalReadings: OpenAqStationPoint["additionalReadings"] = []): OpenAqStationPoint {
  const usable = Object.fromEntries(readings.filter((reading) => reading.value !== undefined && reading.unitCompatible && (reading.freshness === "fresh" || reading.freshness === "usable")).map((reading) => [reading.pollutant, reading])) as OpenAqStationPoint["readings"];
  const updates = readings.map((reading) => reading.measuredAt).filter((value): value is string => Boolean(value)).sort().reverse();
  const newestAge = readings.map((reading) => reading.ageHours).filter((age): age is number => Number.isFinite(age)).sort((a, b) => a - b)[0];
  return {
    id: `openaq:${location.id}`,
    locationId: location.id,
    name: location.name,
    locality: location.locality,
    lat: location.coordinates.latitude,
    lng: location.coordinates.longitude,
    provider: location.provider?.name,
    owner: location.owner?.name,
    isMonitor: location.isMonitor,
    sensors: location.sensors,
    readings: usable,
    lastUpdate: updates[0],
    freshness: newestAge === undefined ? "unknown" : newestAge <= 3 ? "fresh" : newestAge <= 12 ? "usable" : newestAge <= 24 ? "stale" : "expired",
    attribution: location.licenses?.[0]?.attribution?.name,
    license: location.licenses?.[0]?.name,
    datetimeFirst: location.datetimeFirst?.utc,
    datetimeLast: location.datetimeLast?.utc,
    timezone: location.timezone,
    additionalReadings
  };
}

async function fetchIndiaLocations(): Promise<NonNullable<typeof locationsCache>> {
  if (locationsCache && locationsCache.expires > Date.now()) return locationsCache;
  const locations: OpenAqLocation[] = [];
  const seen = new Set<number>();
  let page = 1;
  let found = 0;
  let fetchedPages = 0;
  let stopReason = "provider_error";
  const limit = Math.min(100, Math.max(10, Number(process.env.OPENAQ_LOCATION_PAGE_LIMIT || 100)));
  while (page <= 1000) {
    const query = new URLSearchParams({ iso: "IN", mobile: "false", limit: String(limit), page: String(page), order_by: "id", sort_order: "asc" });
    const response = await fetchOpenAq(`locations?${query.toString()}`);
    const json = await response.json() as { meta?: { found?: number; limit?: number }; results?: unknown[] };
    const values = Array.isArray(json.results) ? json.results.flatMap((value) => { const parsed = parseOpenAqLocation(value); return parsed && parsed.isMobile !== true ? [parsed] : []; }) : [];
    found = Number(json.meta?.found) || found;
    fetchedPages += 1;
    for (const location of values) if (!seen.has(location.id)) { seen.add(location.id); locations.push(location); }
    if (!values.length) { stopReason = found && locations.length < found ? "empty_page_before_total" : "provider_total_reached"; break; }
    if (found > 0 && locations.length >= found) { stopReason = "provider_total_reached"; break; }
    if (!found && values.length < limit) { stopReason = "short_final_page"; break; }
    page += 1;
  }
  if (page > 1000) stopReason = "hard_safety_cap_reached";
  const complete = found > 0 ? locations.length >= found : stopReason === "short_final_page";
  const result = { expires: Date.now() + minutes("OPENAQ_LOCATION_CACHE_TTL_MINUTES", 1440), locations, complete, found, fetchedPages, stopReason };
  locationsCache = result;
  return result;
}

async function refreshNationalSnapshot() {
  if (!process.env.OPENAQ_API_KEY) return;
  const locationData = await fetchIndiaLocations();
  const locations = locationData.locations.filter((location) => location.isMobile !== true && location.isMonitor !== false);
  const concurrency = Math.min(4, Math.max(2, Number(process.env.OPENAQ_SYNC_CONCURRENCY || 3)));
  let cursor = 0;
  let successful = 0;
  let failed = 0;
  let stale = 0;
  while (cursor < locations.length) {
    const batch = locations.slice(cursor, cursor + concurrency);
    cursor += batch.length;
    const results = await Promise.all(batch.map(async (location) => {
      try {
        const detailed = await getOpenAqLatestDetailed(location);
        return { location, point: latestPoint(location, detailed.readings, detailed.additionalReadings), ok: true };
      } catch (error) {
        if (error instanceof OpenAqError && error.statusCode === 429) {
          const limits = getOpenAqRateLimits();
          const resetSeconds = Number(limits["x-ratelimit-reset"] || 5);
          await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, Math.max(1_000, resetSeconds * 1000))));
        }
        return { location, point: latestByLocation.get(location.id), ok: false };
      }
    }));
    for (const result of results) {
      if (result.ok) { successful += 1; latestByLocation.set(result.location.id, result.point!); }
      else if (result.point) { stale += 1; latestByLocation.set(result.location.id, result.point); }
      else failed += 1;
    }
    // Make real station data visible immediately. Never clear a successful
    // prior snapshot merely because the national refresh is still running.
    publishSnapshot(locationData, locations, { successful, failed, stale }, true);
  }
  publishSnapshot(locationData, locations, { successful, failed, stale }, false);
}

export function refreshOpenAqNationalSnapshot(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  snapshot = { ...snapshot, status: { ...snapshot.status, refreshing: true } };
  refreshPromise = refreshNationalSnapshot().catch((error) => {
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    snapshot = { ...snapshot, status: { ...snapshot.status, refreshing: false, stopReason: error instanceof Error ? error.message : "provider_error", nextRefreshAt: retryAt } };
  }).finally(() => { refreshPromise = undefined; });
  return refreshPromise;
}

export function getOpenAqNationalSnapshot(options: { startRefresh?: boolean } = {}): OpenAqNationalSnapshot {
  if (options.startRefresh !== false && !snapshot.status.refreshing && (!snapshot.status.lastRefreshAt || !snapshot.status.nextRefreshAt || Date.parse(snapshot.status.nextRefreshAt) <= Date.now())) void refreshOpenAqNationalSnapshot();
  return snapshot;
}

export function getOpenAqNationalStationsNear(lat: number, lng: number, radiusKm = 25): OpenAqStationPoint[] {
  return snapshot.stations.filter((station) => distanceMeters(lat, lng, station.lat, station.lng) <= radiusKm * 1000).map((station) => ({ ...station, distanceMeters: distanceMeters(lat, lng, station.lat, station.lng) })).sort((a, b) => (a.distanceMeters || Infinity) - (b.distanceMeters || Infinity));
}

export function resetOpenAqNationalSnapshot() {
  snapshot = { ...snapshot, stations: [], status: { ...snapshot.status, metadataComplete: false, latestSnapshotComplete: false, lastRefreshAt: undefined, nextRefreshAt: undefined, stopReason: "reset", refreshing: false } };
  locationsCache = undefined;
  latestByLocation.clear();
}
