import { useState } from "react";
import { ChevronDown, BarChart3 } from "lucide-react";
import type { PollutionSituation } from "../types";

interface ScoreBreakdownProps {
  scoreBreakdown: PollutionSituation["scoreBreakdown"];
  situationScore: number;
}

interface ScoreRowProps {
  label: string;
  value: number;
  weight: string;
}

function ScoreRow({ label, value, weight }: ScoreRowProps) {
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="text-slate-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 mx-3 h-1 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-slate-300 rounded-full"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-right text-slate-300 font-semibold w-8 shrink-0">{Math.round(value)}</span>
      <span className="text-right text-slate-500 w-10 shrink-0">{weight}</span>
    </div>
  );
}

export function ScoreBreakdown({ scoreBreakdown, situationScore }: ScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-slate-800 bg-slate-900/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
      >
        <span className="flex items-center gap-1.5">
          <BarChart3 size={13} className="text-slate-500" />
          Score breakdown: {situationScore}/100
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="px-3 pb-3 border-t border-slate-900 pt-2 space-y-1 bg-slate-950/20">
          <ScoreRow label="Report volume" value={scoreBreakdown.reportVolumeScore} weight="25%" />
          <ScoreRow label="Public impact" value={scoreBreakdown.publicImpactScore} weight="20%" />
          <ScoreRow label="Evidence" value={scoreBreakdown.evidenceScore} weight="20%" />
          <ScoreRow label="Recency" value={scoreBreakdown.recencyScore} weight="15%" />
          <ScoreRow label="Unresolved ratio" value={scoreBreakdown.unresolvedScore} weight="10%" />
          <ScoreRow label="Hotspot history" value={scoreBreakdown.hotspotScore} weight="7%" />
          <ScoreRow label="AQI context" value={scoreBreakdown.aqiSupportScore} weight="3%" />
        </div>
      )}
    </div>
  );
}
