export type PollutionType =
  | "garbage_burning"
  | "road_dust"
  | "construction_dust"
  | "industrial_smoke"
  | "vehicle_smoke"
  | "open_waste"
  | "illegal_dumping"
  | "stagnant_water"
  | "sewage_overflow"
  | "water_pollution"
  | "unclear"
  | "not_pollution";

export type SatelliteEvidenceStatus =
  | "not_requested"
  | "pending"
  | "processing"
  | "ready"
  | "unavailable"
  | "failed";

export type SatelliteObservabilityStatus = "observable" | "partially_observable" | "cloud_obscured" | "insufficient_valid_pixels" | "temporal_mismatch" | "not_suitable_for_event_type" | "not_suitable_for_resolution" | "provider_unavailable";
export type SatelliteAssessmentResult = "potentially_consistent" | "possible_surface_change" | "no_observable_signal" | "contradictory_context" | "inconclusive" | "not_observable";

export interface SentinelSceneSummary {
  collection: "sentinel-2-l2a";
  sceneId: string;
  acquisitionTime: string;
  cloudCover?: number;
  bbox: number[];
  source?: "catalog";
  temporalOffsetHours?: number;
  relation?: "baseline" | "near_report" | "follow_up";
  localCloudPercent?: number;
  validPixelPercent?: number;
  catalogSceneId?: string;
  processedAcquisitionTimes?: string[];
  sameAcquisitionConfirmed?: boolean;
  warning?: string;
}

export interface SatelliteMetric {
  name:
    | "geometry_pixel_count"
    | "source_valid_pixel_count"
    | "analysis_valid_pixel_count"
    | "local_cloud_pixel_count"
    | "local_cloud_percent"
    | "valid_analysis_pixel_percent"
    | "nbr"
    | "bsi"
    | "aerosol_optical_thickness"
    | "baseline_nbr"
    | "comparison_nbr"
    | "delta_nbr"
    | "baseline_bsi"
    | "comparison_bsi"
    | "delta_bsi";
  value?: number;
  mean?: number;
  min?: number;
  max?: number;
  p90?: number;
  unit?: string;
  interpretation?: string;
}

export interface SatelliteEvidenceThumbnail {
  nearTrueColor?: string;
  baselineTrueColor?: string;
  followUpTrueColor?: string;
  swirNirContext?: string;
  nbrContext?: string;
  changeContext?: string;
  bareSurfaceContext?: string;
}

export interface SatelliteObservability { status: SatelliteObservabilityStatus; score: number; localCloudPercent?: number; validPixelPercent?: number; geometryPixelCount?: number; temporalOffsetHours?: number; reasons: string[]; }
export interface SatelliteContextAssessment { result: SatelliteAssessmentResult; confidence: number; source: "deterministic" | "gemini_multimodal"; observability: "observable" | "partially_observable" | "not_observable"; eventSuitability: "suitable" | "partially_suitable" | "not_suitable"; citizenPhotoSignals: string[]; satelliteSignals: string[]; surfaceChangeSignals: string[]; contradictorySignals: string[]; temporalConsistency: "relevant" | "weak" | "mismatched"; spatialContext: "potentially_consistent" | "unclear" | "contradictory"; explanation: string; limitations: string[]; }
export interface SatelliteComparison { baselineNBR?: number; comparisonNBR?: number; deltaNBR?: number; baselineBSI?: number; comparisonBSI?: number; deltaBSI?: number; baselineAot?: number; comparisonAot?: number; validPixelPercent: number; }

export interface SatelliteEvidence {
  provider: "sentinel_hub";
  status: SatelliteEvidenceStatus;
  reportLocation: { lat: number; lng: number; source: "frozen_capture_gps" | "legacy_report_coordinates"; aoiRadiusMeters: number };
  eventTime: { photoCapturedAt: string; source: "photo_capture_time" | "report_created_time" };
  eventSuitability: { level: "suitable" | "partially_suitable" | "not_suitable"; reason: string };
  observability: SatelliteObservability;
  assessment: SatelliteContextAssessment;
  evidenceContributionPoints: number;
  decisionEffect: "none" | "supporting_context";
  attribution: string;
  warnings: string[];
  checkedAt?: string;
  requestedAt?: string;
  completedAt?: string;
  scenes: { nearReport?: SentinelSceneSummary; baseline?: SentinelSceneSummary; followUp?: SentinelSceneSummary };
  products: SatelliteEvidenceThumbnail;
  metrics: SatelliteMetric[];
  explanation: string;
  limitations: string[];
  comparison?: SatelliteComparison;
  error?: {
    code?: string;
    message: string;
    retryable?: boolean;
  };
}

