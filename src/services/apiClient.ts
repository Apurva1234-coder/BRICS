import type {
  AirQualityMapResponse,
  AirQualitySourcesResponse,
  AirQualitySummary,
  AqiForecastResult,
  CpcbLocalContext,
  CpcbPollutantCode,
  CpcbStationPoint,
  OpenAqStationPoint,
  ForecastStationsResponse,
  LocalityIntelligence,
  PollutionReport,
  PollutionSituation,
  ReportStatus,
  StateForecastResponse,
  SatelliteEvidence,
  RecurringHotspotContext,
  SensitiveLocationImpactContext,
  ContextualPriorityContext,
  BricsCountryNode,
  BricsFederationEvent,
  BricsFederationStatusResponse,
  BricsCountryCode,
  BricsPollutionType,
  BricsPollutantMetrics,
  BricsFederationSeverity,
  MeteorologicalContext,
  HourlyForecastPoint,
  PollutionMovementEstimate,
  MeteorologicalPredictionResponse
} from "../types";
import { frontendEnv } from "./env";

const API_BASE = frontendEnv.apiBaseUrl;
const API_REQUEST_TIMEOUT_MS = 10_000;

const errorMessages: Record<string, string> = {
  gemini_not_configured: "AI verification is not configured. Add GEMINI_API_KEY.",
  gemini_auth_failed: "Gemini key is invalid or unauthorized.",
  gemini_rate_limited: "Gemini is temporarily rate limited.",
  hash_mismatch: "Image upload integrity check failed.",
  duplicate_image_hash: "This exact photo was already submitted recently.",
  not_pollution: "No visible pollution evidence was found.",
  unclear_photo: "Photo evidence is weak. Try a clearer image or submit for review.",
  invalid_media: "Upload a valid photo.",
  rate_limited: "Too many submissions. Please wait and try again.",
  non_live_evidence: "This appears to be a photo of a screen or another non-live image. Please capture the actual pollution location using the live camera.",
  MEDIA_STORAGE_UNAVAILABLE: "Report media storage is temporarily unavailable. Please try again."
};

async function request<T>(path: string, init?: RequestInit, timeoutMs = API_REQUEST_TIMEOUT_MS): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
      signal: controller.signal
    });
  } catch (err) {
    if (timedOut) throw new Error("Request timed out. Please try again.");
    if (init?.signal?.aborted) throw err;
    throw new Error("Backend unavailable. Please try again.");
  } finally {
    window.clearTimeout(timeout);
    init?.signal?.removeEventListener("abort", abortFromCaller);
  }
  const text = await response.text();

  let parsed: unknown = null;
  if (text.trim()) {
    try {
      parsed = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(text || `Request failed with ${response.status}`);
      }
      throw new Error("Server returned an invalid JSON response.");
    }
  }

  if (!response.ok) {
    const errorPayload = parsed as { error?: string; reasonCode?: string } | null;
    const error = new Error(
      (errorPayload?.reasonCode && errorMessages[errorPayload.reasonCode]) ||
      errorPayload?.error ||
      text ||
      `Request failed with ${response.status}`
    );
    error.name = errorPayload?.reasonCode || `HTTP_${response.status}`;
    throw error;
  }

  if (!text.trim()) {
    throw new Error("Server returned an empty response body.");
  }

  return parsed as T;
}

export interface SituationsResponse {
  generatedAt: string;
  totalSituations: number;
  situations: PollutionSituation[];
}

export interface SituationDetailResponse {
  situation: PollutionSituation;
  reports: PollutionReport[];
}

export interface NearbyCpcbStationsResponse {
  provider: "cpcb_data_gov";
  lat: number;
  lng: number;
  radiusKm: number;
  stations: CpcbStationPoint[];
  stationCount: number;
  generatedAt: string;
  sourceNote: string;
}

export interface NearbyOpenAqStationsResponse {
  provider: "openaq";
  lat: number;
  lng: number;
  radiusKm: number;
  stations: OpenAqStationPoint[];
  stationCount: number;
  generatedAt: string;
  sourceNote: string;
}

export interface CpcbStatusResponse {
  configured: boolean;
  recordCount: number;
  usableRecordCount: number;
  stationCount: number;
  pollutantsAvailable: CpcbPollutantCode[];
  latestUpdate?: string;
  oldestUpdate?: string;
  cacheExpiresAt?: string;
  reason: string;
}

