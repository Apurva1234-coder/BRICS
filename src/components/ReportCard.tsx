import { Clock, MapPin, BarChart3 } from "lucide-react";
import type { PollutionReport } from "../types";
import { PhotoEvidence } from "./PhotoEvidence";
import { StatusPill } from "./StatusPill";

interface ReportCardProps {
  report: PollutionReport;
  onSelect?: (report: PollutionReport) => void;
  situationRank?: number;
}

function timeLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ReportCard({ report, onSelect, situationRank }: ReportCardProps) {
  const displayUrl = report.media?.[0]?.displayUrl || report.imageUrl;

  return (
    <article
      onClick={() => onSelect?.(report)}
      className="flex gap-4 p-4 rounded-xl border border-slate-900 bg-slate-950/40 hover:bg-slate-900/30 hover:border-slate-800 transition duration-200 cursor-pointer select-none outline-none"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(report);
        }
      }}
    >
      {/* Thumbnail */}
      <div className="shrink-0">
        <PhotoEvidence
          src={displayUrl}
          alt={report.gemini.pollution_type}
          mode="thumbnail"
          className="w-16 h-16 rounded-lg object-cover bg-slate-950 border border-slate-900"
        />
      </div>

      {/* Main Metadata */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          {/* Top Row: Ticket ID, Status, Situation link if available */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-mono font-bold text-slate-500 truncate uppercase">
                {report.id}
              </span>
              <StatusPill status={report.status} />
              {situationRank !== undefined && (
                <span className="text-[9px] font-extrabold uppercase bg-slate-900 text-slate-400 border border-slate-850 px-1.5 py-0.5 rounded tracking-wide shrink-0">
                  Sit #{situationRank}
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-medium shrink-0">
              {report.trustLevel}
            </span>
          </div>

          {/* Pollution Category */}
          <h4 className="mt-1 text-sm font-semibold text-slate-200 capitalize truncate">
            {report.gemini.pollution_type.replace(/_/g, " ")}
          </h4>

          {/* Location */}
          <p className="mt-0.5 text-xs text-slate-400 truncate flex items-center gap-1">
            <MapPin size={11} className="text-slate-500 shrink-0" />
            {report.areaText}
          </p>
        </div>

        {/* Footer info: submitted time */}
        <div className="mt-2.5 pt-2 border-t border-slate-900/60 flex items-center justify-between gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {timeLabel(report.createdAt)}
          </span>
          <div className="flex items-center gap-1.5">
            <BarChart3 size={11} />
            <span>Score: {report.evidenceScore}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