export type Severity = "low" | "medium" | "high" | "severe";
export type ReportStatus =
  | "Analyzing"
  | "Submitted"
  | "New"
  | "Assigned"
  | "Accepted"
  | "In Progress"
  | "Cleanup In Progress"
  | "Cleanup Proof Submitted"
  | "Resolved"
  | "False Report"
  | "Manual review needed"
  | "Rejected";

export interface GeminiResult {
  is_pollution_related: boolean;
  pollution_visible: boolean;
  image_quality: "clear" | "usable" | "poor" | "unusable";
  image_quality_score: number;
  pollution_type: PollutionType;
  confidence: number;
  severity: Severity;
  evidence_strength?: number;
  visible_evidence: string[];
  rejection_reason?: string;
  possible_pollutants: string[];
  public_summary: string;
  municipal_action: string;
  needs_manual_review: boolean;
  trust_decision: "verified" | "likely_valid" | "needs_review" | "rejected";
  second_pass_used?: boolean;
  safety_note: string;
}

export interface BackendVerificationDecision {
  accepted: boolean;
  status: "Submitted" | "Manual review needed" | "Rejected";
  trustLevel: TrustLevel;
  evidenceStatus: "verified" | "needs_review" | "rejected";
  reasonCode?: string;
  message?: string;
}

export type TrustLevel = "Verified" | "Likely Valid" | "Needs Review" | "Rejected";
export type EvidenceStatus = "stored" | "verified" | "needs_review" | "rejected";

export interface MediaEvidence {
  mediaId: string;
  type: "photo" | "video";
  storagePath: string;
  cloudUri?: string;
  thumbnailPath?: string;
  publicUrl?: string;
  displayUrl?: string;
  storageProvider?: "firebase_storage" | "local_dev" | "browser_indexeddb";
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  uploadedAt: string;
  fileModifiedAt?: string;
  capturedAt?: string;
  width?: number;
  height?: number;
  exifAvailable?: boolean;
  captureEvidence?: CaptureEvidence;
  metadataWarnings: string[];
}

export type CaptureMethod = "live_camera" | "uploaded_image";
export type CameraFacingMode = "environment" | "user";

export interface CaptureLocationEvidence {
  lat: number;
  lng: number;
  accuracyMeters: number;
  capturedAt: string;
}

export interface CaptureEvidence {
  captureMethod: CaptureMethod;
  cameraFacingMode?: CameraFacingMode;
  photoCapturedAt: string;
  captureLocation: CaptureLocationEvidence;
  gpsAgeAtShutterSeconds?: number;
}

export interface AuthenticityResult {
  authenticityScore: number;
  authenticityLevel: "likely_real" | "suspicious" | "needs_manual_review";
  authenticityFlags: string[];
}

export interface EvidenceScoreResult {
  evidenceScore: number;
  trustLevel: TrustLevel;
  scoreBreakdown: {
    visualEvidenceScore: number;
    authenticityScore: number;
    nearbyCorroborationScore: number;
    locationConfidenceScore: number;
    recencyScore: number;
  };
  reasons: string[];
}

export interface LocalitySummary {
  locality_id: string;
  locality_name: string;
  nearby_150m_count: number;
  nearby_250m_count: number;
  nearby_500m_count: number;
  relatedReportIds: string[];
  relatedMedia: MediaEvidence[];
}

export interface LocalityIntelligence {
  lat: number;
  lng: number;
  radiusMeters: number;
  reportCount: number;
  activeReportCount: number;
  activeHotspotCount: number;
  averageEvidenceScore: number;
  maxHotspotScore: number;
  dominantPollutionType?: PollutionType;
  nearby_150m_count: number;
  nearby_250m_count: number;
  nearby_500m_count: number;
  recentReports: PollutionReport[];
  recommendation: string;
}

