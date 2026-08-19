import type { DraftReport, GeminiResult, PollutionReport, ReportStatus } from "../types";
import { isDemoBrowserStorage } from "./env";
import { apiClient } from "./apiClient";
import { getDemoReport, listDemoReports, saveDemoImage, saveDemoReport } from "./demoBrowserStorage";
import { compressImage, fileToBase64, sha256File } from "../utils/image";

const localDemoGemini: GeminiResult = {
  is_pollution_related: true, pollution_visible: true, image_quality: "usable", image_quality_score: 60,
  pollution_type: "open_waste", confidence: 55, severity: "medium", evidence_strength: 55,
  visible_evidence: ["Captured civic evidence"], possible_pollutants: ["Particulate matter"],
  public_summary: "Local demo report saved in this browser. Server analysis was unavailable.",
  municipal_action: "Inspect and clean the reported location.", needs_manual_review: true,
  trust_decision: "needs_review", safety_note: "Avoid direct contact with the reported pollution source."
};

function now() { return new Date().toISOString(); }

async function localReport(draft: DraftReport): Promise<PollutionReport> {
  if (!draft.compressedImage) throw new Error("This browser could not save the evidence. Please allow site storage and try again.");
  const media = await saveDemoImage(draft.compressedImage, "before", { hash: draft.imageHash, width: draft.width, height: draft.height, capturedAt: draft.captureEvidence.photoCapturedAt, mimeType: draft.imageMimeType });
  let gemini = localDemoGemini;
  let status: ReportStatus = "Manual review needed";
  let trustLevel: PollutionReport["trustLevel"] = "Needs Review";
  let evidenceStatus: PollutionReport["evidenceStatus"] = "needs_review";
  try {
    const analysis = await apiClient.analyzeDemoEvidence({ imageBase64: draft.imageBase64, imageMimeType: draft.imageMimeType, context: draft.description });
    gemini = analysis.gemini;
    status = analysis.decision.status;
    trustLevel = analysis.decision.trustLevel;
    evidenceStatus = analysis.decision.evidenceStatus;
  } catch {
    // A Netlify demo must remain usable without the analysis service.
  }
  const createdAt = now();
  return saveDemoReport({
    id: `browser-demo-${crypto.randomUUID()}`,
    createdAt, updatedAt: createdAt, userId: localStorage.getItem("cleanair-user") || "anonymous",
    status, lat: draft.lat, lng: draft.lng, areaText: draft.areaText, media: [media], primaryMediaId: media.mediaId,
    evidenceStatus, authenticityScore: 60, authenticityFlags: ["browser_demo_storage"], evidenceScore: 60,
    trustLevel, evidenceReasons: ["Evidence is stored locally in this browser for the demonstration."],
    imageHash: draft.imageHash, userDescription: draft.description || "", gemini,
    airQuality: { provider: "unavailable", status: "unavailable", pollutants: {}, readings: {}, warnings: [], rawSummary: "AQI context is not required for local demo storage.", sourceNote: "Local browser demo." },
    captureEvidence: draft.captureEvidence, nearby: { similarReportCount: 0, nearbyReportIds: [] }, hotspotScore: 30,
    priority: gemini.severity === "severe" ? "severe" : gemini.severity === "high" ? "high" : "watch",
    actionLog: [{ type: "report_created", at: createdAt, note: "Local browser demo report created." }, { type: "media_uploaded", at: createdAt, note: "Evidence stored in IndexedDB." }],
    statusHistory: [{ status, label: status, timestamp: createdAt, updatedByRole: "citizen", message: "Saved in this browser for the demonstration." }]
  });
}

async function patchDemo(
  id: string,
  patch: Partial<PollutionReport>,
  note: string,
  role: "citizen" | "municipal" | "officer" = "officer",
  history?: { status: string; label: string }
) {
  const report = await getDemoReport(id);
  if (!report) return null;
  const timestamp = now();
  return saveDemoReport({
    ...report,
    ...patch,
    updatedAt: timestamp,
    actionLog: [...(report.actionLog || []), { type: history?.status === "assigned" ? "assigned" : history?.status === "resolved" ? "resolved" : "status_changed", at: timestamp, note }],
    statusHistory: [...(report.statusHistory || []), { status: history?.status || patch.status || report.status, label: history?.label || patch.status || report.status, timestamp, updatedByRole: role, message: note }]
  });
}

