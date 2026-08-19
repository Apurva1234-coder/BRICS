import type { PollutantCode } from "../airQuality/pollutants.js";
import { isCompatibleUnit, normalizePollutant } from "../airQuality/pollutants.js";
import { calculateRollingIndianAqi, type AqiResult } from "../airQuality/aqi.js";
import { buildRollingWindow, type RollingWindowResult } from "../airQuality/hourlySeries.js";
import { getOpenAqHourlyHistory, type OpenAqHistoryPoint, type OpenAqSensor, type OpenAqStationPoint } from "./openAqService.js";

export type StationAqiStatus =
  | "validated_available"
  | "insufficient_history"
  | "insufficient_pollutants"
  | "insufficient_coverage"
  | "unsupported_sensors"
  | "pending"
  | "failed";

export interface StationAqiSubIndex {
  concentration: number;
  subIndex: number;
  averagingHours: number;
  observedSlots: number;
  expectedSlots: number;
  interpolatedSlots: number;
  missingSlots: number;
  coveragePercent: number;
  sourceProvider: "openaq";
  sensorId?: number;
  stationId: string;
  windowStart: string;
  windowEnd: string;
}

export interface SensorSelectionDiagnostic {
  pollutant: PollutantCode;
  selectedSensorId?: number;
  candidateSensorIds: number[];
  selectionReason: string;
  rejectedCandidates: Array<{ sensorId: number; reason: string }>;
}

export interface StationAqiResult {
  value: number;
  category: string;
  dominantPollutant: PollutantCode;
  quality: "provider_reported" | "rolling_validated" | "indicative";
  calculationType: "provider_reported" | "rolling_history_calculated" | "reported_average_estimate";
  isOfficial: boolean;
  averagingPeriodsVerified: boolean;
  coverageValidated: boolean;
  subIndices: Partial<Record<PollutantCode, StationAqiSubIndex>>;
  calculationTrace: { windows: RollingWindowResult[]; sensorSelections: SensorSelectionDiagnostic[]; aqi: AqiResult };
  warnings: string[];
}

export interface StationAqiSnapshot {
  physicalStationId: string;
  locationId: number;
  stationName: string;
  lat: number;
  lng: number;
  validated?: StationAqiResult;
  selected?: StationAqiResult;
  status: StationAqiStatus;
  lastCalculatedAt?: string;
  nextRefreshAt?: string;
  warnings: string[];
}

export interface CurrentAqiSnapshotStatus {
  startedAt?: string;
  lastCompletedAt?: string;
  nextRefreshAt?: string;
  complete: boolean;
  refreshing: boolean;
  queuedStations: number;
  processedStations: number;
  successfulValidatedStations: number;
  successfulIndicativeStations: number;
  failedStations: number;
  totalPhysicalStations: number;
  reasons: { insufficientHistory: number; insufficientCoverage: number; insufficientPollutants: number; incompatibleUnits: number; unsupportedSensors: number; providerErrors: number };
  warnings: string[];
}

const results = new Map<number, StationAqiSnapshot>();
let refreshPromise: Promise<void> | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
const stationRegistry = new Map<number, OpenAqStationPoint>();
const cycleProcessed = new Set<number>();
let queue: OpenAqStationPoint[] = [];
let cursor = 0;
let status: CurrentAqiSnapshotStatus = {
  complete: false,
  refreshing: false,
  queuedStations: 0,
  processedStations: 0,
  successfulValidatedStations: 0,
  successfulIndicativeStations: 0,
  failedStations: 0,
  totalPhysicalStations: 0,
  reasons: { insufficientHistory: 0, insufficientCoverage: 0, insufficientPollutants: 0, incompatibleUnits: 0, unsupportedSensors: 0, providerErrors: 0 },
  warnings: []
};

function boundedInt(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name] || fallback);
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? Math.floor(value) : fallback));
}

function stationKey(station: OpenAqStationPoint) { return String(station.locationId); }

function sensorCandidates(station: OpenAqStationPoint) {
  const grouped = new Map<PollutantCode, OpenAqSensor[]>();
  for (const sensor of station.sensors) {
    const pollutant = normalizePollutant(sensor.parameter?.name || sensor.name);
    const unit = sensor.parameter?.units;
    if (!pollutant || !unit || !isCompatibleUnit(pollutant, unit)) continue;
    grouped.set(pollutant, [...(grouped.get(pollutant) || []), sensor]);
  }
  return grouped;
}