export interface LocalRiskAdvisor {
  likelyCause: string;
  causeConfidence: "low" | "medium" | "high";
  healthConcerns: string[];
  citizenAdvice: string[];
  municipalActions: string[];
  reductionMeasures: string[];
  recurringHotspot?: {
    isRecurring: boolean;
    reportCount7d: number;
    radiusMeters: number;
    dominantIssue: string;
    recommendation: string;
  };
  priorityReasons: string[];
  disclaimer: string;
}

export interface ResolutionProof {
  beforeMediaId?: string;
  afterMedia?: MediaEvidence;
  actionTaken: string;
  resolvedBy?: string;
  resolvedAt: string;
  notes?: string;
}

export interface MunicipalAssignment {
  teamId: string;
  teamName: string;
  department: "Sanitation" | "Roads" | "Drainage" | "Traffic" | "Environment" | "Other";
  status: "Assigned" | "Accepted" | "Cleanup In Progress" | "Cleanup Proof Submitted" | "Resolved";
  assignedAt: string;
}

export interface ActionLogEntry {
  type:
    | "report_created"
    | "media_uploaded"
    | "gemini_verified"
    | "evidence_scored"
    | "assigned"
    | "status_changed"
    | "resolution_proof_uploaded"
    | "ngo_progress_updated"
    | "ngo_cleanup_proof_submitted"
    | "resolved";
  at: string;
  note?: string;
}

/** A citizen-safe audit trail for the report progress timeline. */
export interface ReportStatusHistoryEntry {
  status: string;
  label: string;
  timestamp: string;
  updatedByRole?: "citizen" | "system" | "officer" | "municipal";
  message?: string;
}

export type AirQualityProvider = "cpcb_data_gov" | "openaq" | "open_meteo" | "fused_measured" | "locally_forecast" | "unavailable";

export type AirQualityAqiQuality = "provider_reported" | "rolling_validated" | "indicative" | "unavailable";
export type AirQualityAqiCalculationType = "provider_reported" | "rolling_history_calculated" | "reported_average_estimate" | "unavailable";
export interface AirQualityAqiResult {
  value: number;
  category: string;
  quality: AirQualityAqiQuality;
  calculationType: AirQualityAqiCalculationType;
  isOfficial: boolean;
  dominantPollutant?: CpcbPollutantCode;
  averagingPeriodsVerified: boolean;
  coverageValidated: boolean;
  subIndices?: Partial<Record<CpcbPollutantCode, { concentration: number; subIndex: number; averagingHours?: number; observedSlots?: number; expectedSlots?: number; coveragePercent?: number; sourceProvider?: string; sensorId?: number; stationId?: string; windowStart?: string; windowEnd?: string }>>;
  calculationTrace?: unknown;
  warnings: string[];
}
export interface AirQualityMapAqi {
  selected?: AirQualityAqiResult;
  validated?: AirQualityAqiResult;
  indicative?: AirQualityAqiResult;
  status: "validated_available" | "indicative_available" | "provider_reported_available" | "pending" | "insufficient_history" | "insufficient_pollutants" | "insufficient_coverage" | "unavailable";
  warnings: string[];
}

