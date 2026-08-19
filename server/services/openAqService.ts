import { canonicalUnit, isCompatibleUnit, normalizePollutant, type PollutantCode } from "../airQuality/pollutants.js";
import { parseCpcbNumber, parseCpcbTimestamp, freshnessFromAge, type MeasurementFreshness } from "../airQuality/parsing.js";
import { fetchOpenAq } from "./openAqAuthService.js";
import { distanceMeters } from "../utils/geo.js";

export interface OpenAqSensor {
  id: number;
  name?: string;
  parameter?: { name?: string; units?: string; displayName?: string };
}

export interface OpenAqLocation {
  id: number;
  name: string;
  locality?: string;
  timezone?: string;
  country?: { code?: string; name?: string };
  owner?: { name?: string };
  provider?: { name?: string };
  isMobile?: boolean;
  isMonitor?: boolean;
  instruments?: Array<{ id: number; name?: string }>;
  sensors: OpenAqSensor[];
  coordinates: { latitude: number; longitude: number };
  licenses?: Array<{ name?: string; attribution?: { name?: string; url?: string | null } }>;
  datetimeFirst?: { utc?: string; local?: string };
  datetimeLast?: { utc?: string; local?: string };
  distance?: number | null;
}

export interface OpenAqReading {
  pollutant: PollutantCode;
  value?: number;
  unit: string;
  unitCompatible: boolean;
  sensorId: number;
  measuredAt?: string;
  ageHours?: number;
  freshness: MeasurementFreshness;
  rawParameter?: string;
  source: "openaq";
  exclusionReason?: string;
}

export interface OpenAqAdditionalReading {
  pollutant: string;
  value?: number;
  unit: string;
  unitCompatible: false;
  sensorId: number;
  measuredAt?: string;
  ageHours?: number;
  freshness: MeasurementFreshness;
  rawParameter?: string;
  source: "openaq";
  exclusionReason?: string;
}

export interface OpenAqStationPoint {
  id: string;
  locationId: number;
  name: string;
  locality?: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  provider?: string;
  owner?: string;
  isMonitor?: boolean;
  sensors: OpenAqSensor[];
  readings: Partial<Record<PollutantCode, OpenAqReading>>;
  lastUpdate?: string;
  freshness: MeasurementFreshness;
  attribution?: string;
  license?: string;
  datetimeFirst?: string;
  datetimeLast?: string;
  timezone?: string;
  additionalReadings?: OpenAqAdditionalReading[];
}

export interface OpenAqHistoryPoint {
  sensorId: number;
  pollutant: PollutantCode;
  dateTime: string;
  value: number;
  unit: string;
  unitCompatible: boolean;
}

function timestampValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const object = objectValue(value);
  return typeof object?.utc === "string" ? object.utc : typeof object?.local === "string" ? object.local : undefined;
}

interface OpenAqListResponse {
  meta?: { found?: number; limit?: number; page?: number };
  results?: unknown[];
}

const locationCache = new Map<string, { expires: number; value: OpenAqLocation[] }>();
const locationInflight = new Map<string, Promise<OpenAqLocation[]>>();
const latestCache = new Map<string, { expires: number; value: OpenAqReading[] }>();
const latestDetailedCache = new Map<string, { expires: number; value: { readings: OpenAqReading[]; additionalReadings: OpenAqAdditionalReading[] } }>();
const historyCache = new Map<string, { expires: number; value: OpenAqHistoryPoint[] }>();

