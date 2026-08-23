import type { PollutionSituation } from "../types";
import { PhotoEvidence } from "./PhotoEvidence";
import { Clock } from "lucide-react";
import { resolveMediaUrl } from "../utils/mediaUrl";

interface SituationListItemProps {
  situation: PollutionSituation;
  pm25?: number;
  isSelected?: boolean;
  onClick?: () => void;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "var(--critical)",
  high:     "var(--high)",
  moderate: "var(--moderate)",
  low:      "var(--low)",
};

const PRIORITY_LABEL: Record<string, string> = {
  critical: "Critical",
  high:     "High",
  moderate: "Moderate",
  low:      "Low",
};

export function SituationListItem({ situation, pm25, isSelected = false, onClick }: SituationListItemProps) {
  const color = PRIORITY_COLOR[situation.priority] ?? PRIORITY_COLOR.low;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`situation-row w-full min-h-11 text-left ${isSelected ? "situation-row-selected" : ""}`}
    >
      {/* Rank — large and dominant */}
      <div className="flex flex-col items-center justify-center shrink-0" style={{ minWidth: "40px" }}>
        <span className="text-[22px] font-black leading-none" style={{ color }}>
          #{situation.rank}
        </span>
      </div>

      {/* Thumbnail */}
      <div className="shrink-0">
        <div className="relative h-16 w-16">
          <div className="overflow-hidden rounded-xl w-full h-full">
            <PhotoEvidence
              src={resolveMediaUrl(situation.photoUrls[0])}
              alt={situation.placeLabel}
              variant="thumb"
              className="w-full h-full object-cover"
              thumbSize={64}
            />
          </div>
          {situation.photoUrls[1] && (
            <div className="absolute -right-1.5 -bottom-1.5 h-8 w-8 rounded-lg overflow-hidden border-2" style={{ borderColor: "var(--surface)" }}>
              <PhotoEvidence src={resolveMediaUrl(situation.photoUrls[1])} variant="thumb" thumbSize={32} className="w-full h-full object-cover" />
            </div>
          )}
          {situation.reportCount > 1 && (
            <span className="absolute -top-1.5 -right-1.5 rounded-full bg-slate-900 border px-1.5 py-0.5 text-[10px] font-black text-white" style={{ borderColor: "var(--border)" }}>
              +{situation.reportCount - 1}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div className="space-y-1">
          {/* Priority + time */}
          <div className="flex items-center justify-between gap-2">
            <span className="priority-badge" style={
              situation.priority === "critical" ? { color: "var(--critical)", background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.25)" } :
              situation.priority === "high"     ? { color: "var(--high)",     background: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.25)" } :
              situation.priority === "moderate" ? { color: "var(--moderate)", background: "rgba(234,179,8,0.1)",  borderColor: "rgba(234,179,8,0.25)"  } :
                                                  { color: "var(--low)",      background: "rgba(100,116,139,0.1)",borderColor: "rgba(100,116,139,0.25)" }
            }>
              {PRIORITY_LABEL[situation.priority]}
            </span>
            <span className="flex items-center gap-1 text-[12px] text-slate-500 shrink-0">
              <Clock size={10} /> {timeAgo(situation.latestReportAt)}
            </span>
          </div>

          {/* Place name */}
          <h4 className="text-[14px] font-semibold text-white leading-snug line-clamp-1">{situation.placeLabel}</h4>

          {/* Description */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight">
            <span className="font-semibold text-slate-300">{pm25 !== undefined ? `PM2.5: ${Math.round(pm25)} µg/m³` : "PM2.5: unavailable"}</span>
            <span className="text-slate-500">Risk: {PRIORITY_LABEL[situation.priority]}</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-tight line-clamp-1">{situation.shortDescription}</p>

          {/* Contextual Intelligence Badges (Schools / Hospitals / Recurrence) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {situation.sensitiveLocations?.categoryCounts?.school ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">
                <span>🏫</span> {situation.sensitiveLocations.categoryCounts.school} school{situation.sensitiveLocations.categoryCounts.school > 1 ? "s" : ""}
              </span>
            ) : null}
            {situation.sensitiveLocations?.categoryCounts?.hospital ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-300">
                <span>🏥</span> {situation.sensitiveLocations.categoryCounts.hospital} hospital{situation.sensitiveLocations.categoryCounts.hospital > 1 ? "s" : ""}
              </span>
            ) : null}
            {situation.recurrence && situation.recurrence.similarIncidentCount > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                <span>🔁</span> {situation.recurrence.similarIncidentCount} incidents / {situation.recurrence.windowDays}d
              </span>
            ) : null}
          </div>
        </div>

        {/* Bottom: count + score bar */}
        <div className="flex items-center justify-between gap-3 mt-1.5 pt-1 border-t border-white/[0.04]">
          <span className="text-[11px] text-slate-500">
            {situation.reportCount} evidence report{situation.reportCount !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-500">Evidence</span>
            <div className="score-bar-track w-12">
              <div
                className="score-bar-fill"
                style={{ width: `${Math.max(5, situation.situationScore)}%`, background: color }}
              />
            </div>
            <span className="text-[11px] font-bold text-slate-300 font-mono">{situation.situationScore}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