export type IndianAqiPollutant = "PM2.5" | "PM10" | "NO2" | "SO2" | "CO" | "OZONE" | "NH3" | "PB";
export type AdditionalAirParameter = "NO" | "NOX" | "BC" | "CH4" | "CO2" | "HUMIDITY" | "TEMPERATURE" | string;
export type MeasurementValueKind = "average" | "maximum" | "minimum" | "instantaneous";
export type AggregationPeriod = "instantaneous" | "hourly" | "8h" | "24h" | "provider_reported_average" | "unknown";
export interface MeasurementEligibility {
  displayAsCurrentMeasurement: boolean;
  usableForLocalContext: boolean;
  usableForClusterStatistic: boolean;
  usableForAqi: boolean;
  reasons: string[];
}
export type AirQualityWarningCode = "missing_source" | "invalid_value" | "stale_data" | "expired_data" | "incompatible_unit" | "provider_error" | "incomplete_pagination" | "station_match_uncertain" | "insufficient_history";
export interface AirQualityWarning { code: AirQualityWarningCode; message: string; provider?: AirQualityProvider; pollutant?: CpcbPollutantCode; }
export interface NormalizedPollutantReading { pollutant: CpcbPollutantCode; value?: number; unit: string; provider?: AirQualityProvider; station?: string; stationId?: string; distanceMeters?: number; measuredAt?: string; ageHours?: number; freshness?: "fresh" | "usable" | "stale" | "expired" | "unknown"; valueKind?: MeasurementValueKind; aggregationPeriod?: AggregationPeriod; aggregationPeriodVerified?: boolean; unitCompatible?: boolean; usableForCurrentFusion?: boolean; usableForAqi?: boolean; selectionReason?: string; status?: "available" | "source_missing" | "invalid" | "stale" | "expired" | "timestamp_unknown" | "maximum_only" | "minimum_only"; exclusionReason?: string; eligibility?: MeasurementEligibility; rawValue?: number; normalizedValue?: number; rawUnit?: string; measuredAtLocal?: string; sourceSensorId?: number; warnings?: string[]; }
export interface PollutantSourceBundle { pollutant: CpcbPollutantCode; cpcb?: NormalizedPollutantReading; openaq?: NormalizedPollutantReading; selectedCurrent?: NormalizedPollutantReading; samePhysicalStation: boolean; selectionReason?: string; conflict?: { detected: boolean; absoluteDifference?: number; relativeDifferencePercent?: number; reason?: string }; }
export interface AirQualityStation { id: string; name: string; provider: AirQualityProvider | "matched"; lat: number; lng: number; city?: string; state?: string; distanceMeters?: number; lastUpdate?: string; freshness?: "fresh" | "usable" | "stale" | "expired" | "unknown"; pollutants: Partial<Record<CpcbPollutantCode, NormalizedPollutantReading>>; providers?: AirQualityProvider[]; attribution?: string; license?: string; sourceReadings?: { cpcb?: Partial<Record<CpcbPollutantCode, NormalizedPollutantReading>>; openaq?: Partial<Record<CpcbPollutantCode, NormalizedPollutantReading>>; }; sourceBundles?: Partial<Record<CpcbPollutantCode, PollutantSourceBundle>>; }

export interface AirQualitySummary {
  provider: AirQualityProvider;
  aqi?: number;
  category?: string;
  dominantPollutant?: string;
  pollutants?: Record<string, unknown>;
  healthRecommendations?: string;
  nearestStation?: string;
  nearestStationDistanceMeters?: number;
  lastUpdate?: string;
  dateTime?: string;
  regionCode?: string;
  rawSummary?: string;
  status?: "available" | "unavailable";
  readings?: Partial<Record<CpcbPollutantCode, NormalizedPollutantReading>>;
  station?: AirQualityStation;
  nearbyStations?: AirQualityStation[];
  warnings?: AirQualityWarning[];
  confidence?: "high" | "medium" | "low" | "unavailable";
  sourceNote?: string;
  debug?: unknown;
  pollutantSources?: Partial<Record<CpcbPollutantCode, { station: string; distanceMeters?: number; provider?: AirQualityProvider; reading?: NormalizedPollutantReading; }>>;
  calculationType?: "provider_reported" | "rolling_history_calculated" | "reported_average_estimate" | "unavailable";
  isOfficial?: boolean;
  aqiQuality?: AirQualityAqiQuality;
  aqiStatus?: AirQualityMapAqi;
  calculationTrace?: unknown;
}

export interface AirQualitySourceStatus {
  configured: boolean;
  usable: boolean;
  reason: string;
  value?: AirQualitySummary;
}

export interface AirQualitySourcesResponse {
  lat: number;
  lng: number;
  selectedProvider: AirQualityProvider;
  selected: AirQualitySummary;
  cpcb: AirQualitySourceStatus;
  openaq?: AirQualitySourceStatus;
  warnings?: AirQualityWarning[];
}

export type AirQualityMapMetric = "aqi" | IndianAqiPollutant;
export type CpcbPollutantCode = IndianAqiPollutant;

