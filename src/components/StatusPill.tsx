import type { ReportStatus } from "../types";

const STATUS_CLASS: Partial<Record<ReportStatus, string>> = {
  "Resolved":              "status-pill status-resolved",
  "In Progress":           "status-pill status-in-progress",
  "Assigned":              "status-pill status-in-progress",
  "False Report":          "status-pill status-rejected",
  "Rejected":              "status-pill status-rejected",
  "Manual review needed":  "status-pill status-review",
  "Submitted":             "status-pill status-submitted",
  "New":                   "status-pill status-submitted",
};

export function StatusPill({ status }: { status: ReportStatus }) {
  const cls = STATUS_CLASS[status] ?? "status-pill status-default";
  return <span className={cls}>{status}</span>;
}
