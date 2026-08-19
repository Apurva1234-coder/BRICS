import { Clock, MapPin, AlertCircle } from "lucide-react";
import type { PollutionSituation } from "../types";
import { SituationRankBadge } from "./SituationRankBadge";

interface SituationCardProps {
  situation: PollutionSituation;
  onClick?: () => void;
  compact?: boolean;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(diff / 60000)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function pollutionLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SituationCard({ situation, onClick, compact = false }: SituationCardProps) {
  return (
    <article
      className="situation-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <SituationRankBadge rank={situation.rank} priority={situation.priority} size="sm" />
          <h3 className="mt-2 truncate text-base font-semibold text-white">{situation.placeLabel}</h3>
          <p className="mt-1 text-xs text-slate-400 line-clamp-2">{situation.shortDescription}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold text-white">{situation.situationScore}</div>
          <div className="text-xs text-slate-500">score</div>
        </div>
      </div>

      {/* Photo strip */}
      {situation.photoUrls.length > 0 && (
        <div className="photo-strip mt-3">
          {situation.photoUrls.slice(0, 4).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="h-14 w-14 rounded-lg object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
        </div>
      )}

      {/* Meta pills */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="metric-pill">{situation.reportCount} reports</span>
        {situation.unresolvedCount > 0 && (
          <span className="metric-pill text-warning">{situation.unresolvedCount} unresolved</span>
        )}
        <span className="metric-pill capitalize">{pollutionLabel(situation.dominantPollutionType)}</span>
      </div>

      {/* Effects preview */}
      {!compact && situation.effects.length > 0 && (
        <div className="mt-3 space-y-1">
          {situation.effects.slice(0, 2).map((effect) => (
            <div key={effect} className="flex items-center gap-2 text-xs text-slate-400">
              <AlertCircle size={11} className="shrink-0 text-warning" />
              {effect}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {timeAgo(situation.latestReportAt)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={11} />
          {situation.centerLat.toFixed(3)}, {situation.centerLng.toFixed(3)}
        </span>
      </div>
    </article>
  );
}