export interface CpcbPollutantReading {
  pollutant: CpcbPollutantCode;
  min?: number;
  max?: number;
  avg?: number;
  value?: number;
  unit: string;
  lastUpdate?: string;
  rawPollutantId?: string;
  valueKind?: "average" | "maximum" | "minimum";
  measuredAt?: string;
  ageHours?: number;
  freshness?: "fresh" | "usable" | "stale" | "expired" | "unknown";
  status?: "available" | "source_missing" | "invalid" | "stale" | "expired" | "timestamp_unknown" | "maximum_only" | "minimum_only";
  usableForCurrentFusion?: boolean;
  usableForAqi?: boolean;
  selectionReason?: string;
  exclusionReason?: string;
  qualityFlags?: string[];
  aggregationPeriod?: AggregationPeriod;
  aggregationPeriodVerified?: boolean;
  eligibility?: MeasurementEligibility;
}

export interface CpcbStationPoint {
  id: string;
  station: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  distanceMeters?: number;
  lastUpdate?: string;
  pollutants: Partial<Record<CpcbPollutantCode, CpcbPollutantReading>>;
  dominantPollutant?: CpcbPollutantCode;
  aqi?: number;
  category?: string;
  freshness: "fresh" | "usable" | "same_day" | "stale" | "expired" | "unknown";
  freshnessLabel: string;
}

export interface OpenAqStationReading {
  pollutant: CpcbPollutantCode;
  value?: number;
  unit: string;
  unitCompatible: boolean;
  sensorId: number;
  measuredAt?: string;
  ageHours?: number;
  freshness: "fresh" | "usable" | "stale" | "expired" | "unknown";
  rawParameter?: string;
  rawValue?: number;
  normalizedValue?: number;
  rawUnit?: string;
  measuredAtLocal?: string;
  aggregationPeriod?: AggregationPeriod;
  aggregationPeriodVerified?: boolean;
  flags?: string[];
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
  readings: Partial<Record<CpcbPollutantCode, OpenAqStationReading>>;
  lastUpdate?: string;
  freshness: "fresh" | "usable" | "stale" | "expired" | "unknown";
  attribution?: string;
  license?: string;
  datetimeFirst?: string;
  datetimeLast?: string;
  timezone?: string;
  additionalReadings?: Array<OpenAqStationReading & { pollutant: AdditionalAirParameter }>;
}

export interface CpcbLocalContext {
  provider: "cpcb_station_context";
  lat: number;
  lng: number;
  radiusKm: number;
  generatedAt: string;
  pollutants: Partial<Record<CpcbPollutantCode, {
    unit: string;
    nearestValue?: number;
    nearestStation?: string;
    nearestDistanceMeters?: number;
    nearbyStationCount: number;
    minNearby?: number;
    maxNearby?: number;
    avgNearby?: number;
    idwEstimate?: number;
    confidence: "high" | "medium" | "low" | "unavailable";
    freshnessSummary: string;
  }>>;
  nearestStations: CpcbStationPoint[];
  sourceNote: string;
}

export interface AirQualityMapPoint {
  id: string;
  name?: string;
  provider: AirQualityProvider;
  sourceLabel: string;
  label: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  metrics: Partial<Record<AirQualityMapMetric, number>>;
  units: Partial<Record<AirQualityMapMetric, string>>;
  category?: string;
  dominantPollutant?: string;
  lastUpdate?: string;
  distanceMeters?: number;
  aqi?: number;
  note?: string;
  cpcbStation?: CpcbStationPoint;
  providers?: AirQualityProvider[];
  station?: AirQualityStation;
  availability?: { available: number; supported: number; label: string };
  warnings?: AirQualityWarning[];
  physicalStationId?: string;
  selectedSources?: Partial<Record<IndianAqiPollutant, "cpcb_data_gov" | "openaq" | "fused_measured">>;
  metricDetails?: Partial<Record<AirQualityMapMetric, {
    value: number;
    unit: string;
    provider: AirQualityProvider;
    measuredAt?: string;
    ageHours?: number;
    freshness?: string;
    valueKind?: MeasurementValueKind;
    aggregationPeriod?: AggregationPeriod;
    aggregationPeriodVerified?: boolean;
    currentMapEligible: boolean;
    aqiEligible: boolean;
    warnings: string[];
  }>>;
    aqiQuality?: AirQualityAqiQuality;
    aqiStatus?: AirQualityMapAqi;
    attribution?: string;
    stale?: boolean;
    cachedAt?: string;
}

