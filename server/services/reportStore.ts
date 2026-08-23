import type { PollutionReport, ReportStatus } from "../types.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  findFirestoreReport,
  firestoreEnabled,
  listFirestoreReports,
  saveReportToFirestore,
  updateFirestoreReport
} from "./firestoreReportStore.js";

// Log storage mode at startup
const storageMode = firestoreEnabled() ? "Firestore (production)" : "in-memory (local dev — resets on restart)";
console.info(`[ReportStore] Using ${storageMode}`);

const defaultGemini = {
  is_pollution_related: true,
  pollution_visible: false,
  image_quality: "usable" as const,
  image_quality_score: 50,
  pollution_type: "unclear" as const,
  confidence: 50,
  severity: "medium" as const,
  evidence_strength: 35,
  visible_evidence: ["submitted report"],
  rejection_reason: undefined,
  possible_pollutants: ["PM2.5", "PM10"],
  public_summary: "The report is queued for analysis.",
  municipal_action: "Verify manually if AI analysis is unavailable.",
  needs_manual_review: true,
  trust_decision: "needs_review" as const,
  safety_note: "Do not go near fire or heavy smoke."
};

const defaultAir = {
  provider: "unavailable" as const,
  category: "AQI unavailable, pollutant readings pending",
  pollutants: {},
  rawSummary: "Air quality will be attached after provider lookup."
};

const reports = new Map<string, PollutionReport>();

function localDemoMode() {
  const serverless = process.env.NODE_ENV === "production" || Boolean(process.env.NETLIFY) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  return !serverless && (process.env.LOCAL_DEMO_MODE === "true" || process.env.NODE_ENV === "development");
}

function localReportFile() {
  return path.join(process.cwd(), "storage", "reports.json");
}

async function readLocalReports(): Promise<PollutionReport[]> {
  try {
    return JSON.parse(await readFile(localReportFile(), "utf8")) as PollutionReport[];
  } catch {
    return [];
  }
}