function orderedStations(stations: OpenAqStationPoint[], priorityIds = new Set<number>()) {
  return [...stations].sort((a, b) => {
    const aPriority = priorityIds.has(a.locationId) ? 0 : 1;
    const bPriority = priorityIds.has(b.locationId) ? 0 : 1;
    const aFresh = a.freshness === "fresh" || a.freshness === "usable" ? 0 : 1;
    const bFresh = b.freshness === "fresh" || b.freshness === "usable" ? 0 : 1;
    return aPriority - bPriority || aFresh - bFresh || (b.readings ? Object.keys(b.readings).length : 0) - (a.readings ? Object.keys(a.readings).length : 0) || a.locationId - b.locationId;
  });
}

function toResult(aqi: AqiResult, windows: RollingWindowResult[], selections: SensorSelectionDiagnostic[], stationId: string): StationAqiResult | undefined {
  if (aqi.aqi === undefined || !aqi.category || !aqi.dominantPollutant) return undefined;
  const subIndices = Object.fromEntries(Object.entries(aqi.subIndices).flatMap(([pollutant, subIndex]) => {
    const window = windows.find((candidate) => candidate.pollutant === pollutant);
    if (!window || subIndex === undefined || window.rollingConcentration === undefined) return [];
    const selection = selections.find((candidate) => candidate.pollutant === pollutant);
    return [[pollutant, { concentration: window.rollingConcentration, subIndex, averagingHours: window.averagingHours, observedSlots: window.observedHourlySlots, expectedSlots: window.expectedHourlySlots, interpolatedSlots: window.interpolatedHourlySlots, missingSlots: window.missingHourlySlots, coveragePercent: window.coveragePercent, sourceProvider: "openaq", sensorId: selection?.selectedSensorId, stationId, windowStart: window.windowStart, windowEnd: window.windowEnd }]];
  })) as StationAqiResult["subIndices"];
  return { value: aqi.aqi, category: aqi.category, dominantPollutant: aqi.dominantPollutant, quality: "rolling_validated", calculationType: "rolling_history_calculated", isOfficial: false, averagingPeriodsVerified: true, coverageValidated: true, subIndices, calculationTrace: { windows, sensorSelections: selections, aqi }, warnings: aqi.warnings || [] };
}

