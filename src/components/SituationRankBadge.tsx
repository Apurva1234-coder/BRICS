import type { SituationPriority } from "../types";

interface SituationRankBadgeProps {
  rank: number;
  priority: SituationPriority;
  size?: "sm" | "md" | "lg";
}

const PRIORITY_CLASS: Record<SituationPriority, string> = {
  critical: "situation-rank-badge situation-priority-critical",
  high: "situation-rank-badge situation-priority-high",
  moderate: "situation-rank-badge situation-priority-moderate",
  low: "situation-rank-badge situation-priority-low"
};

const PRIORITY_LABEL: Record<SituationPriority, string> = {
  critical: "Critical",
  high: "High",
  moderate: "Moderate",
  low: "Low"
};

export function SituationRankBadge({ rank, priority, size = "md" }: SituationRankBadgeProps) {
  const sizeClass = size === "lg" ? "text-lg px-4 py-2" : size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";
  return (
    <span className={`${PRIORITY_CLASS[priority]} ${sizeClass} inline-flex items-center gap-1.5 font-bold rounded-full`}>
      <span className="opacity-70">#{rank}</span>
      <span>{PRIORITY_LABEL[priority]}</span>
    </span>
  );
}