async function writeLocalReports(next: PollutionReport[]) {
  await mkdir(path.dirname(localReportFile()), { recursive: true });
  await writeFile(localReportFile(), JSON.stringify(next, null, 2), "utf8");
}
function sortedMemoryReports(): PollutionReport[] {
  return Array.from(reports.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function mergeReports(primary: PollutionReport[], fallback: PollutionReport[]): PollutionReport[] {
  const merged = new Map<string, PollutionReport>();

  for (const report of fallback) {
    merged.set(report.id, report);
  }

  for (const report of primary) {
    merged.set(report.id, report);
  }

  return Array.from(merged.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function listReports(): Promise<PollutionReport[]> {
  const memoryReports = sortedMemoryReports();

  if (localDemoMode()) return mergeReports(await readLocalReports(), memoryReports);

  if (firestoreEnabled()) {
    const firestoreReports = await listFirestoreReports();

    if (firestoreReports !== null) {
      return mergeReports(firestoreReports, memoryReports);
    }

    console.warn("[ReportStore] Firestore listReports failed, falling back to in-memory store.");
  }

  return memoryReports;
}

export async function findReport(id: string): Promise<PollutionReport | undefined> {
  if (localDemoMode()) {
    return (await readLocalReports()).find((report) => report.id === id) || reports.get(id);
  }

  if (firestoreEnabled()) {
    const firestoreReport = await findFirestoreReport(id);
    if (firestoreReport) return firestoreReport;
  }

  return reports.get(id);
}

export async function listReportsByUser(userId: string): Promise<PollutionReport[]> {
  const all = await listReports();
  return all.filter((r) => r.userId === userId);
}

export async function createReport(input: {
  id?: string;
  lat: number;
  lng: number;
  areaText: string;
  imageHash: string;
  imageUrl?: string;
  media?: PollutionReport["media"];
  primaryMediaId?: string;
  evidenceStatus?: PollutionReport["evidenceStatus"];
  authenticityScore?: number;
  authenticityFlags?: string[];
  evidenceScore?: number;
  trustLevel?: PollutionReport["trustLevel"];
  rejectionReason?: string;
  scoreBreakdown?: PollutionReport["scoreBreakdown"];
  evidenceReasons?: string[];
  locality?: PollutionReport["locality"];
  userDescription: string;
  userId: string;
  gemini?: PollutionReport["gemini"];
  airQuality?: PollutionReport["airQuality"];
  forecast?: PollutionReport["forecast"];
  cpcbContext?: PollutionReport["cpcbContext"];
  captureEvidence?: PollutionReport["captureEvidence"];
}): Promise<PollutionReport> {
  const id = input.id || `CLS-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now()
    .toString()
    .slice(-4)}`;
  const now = new Date().toISOString();
  const report: PollutionReport = {
    id,
    createdAt: now,
    updatedAt: now,
    userId: input.userId,
    status: input.gemini ? "Submitted" : "Analyzing",
    lat: input.lat,
    lng: input.lng,
    areaText: input.areaText,
    media: input.media || [],
    primaryMediaId: input.primaryMediaId,
    evidenceStatus: input.evidenceStatus || "stored",
    authenticityScore: input.authenticityScore ?? 0,
    authenticityFlags: input.authenticityFlags || [],
    evidenceScore: input.evidenceScore ?? 0,
    trustLevel: input.trustLevel || "Needs Review",
    rejectionReason: input.rejectionReason,
    scoreBreakdown: input.scoreBreakdown,
    evidenceReasons: input.evidenceReasons || [],
    locality: input.locality,
    actionLog: [
      { type: "report_created", at: now },
      ...(input.media?.length ? [{ type: "media_uploaded" as const, at: now }] : []),
      ...(input.gemini ? [{ type: "gemini_verified" as const, at: now }] : []),
      ...(input.evidenceScore !== undefined ? [{ type: "evidence_scored" as const, at: now }] : [])
    ],
    imageUrl: input.imageUrl,
    imageHash: input.imageHash,
    userDescription: input.userDescription,
    gemini: input.gemini || defaultGemini,
    airQuality: input.airQuality || defaultAir,
    forecast: input.forecast,
    cpcbContext: input.cpcbContext,
    captureEvidence: input.captureEvidence,
    nearby: { similarReportCount: 0, nearbyReportIds: [] },
    hotspotScore: 0,
    priority: "watch"
  };
  if (localDemoMode()) {
    const stored = await readLocalReports();
    await writeLocalReports([...stored.filter((item) => item.id !== report.id), report]);
    reports.set(report.id, report);
  } else if (firestoreEnabled()) {
    const result = await saveReportToFirestore(report);
    if (!result.persisted) {
      console.warn(`[ReportStore] Firestore save failed for ${id}: ${result.reason}. Falling back to in-memory store.`);
      reports.set(id, report);
    }
  } else {
    reports.set(id, report);
  }
  return report;
}

export async function updateReport(id: string, patch: Partial<PollutionReport>): Promise<PollutionReport | undefined> {
  if (localDemoMode()) {
    const stored = await readLocalReports();
    const existing = stored.find((report) => report.id === id) || reports.get(id);
    if (!existing) return undefined;
    const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    await writeLocalReports([...stored.filter((report) => report.id !== id), next]);
    reports.set(id, next);
    return next;
  }

    const firestoreResult = await updateFirestoreReport(id, patch);
  if (firestoreEnabled()) {
    if (firestoreResult) return firestoreResult;
    console.warn(`[ReportStore] Firestore update failed or report missing for ${id}; trying in-memory fallback.`);
  }

  const existing = reports.get(id);
  if (!existing) {
    console.warn(`[ReportStore] updateReport could not find report ${id}.`);
    return undefined;
  }

  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  reports.set(id, next);
  return next;
}

export async function updateStatus(id: string, status: ReportStatus): Promise<PollutionReport | undefined> {
  const existing = await findReport(id);
  const now = new Date().toISOString();
  const patch: Partial<PollutionReport> = {
    status,
    priority: status === "Resolved" ? "resolved" : undefined,
    resolvedAt: status === "Resolved" ? now : undefined,
    actionLog: [
      ...(existing?.actionLog || []),
      { type: status === "Resolved" ? "resolved" : "status_changed", at: now, note: status }
    ]
  };
  return updateReport(id, patch);
}
