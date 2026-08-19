import type { Severity } from "../types";

const classes: Record<Severity, string> = {
  low: "border-civic/40 bg-civic/10 text-civic",
  medium: "border-warning/40 bg-warning/10 text-warning",
  high: "border-orange-400/40 bg-orange-400/10 text-orange-200",
  severe: "border-severe/50 bg-severe/10 text-severe"
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${classes[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}
