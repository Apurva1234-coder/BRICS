import type { SatelliteEvidence } from "../types";

const PROVIDER_ERROR_PATTERN = /\b(401|403|unauthorized|invalid[_ -]?client|credential|token|stack|payload|oauth|secret)\b/i;

export function sanitizeSatelliteFailureReason(reason: string | undefined): string {
  if (!reason || PROVIDER_ERROR_PATTERN.test(reason)) return "Satellite service temporarily unavailable.";
  return "Satellite context is temporarily unavailable for this report.";
}

export function toPublicSatelliteStatus(evidence: SatelliteEvidence | null | undefined): string {
  if (!evidence) return "Satellite context unavailable.";
  if (evidence.status === "pending" || evidence.status === "processing") return "Satellite context pending.";
  if (evidence.status === "unavailable" || evidence.status === "failed") return sanitizeSatelliteFailureReason(evidence.error?.message || evidence.explanation);
  if (evidence.observability.status === "cloud_obscured" || evidence.observability.status === "insufficient_valid_pixels") return "Satellite scene not observable.";
  if (evidence.status === "ready") return evidence.evidenceContributionPoints > 0 ? "Satellite context available." : "Satellite context available with no supporting signal.";
  return "Satellite context unavailable.";
}