export async function listReports(): Promise<PollutionReport[]> {
  return isDemoBrowserStorage ? listDemoReports() : apiClient.getReports();
}

export async function submitReport(draft: DraftReport): Promise<PollutionReport> {
  if (isDemoBrowserStorage) return localReport(draft);
  return apiClient.createReport({ lat: draft.lat, lng: draft.lng, areaText: draft.areaText, originalBase64: draft.originalBase64, imageHash: draft.imageHash, imageBase64: draft.imageBase64, imageMimeType: draft.imageMimeType, fileModifiedAt: draft.captureEvidence.photoCapturedAt, capturedAt: draft.captureEvidence.photoCapturedAt, photoCapturedAt: draft.captureEvidence.photoCapturedAt, captureMethod: draft.captureEvidence.captureMethod, cameraFacingMode: draft.captureEvidence.cameraFacingMode, captureLocation: draft.captureEvidence.captureLocation, width: draft.width, height: draft.height, exifAvailable: false, userDescription: draft.description, userId: localStorage.getItem("cleanair-user") || "anonymous" });
}

export async function updateReportStatus(id: string, status: ReportStatus): Promise<PollutionReport | null> {
  return isDemoBrowserStorage ? patchDemo(id, { status }, `Officer changed status to ${status}.`) : apiClient.updateStatus(id, status);
}

export async function updateReportAction(id: string, payload: unknown): Promise<PollutionReport | null> {
  if (!isDemoBrowserStorage) return apiClient.updateAction(id, payload);
  const value = (payload || {}) as Record<string, unknown>;
  const status = typeof value.status === "string" ? value.status as ReportStatus : undefined;
  const department = typeof value.assignedDepartment === "string" ? value.assignedDepartment as PollutionReport["assignedDepartment"] : undefined;
  if (department === "Sanitation") return assignDemoMunicipalReport(id);
  return patchDemo(id, { ...(status ? { status } : {}) }, typeof value.notes === "string" ? value.notes : "Officer updated the demo workflow.");
}

export async function assignDemoMunicipalReport(id: string): Promise<PollutionReport | null> {
  if (!isDemoBrowserStorage) return apiClient.updateAction(id, { status: "Assigned", assignedTo: "Demo Municipal Team", assignedDepartment: "Sanitation" });
  const assignedAt = now();
  return patchDemo(id, {
    status: "Assigned",
    assignedTo: "Demo Municipal Team",
    assignedDepartment: "Sanitation",
    municipalAssignment: { teamId: "demo-municipal-team", teamName: "Demo Municipal Team", department: "Sanitation", status: "Assigned", assignedAt },
    ngoAssignment: { ngoName: "Demo Municipal Team", assignedAt, status: "Assigned" }
  }, "Assigned to Municipal.", "officer", { status: "assigned", label: "Assigned to Municipal" });
}

export async function updateMunicipalProgress(id: string, status: "Accepted" | "Cleanup In Progress"): Promise<PollutionReport | null> {
  if (!isDemoBrowserStorage) return apiClient.updateMunicipalProgress(id, { status, ngoName: "Demo Municipal Team", municipalTeamId: "Demo Municipal Team", assignedDepartment: "Sanitation" });
  const report = await getDemoReport(id);
  if (!report) return null;
  const assignedAt = report.municipalAssignment?.assignedAt || report.ngoAssignment?.assignedAt || now();
  const patch: Partial<PollutionReport> = {
    ...(status === "Cleanup In Progress" ? { status, cleanupStartedAt: now() } : { status: "Assigned" }),
    municipalAssignment: { teamId: "demo-municipal-team", teamName: "Demo Municipal Team", department: "Sanitation", status, assignedAt },
    ngoAssignment: { ngoName: "Demo Municipal Team", assignedAt, status }
  };
  return patchDemo(id, patch, status === "Accepted" ? "Municipal team accepted the task." : "Municipal cleanup started.", "municipal", {
    status: status === "Accepted" ? "accepted" : "cleanup_in_progress",
    label: status === "Accepted" ? "Accepted by Municipal" : "Cleanup In Progress"
  });
}