function ttl(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  return (Number.isFinite(value) ? Math.max(1, value) : fallback) * 60_000;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function numberValue(value: unknown): number | undefined {
  const parsed = parseCpcbNumber(value);
  return parsed.status === "valid" ? parsed.value : undefined;
}

export function parseOpenAqLocation(value: unknown): OpenAqLocation | undefined {
  const item = objectValue(value);
  const coordinates = objectValue(item?.coordinates);
  const id = numberValue(item?.id);
  const lat = numberValue(coordinates?.latitude);
  const lng = numberValue(coordinates?.longitude);
  if (!id || typeof item?.name !== "string" || lat === undefined || lng === undefined || lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  const country = objectValue(item.country);
  const owner = objectValue(item.owner);
  const provider = objectValue(item.provider);
  const sensors = Array.isArray(item.sensors) ? item.sensors.flatMap((sensor) => {
    const parsed = objectValue(sensor);
    const parameter = objectValue(parsed?.parameter);
    const sensorId = numberValue(parsed?.id);
    return sensorId === undefined ? [] : [{ id: sensorId, name: typeof parsed?.name === "string" ? parsed.name : undefined, parameter: { name: typeof parameter?.name === "string" ? parameter.name : undefined, units: typeof parameter?.units === "string" ? parameter.units : undefined, displayName: typeof parameter?.displayName === "string" ? parameter.displayName : undefined } }];
  }) : [];
  return {
    id,
    name: item.name,
    locality: typeof item.locality === "string" ? item.locality : undefined,
    timezone: typeof item.timezone === "string" ? item.timezone : undefined,
    country: { code: typeof country?.code === "string" ? country.code : undefined, name: typeof country?.name === "string" ? country.name : undefined },
    owner: { name: typeof owner?.name === "string" ? owner.name : undefined },
    provider: { name: typeof provider?.name === "string" ? provider.name : undefined },
    isMobile: item.isMobile === true,
    isMonitor: item.isMonitor === true,
    instruments: Array.isArray(item.instruments) ? item.instruments.flatMap((instrument) => {
      const parsed = objectValue(instrument);
      const instrumentId = numberValue(parsed?.id);
      return instrumentId === undefined ? [] : [{ id: instrumentId, name: typeof parsed?.name === "string" ? parsed.name : undefined }];
    }) : [],
    sensors,
    coordinates: { latitude: lat, longitude: lng },
    licenses: Array.isArray(item.licenses) ? item.licenses.flatMap((license) => {
      const parsed = objectValue(license);
      if (!parsed) return [];
      const attribution = objectValue(parsed.attribution);
      return [{ name: typeof parsed.name === "string" ? parsed.name : undefined, attribution: { name: typeof attribution?.name === "string" ? attribution.name : undefined, url: typeof attribution?.url === "string" ? attribution.url : null } }];
    }) : [],
    datetimeFirst: objectValue(item.datetimeFirst) as OpenAqLocation["datetimeFirst"],
    datetimeLast: objectValue(item.datetimeLast) as OpenAqLocation["datetimeLast"],
    distance: typeof item.distance === "number" ? item.distance : null
  };
}

function locationCacheKey(lat: number, lng: number, radiusKm: number, limit: number) {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}:${limit}`;
}

export function validateOpenAqRadius(radiusKm = 25): number {
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 25) throw new Error("radiusKm must be finite, positive, and no greater than 25 km.");
  return radiusKm;
}

export async function getOpenAqLocations(lat: number, lng: number, options: { radiusKm?: number; limit?: number } = {}): Promise<OpenAqLocation[]> {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error("lat and lng must be finite coordinates.");
  const radiusKm = validateOpenAqRadius(options.radiusKm ?? 25);
  const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 100)));
  const key = locationCacheKey(lat, lng, radiusKm, limit);
  const cached = locationCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const existing = locationInflight.get(key);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const locations: OpenAqLocation[] = [];
      let page = 1;
      let found: number | undefined;
      while (locations.length < limit && page <= 5) {
        const query = new URLSearchParams({ coordinates: `${lat},${lng}`, radius: String(Math.min(25_000, Math.round(radiusKm * 1000))), iso: "IN", mobile: "false", limit: String(Math.min(100, limit - locations.length)), page: String(page) });
        const response = await fetchOpenAq(`locations?${query.toString()}`);
        const json = await response.json() as unknown;
        const data = objectValue(json) as OpenAqListResponse | undefined;
        const pageLocations = Array.isArray(data?.results) ? data.results.flatMap((item) => { const parsed = parseOpenAqLocation(item); return parsed ? [parsed] : []; }) : [];
        locations.push(...pageLocations);
        found = typeof data?.meta?.found === "number" ? data.meta.found : found;
        if (!pageLocations.length || locations.length >= (found ?? limit) || pageLocations.length < Math.min(100, limit - locations.length)) break;
        page += 1;
      }
      const unique = [...new Map(locations.map((location) => [location.id, location])).values()].slice(0, limit);
      locationCache.set(key, { expires: Date.now() + ttl("OPENAQ_LOCATION_CACHE_TTL_MINUTES", 1440), value: unique });
      return unique;
    } catch (error) {
      const stale = locationCache.get(key);
      if (stale) return stale.value;
      throw error;
    } finally {
      locationInflight.delete(key);
    }
  })();
  locationInflight.set(key, promise);
  return promise;
}

function parseLatestReading(value: unknown, location: OpenAqLocation): OpenAqReading | OpenAqAdditionalReading | undefined {
  const item = objectValue(value);
  const sensorId = numberValue(item?.sensorsId ?? item?.sensorId ?? item?.sensor_id);
  const sensor = location.sensors.find((candidate) => candidate.id === sensorId);
  const parameter = sensor?.parameter?.name || sensor?.name;
  const pollutant = normalizePollutant(parameter);
  const numeric = numberValue(item?.value);
  if (sensorId === undefined || !sensor || numeric === undefined) return undefined;
  const unit = sensor.parameter?.units || (pollutant ? canonicalUnit(pollutant) : "as reported");
  const date = typeof item?.datetime === "object" ? objectValue(item.datetime)?.utc : item?.datetime;
  const parsed = parseCpcbTimestamp(date);
  const compatible = pollutant ? isCompatibleUnit(pollutant, unit) : false;
  if (!pollutant) return { pollutant: String(parameter || "unknown").toUpperCase(), value: numeric, unit, unitCompatible: false, sensorId, measuredAt: parsed.parsedAt, ageHours: parsed.ageHours, freshness: freshnessFromAge(parsed.ageHours), rawParameter: parameter, source: "openaq", exclusionReason: "unsupported_pollutant" };
  return { pollutant, value: numeric, unit, unitCompatible: compatible, sensorId, measuredAt: parsed.parsedAt, ageHours: parsed.ageHours, freshness: freshnessFromAge(parsed.ageHours), rawParameter: parameter, source: "openaq", exclusionReason: compatible ? undefined : "incompatible_unit" };
}

export async function getOpenAqLatestDetailed(location: OpenAqLocation): Promise<{ readings: OpenAqReading[]; additionalReadings: OpenAqAdditionalReading[] }> {
  const cached = latestDetailedCache.get(String(location.id));
  if (cached && cached.expires > Date.now()) return cached.value;
  const response = await fetchOpenAq(`locations/${location.id}/latest`);
  const json = objectValue(await response.json());
  const parsed = Array.isArray(json?.results) ? json.results.flatMap((item) => { const value = parseLatestReading(item, location); return value ? [value] : []; }) : [];
  const value = { readings: parsed.filter((reading): reading is OpenAqReading => normalizePollutant(reading.pollutant) !== undefined) as OpenAqReading[], additionalReadings: parsed.filter((reading): reading is OpenAqAdditionalReading => normalizePollutant(reading.pollutant) === undefined) as OpenAqAdditionalReading[] };
  latestDetailedCache.set(String(location.id), { expires: Date.now() + ttl("OPENAQ_LATEST_CACHE_TTL_MINUTES", 10), value });
  return value;
}

export async function getOpenAqLatest(location: OpenAqLocation): Promise<OpenAqReading[]> {
  const key = String(location.id);
  const cached = latestCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const detailed = await getOpenAqLatestDetailed(location);
  const results = detailed.readings;
  latestCache.set(key, { expires: Date.now() + ttl("OPENAQ_LATEST_CACHE_TTL_MINUTES", 10), value: results });
  return results;
}

export async function getOpenAqNearbyStations(lat: number, lng: number, options: { radiusKm?: number; limit?: number } = {}): Promise<OpenAqStationPoint[]> {
  const locations = await getOpenAqLocations(lat, lng, { radiusKm: options.radiusKm, limit: Math.min(options.limit ?? 12, 12) });
  const stations = (await Promise.all(locations.map(async (location) => {
    try {
      const detailed = await getOpenAqLatestDetailed(location);
      const readings = detailed.readings;
      const usable = Object.fromEntries(readings.filter((reading) => reading.value !== undefined && reading.unitCompatible && (reading.freshness === "fresh" || reading.freshness === "usable")).map((reading) => [reading.pollutant, reading])) as Partial<Record<PollutantCode, OpenAqReading>>;
      const updates = readings.map((reading) => reading.measuredAt).filter((value): value is string => Boolean(value)).sort().reverse();
      const newestAge = readings.map((reading) => reading.ageHours).filter((age): age is number => Number.isFinite(age)).sort((a, b) => a - b)[0];
      return { id: `openaq:${location.id}`, locationId: location.id, name: location.name, locality: location.locality, lat: location.coordinates.latitude, lng: location.coordinates.longitude, distanceMeters: location.distance ?? distanceMeters(lat, lng, location.coordinates.latitude, location.coordinates.longitude), provider: location.provider?.name, owner: location.owner?.name, isMonitor: location.isMonitor, sensors: location.sensors, readings: usable, additionalReadings: detailed.additionalReadings, lastUpdate: updates[0], freshness: freshnessFromAge(newestAge), attribution: location.licenses?.[0]?.attribution?.name, license: location.licenses?.[0]?.name } as OpenAqStationPoint;
    } catch {
      // One unavailable location must not suppress other nearby stations.
      return undefined;
    }
  }))).filter((station) => station !== undefined) as OpenAqStationPoint[];
  return stations.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
}

export async function getOpenAqHourlyHistory(sensorId: number, pollutant: PollutantCode, options: { days?: number; limit?: number } = {}): Promise<OpenAqHistoryPoint[]> {
  const days = Math.max(1, Math.min(14, Math.floor(options.days ?? 7)));
  // OpenAQ v3 rejects oversized page limits; 500 covers the configured 14-day cap.
  const limit = Math.max(1, Math.min(500, Math.floor(options.limit ?? days * 24)));
  const key = `${sensorId}:${pollutant}:${days}:${limit}`;
  const cached = historyCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const query = new URLSearchParams({ datetime_from: from.toISOString(), datetime_to: to.toISOString(), limit: String(limit), page: "1" });
  const response = await fetchOpenAq(`sensors/${sensorId}/hours?${query.toString()}`);
  const json = objectValue(await response.json());
  const results = Array.isArray(json?.results) ? json.results.flatMap((item) => {
    const parsed = objectValue(item);
    const value = numberValue(parsed?.value);
    const period = objectValue(parsed?.period);
    const date = timestampValue(period?.datetimeTo) || timestampValue(period?.datetimeFrom) || timestampValue(parsed?.datetime);
    if (value === undefined || !date) return [];
    const timestamp = new Date(date);
    if (!Number.isFinite(timestamp.getTime())) return [];
    const unit = canonicalUnit(pollutant);
    return [{ sensorId, pollutant, dateTime: timestamp.toISOString(), value, unit, unitCompatible: true }];
  }) : [];
  historyCache.set(key, { expires: Date.now() + ttl("OPENAQ_HISTORY_CACHE_TTL_MINUTES", 60), value: results });
  return results;
}

export function clearOpenAqCaches() {
  locationCache.clear();
  locationInflight.clear();
  latestCache.clear();
  latestDetailedCache.clear();
  historyCache.clear();
}
