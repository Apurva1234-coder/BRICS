import type {
  AirQualitySummary,
  CaptureEvidence,
  ContextualPriorityContext,
  EvidenceScoreResult,
  PollutionType,
  RecurringHotspotContext,
  ReportStatusHistoryEntry,
  ResolutionProof,
  SatelliteEvidence,
  SensitiveLocationImpactContext,
  Severity,
  TrustLevel
} from "../types.js";

export type CitizenFacingStatus =
  | "Submitted"
  | "In Progress"
  | "Cleanup Proof Submitted"
  | "Resolved";

export type MunicipalWorkflowStage =
  | "Assigned"
  | "Cleanup In Progress"
  | "Cleanup Proof Submitted"
  | "Completed";

export interface SafeReportMediaDto {
  type: "photo" | "video";
  url: string;
}

export interface CitizenStatusHistoryDto {
  status: CitizenFacingStatus;
  label: CitizenFacingStatus;
  timestamp: string;
}

export interface MunicipalHistoryDto {
  status: MunicipalWorkflowStage;
  timestamp: string;
}

export interface CleanupProofDto {
  submittedAt: string;
  afterEvidence?: SafeReportMediaDto;
  locality?: string;
  lat?: number;
  lng?: number;
  gpsAccuracyMeters?: number;
  actionTaken?: string;
  note?: string;
  cleanupPercentage?: number;
  locationMatch?: boolean;
  remainingPollution?: string;
  summary?: string;
}

export interface CitizenCleanupProofDto {
  submittedAt: string;
  afterEvidence?: SafeReportMediaDto;
  actionTaken?: string;
  summary?: string;
}

export interface CitizenResolutionDto {
  resolvedAt: string;
  actionTaken: string;
  afterEvidence?: SafeReportMediaDto;
}

export interface MunicipalAssignmentDto {
  teamName: string;
  assignedAt: string;
  status: MunicipalWorkflowStage;
}

export interface PublicReportDto {
  id: string;
  approximateLat: number;
  approximateLng: number;
  approximateLocality?: string;
  pollutionType: PollutionType;
  severity: Severity;
  priority: "watch" | "high" | "severe" | "resolved";
  status: CitizenFacingStatus;
  createdAt: string;
  thumbnailUrl?: string;
  hotspotScore?: number;
  nearbyReportCount?: number;
}

export interface CitizenReportDto {
  id: string;
  createdAt: string;
  updatedAt: string;
  lat: number;
  lng: number;
  areaText: string;
  gpsAccuracyMeters?: number;
  pollutionType: PollutionType;
  severity: Severity;
  priority: "watch" | "high" | "severe" | "resolved";
  status: CitizenFacingStatus;
  publicSummary: string;
  evidenceScore: number;
  evidence?: SafeReportMediaDto;
  statusHistory: CitizenStatusHistoryDto[];
  municipalAssignment?: MunicipalAssignmentDto;
  cleanupProof?: CitizenCleanupProofDto;
  resolution?: CitizenResolutionDto;
}

export interface MunicipalReportDto {
  id: string;
  createdAt: string;
  updatedAt: string;
  lat: number;
  lng: number;
  gpsAccuracyMeters?: number;
  areaText: string;
  pollutionType: PollutionType;
  severity: Severity;
  priority: "watch" | "high" | "severe" | "resolved";
  hotspotScore: number;
  workflowStage: MunicipalWorkflowStage;
  beforeEvidence?: SafeReportMediaDto;
  userDescription: string;
  assignment?: MunicipalAssignmentDto;
  municipalHistory: MunicipalHistoryDto[];
  cleanupProof?: CleanupProofDto;
  actionTaken?: string;
}

export interface OfficerMediaDto extends SafeReportMediaDto {
  capturedAt?: string;
  width?: number;
  height?: number;
}

export interface OfficerVerificationSummaryDto {
  evidenceStatus: "stored" | "verified" | "needs_review" | "rejected";
  evidenceScore: number;
  trustLevel: TrustLevel;
  authenticityScore: number;
  authenticityFlags: string[];
  scoreBreakdown?: EvidenceScoreResult["scoreBreakdown"];
  evidenceReasons: string[];
  publicSummary: string;
  municipalAction: string;
  visibleEvidence: string[];
  pollutionVisible: boolean;
  imageQuality: "clear" | "usable" | "poor" | "unusable";
  confidence: number;
  needsManualReview: boolean;
  rejectionReason?: string;
}

export interface OfficerActionLogDto {
  type: string;
  at: string;
  note?: string;
}

export interface OfficerStatusHistoryDto {
  status: string;
  label: string;
  timestamp: string;
  updatedByRole?: "citizen" | "system" | "officer" | "municipal";
  message?: string;
}

export interface OfficerResolutionDto {
  beforeMediaId?: string;
  actionTaken: string;
  resolvedBy?: string;
  resolvedAt: string;
  notes?: string;
  afterEvidence?: OfficerMediaDto;
}

export interface OfficerAirQualityDto {
  provider: AirQualitySummary["provider"];
  aqi?: number;
  category?: string;
  dominantPollutant?: string;
  nearestStation?: string;
  nearestStationDistanceMeters?: number;
  lastUpdate?: string;
  status?: "available" | "unavailable";
  warnings?: string[];
}

export interface OfficerSatelliteEvidenceDto {
  status: SatelliteEvidence["status"];
  checkedAt?: string;
  requestedAt?: string;
  completedAt?: string;
  assessment: {
    result: SatelliteEvidence["assessment"]["result"];
    confidence: number;
    explanation: string;
    limitations: string[];
  };
  observability: {
    status: SatelliteEvidence["observability"]["status"];
    score: number;
    reasons: string[];
  };
  evidenceContributionPoints: number;
  decisionEffect: SatelliteEvidence["decisionEffect"];
  warnings: string[];
  explanation: string;
  limitations: string[];
}

export interface OfficerReportDto {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  lat: number;
  lng: number;
  areaText: string;
  userDescription: string;
  pollutionType: PollutionType;
  severity: Severity;
  priority: "watch" | "high" | "severe" | "resolved";
  hotspotScore: number;
  nearby: {
    similarReportCount: number;
    reportIds: string[];
  };
  media: OfficerMediaDto[];
  captureEvidence?: CaptureEvidence;
  verification: OfficerVerificationSummaryDto;
  airQuality: OfficerAirQualityDto;
  satelliteEvidence?: OfficerSatelliteEvidenceDto;
  assignment?: MunicipalAssignmentDto;
  municipalHistory: MunicipalHistoryDto[];
  cleanupProof?: CleanupProofDto;
  actionLog: OfficerActionLogDto[];
  statusHistory: OfficerStatusHistoryDto[];
  resolution?: OfficerResolutionDto;
  internalReviewRecommendation?: string;
  recurrence?: RecurringHotspotContext;
  sensitiveLocations?: SensitiveLocationImpactContext;
  contextualPriority?: ContextualPriorityContext;
}