async function processStation(station: OpenAqStationPoint, requestBudget: { remaining: number }): Promise<StationAqiSnapshot> {
  const existing = results.get(station.locationId);
  const base = { physicalStationId: station.id, locationId: station.locationId, stationName: station.name, lat: station.lat, lng: station.lng };
  const candidates = sensorCandidates(station);
  if (!candidates.size) return { ...base, status: "unsupported_sensors", warnings: ["unsupported_sensors"] };
  if (requestBudget.remaining <= 0) return { ...base, status: "pending", warnings: ["request_budget_exhausted"] };

  const windows: RollingWindowResult[] = [];
  const rollingReadings: Array<{ pollutant: PollutantCode; value: number; averagingHours: number; stationId: string; source: string; coverage: { averagingHours: number; observedHourlySlots: number; expectedHourlySlots: number } }> = [];
  const selections: SensorSelectionDiagnostic[] = [];
  let budgetExhausted = false;
  for (const [pollutant, sensors] of candidates.entries()) {
    const latestSensor = station.readings[pollutant]?.sensorId;
    const ordered = [...sensors].sort((a, b) => Number(b.id === latestSensor) - Number(a.id === latestSensor) || a.id - b.id);
    const selection: SensorSelectionDiagnostic = { pollutant, selectedSensorId: ordered[0]?.id, candidateSensorIds: ordered.map((sensor) => sensor.id), selectionReason: latestSensor === ordered[0]?.id ? "latest_supported_sensor_preferred" : "deterministic_lowest_supported_sensor", rejectedCandidates: ordered.slice(1).map((sensor) => ({ sensorId: sensor.id, reason: "not_selected_for_station_consistency" })) };
    selections.push(selection);
    if (requestBudget.remaining <= 0 || !ordered[0]) {
      budgetExhausted = requestBudget.remaining <= 0;
      break;
    }
    requestBudget.remaining -= 1;
    try {
      const history = await getOpenAqHourlyHistory(ordered[0].id, pollutant, { days: boundedInt("CURRENT_AQI_HISTORY_DAYS", 2, 2, 7), limit: 500 });
      const window = buildRollingWindow(pollutant, history, { maxAgeHours: boundedInt("CURRENT_AQI_MAX_AGE_HOURS", 12, 1, 48), maxInterpolatedGapHours: 2 });
      windows.push(window);
      if (window.valid && window.rollingConcentration !== undefined) rollingReadings.push({ pollutant, value: window.rollingConcentration, averagingHours: window.averagingHours, stationId: station.id, source: "openaq", coverage: { averagingHours: window.averagingHours, observedHourlySlots: window.observedHourlySlots + window.interpolatedHourlySlots, expectedHourlySlots: window.expectedHourlySlots } });
    } catch {
      selection.rejectedCandidates.push({ sensorId: ordered[0].id, reason: "history_request_failed" });
    }
  }

  if (budgetExhausted) return { ...base, status: "pending", warnings: ["request_budget_exhausted"] };

  const aqi = calculateRollingIndianAqi(rollingReadings);
  const validated = toResult(aqi, windows, selections, station.id);
  if (validated) {
    const now = new Date();
    const next = new Date(now.getTime() + boundedInt("CURRENT_AQI_CACHE_TTL_MINUTES", 30, 5, 180) * 60_000).toISOString();
    return { ...base, validated, selected: validated, status: "validated_available", lastCalculatedAt: now.toISOString(), nextRefreshAt: next, warnings: validated.warnings };
  }
  const warningSet = new Set([...(aqi.warnings || []), ...windows.flatMap((window) => window.invalidReasons)]);
  const stationStatus: StationAqiStatus = candidates.size < 3 ? "insufficient_pollutants" : warningSet.has("insufficient_hourly_coverage") || warningSet.has("long_or_unfillable_gap") || warningSet.has("stale_or_expired_history") ? "insufficient_coverage" : "insufficient_history";
  if (existing?.validated) return { ...existing, status: stationStatus, warnings: [...new Set([...existing.warnings, "refresh_incomplete_using_previous_snapshot"])] };
  return { ...base, status: stationStatus, warnings: [...warningSet] };
}

function ensureQueue(stations: OpenAqStationPoint[], priorityLocationIds: number[] = []) {
  for (const station of stations) stationRegistry.set(station.locationId, station);
  const registered = orderedStations([...stationRegistry.values()], new Set(priorityLocationIds));
  const queuedIds = new Set(queue.map(stationKey));
  const additions = registered.filter((station) => !queuedIds.has(stationKey(station)));
  if (additions.length) queue.push(...additions);

  const due = Boolean(status.complete && status.nextRefreshAt && Date.parse(status.nextRefreshAt) <= Date.now());
  if (due && !status.refreshing) {
    queue = registered;
    cursor = 0;
    cycleProcessed.clear();
    status = { ...status, complete: false, processedStations: 0, queuedStations: queue.length, startedAt: new Date().toISOString() };
  }

  const hasNewStations = additions.length > 0;
  if (hasNewStations) {
    const startingNewCycle = status.complete || !status.startedAt;
    if (startingNewCycle) cycleProcessed.clear();
    status = { ...status, totalPhysicalStations: registered.length, queuedStations: Math.max(0, queue.length - cursor), complete: false, processedStations: startingNewCycle ? 0 : status.processedStations, startedAt: startingNewCycle ? new Date().toISOString() : status.startedAt };
  } else if (!status.totalPhysicalStations) {
    status = { ...status, totalPhysicalStations: registered.length, queuedStations: Math.max(0, queue.length - cursor) };
  }
}