export interface CurrentAqiStatusResponse {
  generatedAt: string;
  snapshot: { complete: boolean; refreshing: boolean; processedStations: number; queuedStations: number; successfulValidatedStations: number; failedStations: number; [key: string]: unknown };
  coverage: { providerReported: number; rollingValidated: number; indicative: number; pending: number; unavailable: number; totalPhysicalStations: number };
  reasons: Record<string, number>;
  warnings: string[];
}

export interface GetSituationsParams {
  limit?: number;
  priority?: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
}

export interface RewardProfile { displayName: string; locality: string; totalPoints: number; resolvedReports: number; validReports: number; rank: number; badges: string[]; lastPointsAwardedAt?: string; }
export interface LeaderboardEntry { displayName: string; locality: string; totalPoints: number; resolvedReports: number; validReports: number; rank: number; badges: string[]; isDemo?: boolean; }

export const apiClient = {
  analyzeDemoEvidence: (payload: { imageBase64: string; imageMimeType: string; context?: string }) =>
    request<{ gemini: PollutionReport["gemini"]; decision: { status: PollutionReport["status"]; trustLevel: PollutionReport["trustLevel"]; evidenceStatus: PollutionReport["evidenceStatus"] } }>("/api/demo/analyze-evidence", { method: "POST", body: JSON.stringify(payload) }),
  createReport: (payload: unknown) =>
    request<PollutionReport>("/api/reports", {
      method: "POST",
      body: JSON.stringify(payload)
    }, 120_000),
  getReports: () => request<PollutionReport[]>("/api/reports"),
  getAirQuality: (lat: number, lng: number) =>
    request<AirQualitySummary>(`/api/air-quality?lat=${lat}&lng=${lng}`),
  getAirQualitySources: (lat: number, lng: number) =>
    request<AirQualitySourcesResponse>(`/api/air-quality/sources?lat=${lat}&lng=${lng}`),
  getAirQualityMap: (
    params?: { lat?: number; lng?: number; country?: string; iso?: string; global?: boolean } | { lat: number; lng: number },
    options?: { signal?: AbortSignal }
  ) => {
    const q = new URLSearchParams();
    if (params) {
      if ("lat" in params && params.lat !== undefined) q.set("lat", String(params.lat));
      if ("lng" in params && params.lng !== undefined) q.set("lng", String(params.lng));
      if ("country" in params && params.country) q.set("country", params.country);
      if ("iso" in params && params.iso) q.set("iso", params.iso);
      if ("global" in params && params.global) q.set("global", "true");
    }
    const qs = q.toString();
    return request<AirQualityMapResponse>(`/api/air-quality/map${qs ? `?${qs}` : ""}`, options);
  },
  loadSatellitePollution: (payload: { country: string; pollutant: string; startDate: string; endDate: string }, options?: { signal?: AbortSignal }) => request<{ success: boolean; tileUrl: string; pollutant: string; country: string; source: string; dataset: string; band: string; legend: { label: string; unit: string; min: number; max: number }; metadata: { startDate: string; endDate: string } }>("/api/satellite", { method: "POST", body: JSON.stringify(payload), signal: options?.signal }),
  getLocalAirQualityMap: (region = "pune_pcmc") =>
    request<AirQualityMapResponse>(`/api/air-quality/local-map?region=${encodeURIComponent(region)}`),
  getLocality: (lat: number, lng: number, historical = false) =>
    request<LocalityIntelligence>(`/api/locality?lat=${lat}&lng=${lng}${historical ? "&historical=true" : ""}`),
  getForecast: (input: string | { lat: number; lng: number; station?: string }) => {
    if (typeof input === "string") {
      return request<AqiForecastResult>(`/api/forecast?station=${encodeURIComponent(input)}`);
    }
    const q = new URLSearchParams({
      lat: String(input.lat),
      lng: String(input.lng)
    });
    if (input.station) q.set("station", input.station);
    return request<AqiForecastResult>(`/api/air-quality/forecast-24h?${q.toString()}`);
  },
  getForecastStations: () => request<ForecastStationsResponse>("/api/forecast/stations"),
  getNearbyCpcbStations: (params: { lat: number; lng: number; radiusKm?: number; limit?: number; pollutant?: CpcbPollutantCode | "all" }) => {
    const q = new URLSearchParams({ lat: String(params.lat), lng: String(params.lng) });
    if (params.radiusKm !== undefined) q.set("radiusKm", String(params.radiusKm));
    if (params.limit !== undefined) q.set("limit", String(params.limit));
    if (params.pollutant) q.set("pollutant", params.pollutant);
    return request<NearbyCpcbStationsResponse>(`/api/air-quality/cpcb/nearby?${q.toString()}`);
  },
  getNearbyOpenAqStations: (params: { lat: number; lng: number; radiusKm?: number; limit?: number }) => {
    const q = new URLSearchParams({ lat: String(params.lat), lng: String(params.lng) });
    if (params.radiusKm !== undefined) q.set("radiusKm", String(params.radiusKm));
    if (params.limit !== undefined) q.set("limit", String(params.limit));
    return request<NearbyOpenAqStationsResponse>(`/api/air-quality/openaq/nearby?${q.toString()}`);
  },
  getCpcbLocalContext: (params: { lat: number; lng: number; radiusKm?: number; pollutant?: CpcbPollutantCode | "all" }) => {
    const q = new URLSearchParams({ lat: String(params.lat), lng: String(params.lng) });
    if (params.radiusKm !== undefined) q.set("radiusKm", String(params.radiusKm));
    if (params.pollutant) q.set("pollutant", params.pollutant);
    return request<CpcbLocalContext>(`/api/air-quality/cpcb/local-context?${q.toString()}`);
  },
  getCpcbStatus: () => request<CpcbStatusResponse>("/api/air-quality/cpcb/status"),
  getAqiStatus: (refresh = false, options?: { signal?: AbortSignal }) => request<CurrentAqiStatusResponse>(`/api/air-quality/aqi-status${refresh ? "?refresh=true" : ""}`, options),
  getNationalAirStatus: (refresh = false) => request<any>(`/api/air-quality/national-status${refresh ? "?refresh=true" : ""}`),
  updateStatus: (id: string, status: ReportStatus) =>
    request<PollutionReport>(`/api/reports/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),
  updateAction: (id: string, payload: unknown) =>
    request<PollutionReport>(`/api/reports/${id}/action`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  resolveReport: (id: string, payload: unknown) =>
    request<PollutionReport>(`/api/reports/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateNgoProgress: (id: string, payload: unknown) => request<PollutionReport>(`/api/reports/${id}/ngo-progress`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateMunicipalProgress: (id: string, payload: unknown) => request<PollutionReport>(`/api/municipal/reports/${id}/status`, { method: "PATCH", body: JSON.stringify(payload) }),
  submitNgoCleanupProof: (id: string, payload: unknown) => request<PollutionReport>(`/api/reports/${id}/ngo-cleanup-proof`, { method: "POST", body: JSON.stringify(payload) }),
  updateResolutionStatus: (id: string, status: string) => request<PollutionReport>(`/api/reports/${id}/resolution-status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getSituations: (params?: GetSituationsParams) => {
    const q = new URLSearchParams();
    if (params?.limit !== undefined) q.set("limit", String(params.limit));
    if (params?.priority) q.set("priority", params.priority);
    if (params?.lat !== undefined) q.set("lat", String(params.lat));
    if (params?.lng !== undefined) q.set("lng", String(params.lng));
    if (params?.radiusMeters !== undefined) q.set("radiusMeters", String(params.radiusMeters));
    const qs = q.toString();
    return request<SituationsResponse>(`/api/situations${qs ? `?${qs}` : ""}`);
  },
  getSituation: (id: string) =>
    request<SituationDetailResponse>(`/api/situations/${id}`),
  getReportContextualIntelligence: (id: string) =>
    request<{
      reportId: string;
      recurrence: RecurringHotspotContext;
      sensitiveLocations: SensitiveLocationImpactContext;
      contextualPriority: ContextualPriorityContext;
    }>(`/api/reports/${id}/contextual-intelligence`),
  getMyReports: (userId: string) =>
    request<PollutionReport[]>(`/api/reports/mine?userId=${encodeURIComponent(userId)}`),
  getRewards: (userId: string) => request<{ profile: RewardProfile | null }>(`/api/users/${encodeURIComponent(userId)}/rewards`),
  getPointsHistory: (userId: string) => request<{ transactions: Array<{ transactionId: string; reportId: string; points: number; reason: string; createdAt: string }> }>(`/api/users/${encodeURIComponent(userId)}/points-history`),
  getLeaderboard: (params: { period: "monthly" | "all"; locality?: string }) => {
    const query = new URLSearchParams({ period: params.period });
    if (params.locality) query.set("locality", params.locality);
    return request<{ entries: LeaderboardEntry[] }>(`/api/leaderboard?${query.toString()}`);
  },
  getStatus: () =>
    request<{
      service: string;
      firebaseAdmin: boolean;
      reportStore: "firestore" | "memory";
      mediaStorage: "local" | "firebase_storage_disabled" | "firebase_storage";
      cpcbConfigured: boolean;
      openAqConfigured: boolean;
      openAqAuthenticationSuccessful: boolean;
      currentAirQualityConfigured: boolean;
      geminiConfigured: boolean;
      forecastEngineConfigured: boolean;
      stateForecastConfigured?: boolean;
      stateForecastCacheTtlMinutes?: number;
      stateForecastLastGeneratedAt?: string | null;
    }>("/api/status"),
  getStateForecasts: (forceRefresh?: boolean) =>
    request<StateForecastResponse>(`/api/air-quality/state-forecasts${forceRefresh ? "?forceRefresh=true" : ""}`),
  getSatelliteStatus: () => request<any>("/api/satellite/status"),
  verifyReportSatellite: (reportId: string) =>
    request<{ message: string; satelliteEvidence: SatelliteEvidence }>(`/api/satellite/verify-report/${reportId}`, { method: "POST" }),
  getReportSatelliteEvidence: (reportId: string) =>
    request<{ satelliteEvidence: SatelliteEvidence }>(`/api/satellite/report/${reportId}`),

  // BRICS Environmental Federation Layer API
  getBricsNodes: () =>
    request<{ success: boolean; nodes: BricsCountryNode[]; count: number; timestamp: string }>("/api/brics/federation/nodes"),
  getBricsNode: (nodeId: string) =>
    request<{ success: boolean; node: BricsCountryNode }>(`/api/brics/federation/nodes/${encodeURIComponent(nodeId)}`),
  registerBricsNode: (payload: {
    countryCode: BricsCountryCode;
    nodeId?: string;
    countryName?: string;
    endpointUrl?: string;
    geographicRegion?: string;
    supportedDataSources?: BricsCountryNode["supportedDataSources"];
    contactEmail?: string;
  }) =>
    request<{ success: boolean; node: BricsCountryNode; message: string }>("/api/brics/federation/nodes/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  publishBricsEvent: (event: Partial<BricsFederationEvent> & {
    sourceCountry: BricsCountryCode;
    latitude: number;
    longitude: number;
    pollutionType: BricsPollutionType;
    pollutantValues: BricsPollutantMetrics;
    severity: BricsFederationSeverity;
  }) =>
    request<{ success: boolean; event: BricsFederationEvent; message: string }>("/api/brics/federation/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event)
    }),
  getBricsEvents: (params?: {
    country?: string;
    targetCountry?: string;
    severity?: string;
    pollutionType?: string;
    limit?: number;
    since?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.country) q.set("country", params.country);
    if (params?.targetCountry) q.set("targetCountry", params.targetCountry);
    if (params?.severity) q.set("severity", params.severity);
    if (params?.pollutionType) q.set("pollutionType", params.pollutionType);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.since) q.set("since", params.since);
    const qs = q.toString();
    return request<{ success: boolean; events: BricsFederationEvent[]; count: number; timestamp: string }>(
      `/api/brics/federation/events${qs ? `?${qs}` : ""}`
    );
  },
  getBricsEventsRelevantToCountry: (countryCode: string) =>
    request<{
      success: boolean;
      countryCode: string;
      countryName: string;
      flag: string;
      relevantEvents: BricsFederationEvent[];
      count: number;
      timestamp: string;
    }>(`/api/brics/federation/events/relevant/${encodeURIComponent(countryCode)}`),
  getBricsFederationStatus: () =>
    request<{ success: boolean; status: BricsFederationStatusResponse }>("/api/brics/federation/status"),

  // Meteorological Intelligence Layer API
  getMeteorology: (latitude: number, longitude: number, timestamp?: string) =>
    request<MeteorologicalContext>(
      `/api/meteorology?latitude=${latitude}&longitude=${longitude}${timestamp ? `&timestamp=${encodeURIComponent(timestamp)}` : ""}`
    ),
  getEventMeteorology: (eventId: string, horizonHours?: number) =>
    request<{
      success: boolean;
      eventId: string;
      meteorology: MeteorologicalContext;
      prediction: PollutionMovementEstimate;
      source: string;
      dataStatus: string;
    }>(`/api/meteorology/event/${encodeURIComponent(eventId)}${horizonHours ? `?horizonHours=${horizonHours}` : ""}`),
  predictMovement: (payload: {
    eventId?: string;
    latitude?: number;
    longitude?: number;
    timestamp?: string;
    horizonHours?: number;
  }) =>
    request<MeteorologicalPredictionResponse>("/api/meteorology/predict-movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
};