export interface AirQualityMapResponse {
  generatedAt: string;
  country: string;
  cpcbUsable: boolean;
  cpcbReason: string;
  openAqUsable?: boolean;
  openAqReason?: string;
  points: AirQualityMapPoint[];
  providerCounts?: Partial<Record<AirQualityProvider, number>>;
  warnings?: AirQualityWarning[];
  completeness?: {
    cpcbComplete: boolean;
    openAqMetadataComplete: boolean;
    openAqLatestComplete: boolean;
    nationalMapComplete: boolean;
  };
  metricCoverage?: Partial<Record<AirQualityMapMetric, { eligibleStations: number; totalPhysicalStations: number }>>;
  aqiCoverage?: {
    validatedEligibleStations: number;
    indicativeEligibleStations: number;
    providerReportedEligibleStations: number;
    selectedDisplayStations: number;
    pendingStations: number;
    insufficientHistoryStations: number;
    insufficientPollutantStations: number;
    unavailableStations: number;
    totalPhysicalStations: number;
    processedStations: number;
    queuedStations: number;
    successfulValidatedStations: number;
    failedStations: number;
    snapshotRefreshing: boolean;
    nationalSnapshotRefreshing: boolean;
    snapshotComplete: boolean;
  };
}

export type ForecastHorizon = "1h" | "6h" | "12h" | "24h";

export interface AqiForecastResult {
  provider: "locally_forecast" | "unavailable";
  lat?: number;
  lng?: number;
  nearestStation?: string;
  nearestStationDistanceMeters?: number;
  regionCode?: string;
  latestAvailableTimestamp?: string;
  latestAvailableAqi?: number;
  predictions: Partial<Record<ForecastHorizon, number>>;
  categories: Partial<Record<ForecastHorizon, string>>;
  hourly?: Array<{
    dateTime: string;
    aqi?: number;
    category?: string;
    dominantPollutant?: string;
    pollutants?: Partial<Record<CpcbPollutantCode, { predictedValue?: number; lowerBound?: number; upperBound?: number; unit?: string; confidence?: string }>>;
  }>;
  peakAqi?: number;
  peakTime?: string;
  averageAqi?: number;
  trend: "rising" | "falling" | "stable" | "unknown";
  spikeRisk: "low" | "medium" | "high" | "severe" | "unknown";
  spikeReason: string;
  confidenceNote: string;
  sourceNote: string;
  generatedAt: string;
  reason?: string;
  method?: string;
  confidence?: "high" | "medium" | "low" | "unavailable";
  uncertainty?: { lower?: number; upper?: number };
  warnings?: AirQualityWarning[];
  backtest?: Array<{ pollutant?: CpcbPollutantCode; mae?: number; validationCount: number; coverage: number }>;
}

export type SituationPriority = "critical" | "high" | "moderate" | "low";

export type HotspotRecurrenceClassification =
  | "no_recurring_history"
  | "emerging_hotspot"
  | "recurring_hotspot"
  | "persistent_hotspot";

export interface RecurringHotspotContext {
  isRecurringHotspot: boolean;
  classification: HotspotRecurrenceClassification;
  recurrenceScore: number;
  similarIncidentCount: number;
  verifiedIncidentCount: number;
  activeIncidentCount: number;
  radiusMeters: number;
  windowDays: number;
  earliestIncidentAt?: string;
  latestIncidentAt?: string;
  observedPollutionTypes: PollutionType[];
  explanation: string;
  reasons: string[];
  historicalIncidentIds: string[];
}

export type SensitiveLocationCategory = "school" | "hospital" | "childcare" | "elderly_care";

export interface SensitiveLocation {
  id: string;
  name: string;
  category: SensitiveLocationCategory;
  lat: number;
  lng: number;
  distanceMeters: number;
  impactRadiusMeters: number;
  source: "reference_registry" | "osm_overpass" | "curated_demo";
}

export interface SensitiveLocationImpactContext {
  hasSensitiveLocations: boolean;
  impactScore: number;
  totalCount: number;
  categoryCounts: Record<SensitiveLocationCategory, number>;
  locations: SensitiveLocation[];
  primaryImpactRadiusMeters: number;
  summary: string;
  reasons: string[];
  affectedFacilitiesSummary: string[];
}