async function runRefresh() {
  if (!queue.length) {
    status = { ...status, complete: false, refreshing: false, queuedStations: 0, warnings: ["no_open_aq_station_history_candidates"] };
    return;
  }
  const concurrency = boundedInt("CURRENT_AQI_SYNC_CONCURRENCY", 2, 2, 3);
  const batchSize = boundedInt("CURRENT_AQI_REFRESH_BATCH_SIZE", 20, 1, 50);
  const maxRequests = boundedInt("CURRENT_AQI_MAX_REQUESTS_PER_RUN", 100, 1, 300);
  const requestBudget = { remaining: maxRequests };
  status = { ...status, refreshing: true, warnings: [] };
  while (cursor < queue.length && requestBudget.remaining > 0) {
    const batchEnd = Math.min(cursor + batchSize, queue.length);
    while (cursor < batchEnd && requestBudget.remaining > 0) {
      const group = queue.slice(cursor, Math.min(cursor + concurrency, batchEnd));
      const processed = await Promise.all(group.map(async (station) => {
        try { return await processStation(station, requestBudget); } catch (error) { return { physicalStationId: station.id, locationId: station.locationId, stationName: station.name, lat: station.lat, lng: station.lng, status: "failed" as const, warnings: [error instanceof Error ? error.message : "provider_error"] }; }
      }));
      let advanced = 0;
      for (const result of processed) {
        if (result.status === "pending" && result.warnings.includes("request_budget_exhausted")) break;
        results.set(result.locationId, result);
        cycleProcessed.add(result.locationId);
        advanced += 1;
      }
      cursor += advanced;
      if (!advanced) break;
      const completed = [...results.values()];
      status = { ...status, totalPhysicalStations: stationRegistry.size, processedStations: cycleProcessed.size, queuedStations: Math.max(0, queue.length - cursor), successfulValidatedStations: completed.filter((result) => result.status === "validated_available").length, successfulIndicativeStations: completed.filter((result) => result.selected?.quality === "indicative").length, failedStations: completed.filter((result) => result.status === "failed").length, reasons: reasonCounts(completed) };
    }
  }
  if (cursor >= queue.length) {
    const now = new Date();
    status = { ...status, complete: true, refreshing: false, queuedStations: 0, lastCompletedAt: now.toISOString(), nextRefreshAt: new Date(now.getTime() + boundedInt("CURRENT_AQI_CACHE_TTL_MINUTES", 30, 5, 180) * 60_000).toISOString() };
  } else {
    status = { ...status, refreshing: true, queuedStations: Math.max(0, queue.length - cursor), warnings: ["aqi_history_processing_pending"] };
    refreshTimer = setTimeout(() => { refreshTimer = undefined; void startRefresh(); }, 250);
  }
}

function reasonCounts(items: StationAqiSnapshot[]) {
  return {
    insufficientHistory: items.filter((item) => item.status === "insufficient_history").length,
    insufficientCoverage: items.filter((item) => item.status === "insufficient_coverage").length,
    insufficientPollutants: items.filter((item) => item.status === "insufficient_pollutants").length,
    incompatibleUnits: items.filter((item) => item.warnings.some((warning) => warning.includes("incompatible"))).length,
    unsupportedSensors: items.filter((item) => item.status === "unsupported_sensors").length,
    providerErrors: items.filter((item) => item.status === "failed").length
  };
}

function startRefresh() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = runRefresh().catch((error) => {
    status = { ...status, refreshing: false, failedStations: status.failedStations + 1, warnings: [error instanceof Error ? error.message : "provider_error"] };
  }).finally(() => { refreshPromise = undefined; });
  return refreshPromise;
}

export function getCurrentAqiSnapshot(stations: OpenAqStationPoint[], priorityLocationIds?: number[]) {
  ensureQueue(stations, priorityLocationIds);
  const due = !status.refreshing && (!status.nextRefreshAt || Date.parse(status.nextRefreshAt) <= Date.now());
  if (queue.length && due && !refreshTimer) void startRefresh();
  return { byLocationId: new Map([...results.entries()]), status: getCurrentAqiStatus() };
}

export async function refreshCurrentAqiSnapshot(stations: OpenAqStationPoint[], priorityLocationIds?: number[]) {
  ensureQueue(stations, priorityLocationIds);
  await startRefresh();
}

export function getCurrentAqiStatus(): CurrentAqiSnapshotStatus {
  return { ...status, reasons: { ...status.reasons }, warnings: [...status.warnings] };
}

export function resetCurrentAqiSnapshot() {
  if (refreshTimer) clearTimeout(refreshTimer);
  results.clear();
  stationRegistry.clear();
  cycleProcessed.clear();
  queue = [];
  cursor = 0;
  status = { complete: false, refreshing: false, queuedStations: 0, processedStations: 0, successfulValidatedStations: 0, successfulIndicativeStations: 0, failedStations: 0, totalPhysicalStations: 0, reasons: { insufficientHistory: 0, insufficientCoverage: 0, insufficientPollutants: 0, incompatibleUnits: 0, unsupportedSensors: 0, providerErrors: 0 }, warnings: [] };
}
