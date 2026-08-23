import { Check, Clock3 } from "lucide-react";
import type { PollutionReport, ReportStatusHistoryEntry } from "../types";

const STAGES = [
  ["submitted", "Report Submitted", "Your pollution report, photo and location have been received."],
  ["cleanup_in_progress", "Cleanup In Progress", "The report has been verified and assigned to the municipal field team for action."],
  ["cleanup_proof_submitted", "Cleanup Proof Submitted", "The municipal team has completed the work and uploaded the after-cleanup proof."],
  ["resolved", "Resolved", "The cleanup proof has been approved and the report has been closed."]
] as const;

type StageKey = (typeof STAGES)[number][0];

const stageIndex = (key: StageKey) => STAGES.findIndex(([value]) => value === key);
const formatTime = (value?: string) => value ? new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
function normalize(value?: string) { return String(value || "").trim().toLowerCase().replace(/[ -]+/g, "_"); }

function citizenStageForStatus(status?: string): StageKey | null {
  const value = normalize(status);
  if (["resolved", "closed"].includes(value)) return "resolved";
  if (["cleanup_proof_submitted", "resolution_submitted", "proof_under_review", "officer_review"].includes(value)) return "cleanup_proof_submitted";
  if (["verified", "accepted", "acknowledged", "reviewed", "assigned", "in_progress", "cleanup_in_progress", "new_proof_requested", "reopened"].includes(value)) return "cleanup_in_progress";
  if (["submitted", "new", "pending_verification"].includes(value)) return "submitted";
  return null;
}

export function getCitizenProgressStage(report: PollutionReport) {
  const status = normalize(report.status);
  const decision = (report.actionLog || []).map((entry) => normalize(entry.note)).join(" ");
  if (status === "resolved" || status === "closed" || report.resolvedAt) return "resolved" as StageKey;
  if (status === "reopened" || status === "new_proof_requested" || decision.includes("reopened") || decision.includes("new_proof")) return "cleanup_in_progress" as StageKey;
  if (["cleanup_proof_submitted", "resolution_submitted", "proof_under_review", "officer_review"].some((value) => status.includes(value)) || report.cleanupProof) return "cleanup_proof_submitted" as StageKey;
  if (["verified", "accepted", "acknowledged", "reviewed", "assigned", "in_progress", "cleanup_in_progress"].includes(status) || normalize(report.municipalAssignment?.status || report.ngoAssignment?.status) === "cleanup_in_progress" || report.assignedDepartment || report.municipalAssignment || report.ngoAssignment || report.evidenceStatus === "verified") return "cleanup_in_progress" as StageKey;
  return "submitted" as StageKey;
}

function timelineEntries(report: PollutionReport): Partial<Record<StageKey, ReportStatusHistoryEntry>> {
  const entries: Partial<Record<StageKey, ReportStatusHistoryEntry>> = {};
  for (const entry of report.statusHistory || []) {
    const key = citizenStageForStatus(entry.status);
    if (key) entries[key] = entry;
  }
  const action = (type: string, key: StageKey, label: string, fallback?: string) => {
    const match = (report.actionLog || []).find((item) => item.type === type);
    if (match && !entries[key]) entries[key] = { status: key, label, timestamp: match.at, message: match.note };
    if (fallback && !entries[key]) entries[key] = { status: key, label, timestamp: fallback };
  };
  action("report_created", "submitted", "Report Submitted", report.createdAt);
  action("gemini_verified", "cleanup_in_progress", "Cleanup In Progress");
  action("evidence_scored", "cleanup_in_progress", "Cleanup In Progress", report.evidenceStatus === "verified" ? report.updatedAt : undefined);
  action("assigned", "cleanup_in_progress", "Cleanup In Progress", report.municipalAssignment?.assignedAt || report.ngoAssignment?.assignedAt);
  action("ngo_progress_updated", "cleanup_in_progress", "Cleanup In Progress");
  action("ngo_cleanup_proof_submitted", "cleanup_proof_submitted", "Cleanup Proof Submitted", report.cleanupProof?.submittedAt);
  action("resolved", "resolved", "Resolved", report.resolvedAt);
  return entries;
}

export function CitizenProgressSummary({ report }: { report: PollutionReport }) {
  const current = stageIndex(getCitizenProgressStage(report)) + 1;
  const key = getCitizenProgressStage(report);
  const label = STAGES.find(([stage]) => stage === key)?.[1] ?? "Report Submitted";
  return <span>{key === "resolved" ? "4 of 4 — Resolved." : `Current stage: ${current} of ${STAGES.length} - ${label}`}</span>;
}

export function CitizenProgressTracker({ report }: { report: PollutionReport }) {
  const currentKey = getCitizenProgressStage(report);
  const current = stageIndex(currentKey);
  const entries = timelineEntries(report);
  const newProofRequested = normalize(report.status) === "reopened" || normalize(report.status) === "new_proof_requested" || (report.actionLog || []).some((entry) => normalize(entry.note).includes("reopened"));
  const department = report.assignedDepartment || report.municipalAssignment?.teamName || report.ngoAssignment?.ngoName;

  return <section className="mt-5 rounded-2xl border border-white/10 bg-white/[.02] p-4" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="section-eyebrow">Report progress</p><p className="text-sm text-slate-400"><CitizenProgressSummary report={report} /></p></div>{department && <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">{department}</span>}</div>
    {newProofRequested && <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">The municipal team has been asked to provide an updated cleanup proof.</p>}
    <ol className="mt-4 grid gap-3 md:grid-cols-4 md:gap-2" aria-label="Report progress">
      {STAGES.map(([key, label, description], index) => {
        const entry = entries[key]; const complete = index < current || currentKey === "resolved"; const active = index === current && currentKey !== "resolved";
        return <li key={key} aria-current={active ? "step" : undefined} className="relative min-w-0 md:after:absolute md:after:left-[calc(50%+18px)] md:after:top-4 md:after:h-px md:after:w-[calc(100%-36px)] md:after:bg-white/10 md:last:after:hidden">
          <div className={`relative z-10 flex gap-3 md:block ${active ? "text-emerald-200" : complete ? "text-emerald-300" : "text-slate-500"}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${active ? "border-emerald-300 bg-emerald-400/20" : complete ? "border-emerald-400 bg-emerald-400/15" : "border-white/15 bg-white/[.03]"}`}>{complete ? <Check size={15} aria-hidden="true" /> : index + 1}</span><div><p className="text-xs font-semibold leading-tight">{`${index + 1}. ${label}${complete ? " - Completed" : active ? " - Current" : " - Pending"}`}</p><p className="mt-1 text-[11px] leading-snug text-slate-500">{description}</p>{entry && <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><Clock3 size={10} aria-hidden="true" />{formatTime(entry.timestamp)}</p>}</div></div>
        </li>;
      })}
    </ol>
  </section>;
}