export interface ContextualPriorityContext {
  basePriority: string;
  finalPriority: string;
  priorityElevated: boolean;
  elevationReasons: string[];
  explanation: string;
}

export interface PollutionSituation {
  id: string;
  rank: number;
  priority: SituationPriority;
  situationScore: number;

  centerLat: number;
  centerLng: number;
  radiusMeters: number;

  placeLabel: string;
  shortDescription: string;

  reportCount: number;
  activeReportCount: number;
  unresolvedCount: number;

  dominantPollutionType: PollutionType;
  dominantSeverity: Severity;

  latestReportAt: string;
  firstReportAt: string;

  reportIds: string[];
  photoUrls: string[];

  scoreBreakdown: {
    reportVolumeScore: number;
    publicImpactScore: number;
    evidenceScore: number;
    recencyScore: number;
    unresolvedScore: number;
    hotspotScore: number;
    aqiSupportScore: number;
  };

  effects: string[];
  recommendedActions: string[];
  statusSummary: string;

  recurrence?: RecurringHotspotContext;
  sensitiveLocations?: SensitiveLocationImpactContext;
  contextualPriority?: ContextualPriorityContext;
}

export interface PollutionReport {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  status: ReportStatus;
  lat: number;
  lng: number;
  areaText: string;
  media: MediaEvidence[];
  primaryMediaId?: string;
  evidenceStatus: EvidenceStatus;
  authenticityScore: number;
  authenticityFlags: string[];
  evidenceScore: number;
  trustLevel: TrustLevel;
  rejectionReason?: string;
  scoreBreakdown?: EvidenceScoreResult["scoreBreakdown"];
  evidenceReasons: string[];
  locality?: LocalitySummary;
  actionLog: ActionLogEntry[];
  /** Optional on older reports; the UI falls back to the existing action log. */
  statusHistory?: ReportStatusHistoryEntry[];
  imageUrl?: string;
  imageHash: string;
  userDescription: string;
  gemini: GeminiResult;
  airQuality: AirQualitySummary;
  forecast?: AqiForecastResult;
  cpcbContext?: CpcbLocalContext;
  captureEvidence?: CaptureEvidence;
  nearby: { similarReportCount: number; nearbyReportIds: string[] };
  riskAdvisor?: LocalRiskAdvisor;
  hotspotScore: number;
  priority: "watch" | "high" | "severe" | "resolved";
  resolutionProof?: ResolutionProof;
  assignedTo?: string;
  assignedDepartment?: "Sanitation" | "Roads" | "Drainage" | "Traffic" | "Environment" | "Other";
  municipalAssignment?: MunicipalAssignment;
  ngoAssignment?: { ngoName: string; assignedAt: string; status: "Assigned" | "Accepted" | "Cleanup In Progress" | "Cleanup Proof Submitted" | "Completed" };
  cleanupStartedAt?: string;
  cleanupProof?: { afterMedia: MediaEvidence; submittedAt: string; uploaderId: string; submittedBy?: string; locality?: string; lat?: number; lng?: number; gpsAccuracy?: number; actionTaken?: string; note?: string; cleanupPercentage?: number; locationMatch?: boolean; aiConfidence?: number; remainingPollution?: string; summary?: string };
  actionTaken?: string;
  lastAnalyzedAt?: string;
  satelliteEvidence?: SatelliteEvidence;
  resolvedAt?: string;
  reward?: { points: number; transactionId: string; reason: string; awardedAt: string };
  recurrence?: RecurringHotspotContext;
  sensitiveLocations?: SensitiveLocationImpactContext;
  contextualPriority?: ContextualPriorityContext;
}

export interface DraftReport {
  originalBase64: string;
  imageBase64: string;
  imageMimeType: "image/jpeg";
  imageHash: string;
  width: number;
  height: number;
  description?: string;
  lat: number;
  lng: number;
  areaText: string;
  captureEvidence: CaptureEvidence;
  /** Compressed browser blob used only by IndexedDB demo storage. */
  compressedImage?: File;
}
export type ForecastStationItem = any;
export interface ForecastStationsResponse { stations: any[]; count: number; reason?: string; }
export interface StateForecastResponse { generatedAt: string; reason?: string; data: any; states: any[]; }