export async function submitCleanupProof(id: string, file: File, input: { actionTaken: string; note?: string; locality?: string; lat?: number; lng?: number; gpsAccuracy?: number }) {
  if (!isDemoBrowserStorage) {
    // The backend caps stored evidence at 2.5 MB. Screenshots are often PNGs
    // much larger than that, so normalize municipal proof before uploading.
    const uploadFile = await compressImage(file, 1024, 0.68);
    const afterImageBase64 = await fileToBase64(uploadFile);
    return apiClient.submitNgoCleanupProof(id, {
      afterImageBase64,
      imageMimeType: uploadFile.type || "image/jpeg",
      uploaderId: "Demo Municipal Team",
      locality: input.locality,
      lat: input.lat,
      lng: input.lng,
      gpsAccuracy: input.gpsAccuracy,
      actionTaken: input.actionTaken,
      note: input.note
    });
  }
  const imageHash = await sha256File(file);
  const media = await saveDemoImage(file, "after", { hash: imageHash, capturedAt: now(), mimeType: file.type });
  const timestamp = now();
  const report = await getDemoReport(id);
  if (!report) return null;
  const assignedAt = report.municipalAssignment?.assignedAt || report.ngoAssignment?.assignedAt || timestamp;
  return patchDemo(id, {
    status: "Cleanup Proof Submitted",
    municipalAssignment: { teamId: "demo-municipal-team", teamName: "Demo Municipal Team", department: "Sanitation", status: "Cleanup Proof Submitted", assignedAt },
    ngoAssignment: { ngoName: "Demo Municipal Team", assignedAt, status: "Cleanup Proof Submitted" },
    cleanupProof: { afterMedia: media, submittedAt: timestamp, uploaderId: "Demo Municipal Team", submittedBy: "Demo Municipal Team", locality: input.locality, lat: input.lat, lng: input.lng, gpsAccuracy: input.gpsAccuracy, actionTaken: input.actionTaken, note: input.note, cleanupPercentage: 100, locationMatch: true, aiConfidence: 0.8, remainingPollution: "No material pollution visible in demo proof.", summary: "Cleanup proof saved locally in this browser and awaiting Officer approval." }
  }, "Cleanup Proof Submitted.", "municipal", { status: "cleanup_proof_submitted", label: "Cleanup Proof Submitted" });
}

export async function approveResolvedReport(id: string): Promise<PollutionReport | null> {
  if (!isDemoBrowserStorage) return apiClient.updateResolutionStatus(id, "Resolved");
  const report = await getDemoReport(id);
  if (!report?.cleanupProof) return null;
  const timestamp = now();
  const assignedAt = report.municipalAssignment?.assignedAt || report.ngoAssignment?.assignedAt || timestamp;
  return patchDemo(id, {
    status: "Resolved",
    resolvedAt: timestamp,
    priority: "resolved",
    municipalAssignment: { teamId: "demo-municipal-team", teamName: "Demo Municipal Team", department: "Sanitation", status: "Resolved", assignedAt },
    resolutionProof: { beforeMediaId: report.primaryMediaId, afterMedia: report.cleanupProof.afterMedia, actionTaken: report.cleanupProof.actionTaken || "Cleanup proof approved.", resolvedBy: "Demo Officer", resolvedAt: timestamp, notes: report.cleanupProof.note }
  }, "Cleanup proof approved by Officer.", "officer", { status: "resolved", label: "Resolved" });
}

export async function resolveReportWithProof(id: string, payload: unknown): Promise<PollutionReport | null> {
  return isDemoBrowserStorage ? approveResolvedReport(id) : apiClient.resolveReport(id, payload);
}
