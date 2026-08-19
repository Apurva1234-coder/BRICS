import { Camera, SlidersHorizontal } from "lucide-react";
import type { PollutionSituation } from "../types";
import { SituationListItem } from "./SituationListItem";
import { useTranslation } from "react-i18next";

interface SituationRailProps {
  situations: PollutionSituation[];
  totalReports: number;
  selectedSituation: PollutionSituation | null;
  onSelectSituation: (s: PollutionSituation) => void;
  activeFilter: string;
  onFilterChange: (f: string) => void;
  onReportClick: () => void;
}

// Internal keys stay English for comparison logic — only display is translated
const FILTERS = ["All", "Critical", "High", "Moderate", "Low", "Unresolved"];

export function SituationRail({
  situations,
  totalReports,
  selectedSituation,
  onSelectSituation,
  activeFilter,
  onFilterChange,
  onReportClick
}: SituationRailProps) {
  const { t } = useTranslation();

  const filtered = situations.filter((s) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Unresolved") return (s.unresolvedCount ?? s.activeReportCount) > 0;
    return s.priority.toLowerCase() === activeFilter.toLowerCase();
  });

  const filterLabel = (f: string) => {
    if (f === "All") return t("situation.filters.all");
    if (f === "Critical") return t("situation.filters.critical");
    if (f === "High") return t("situation.filters.high");
    if (f === "Moderate") return t("situation.filters.moderate");
    if (f === "Low") return t("situation.filters.low");
    if (f === "Unresolved") return t("common.pending"); // Map Unresolved to pending
    return f;
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[18px] font-bold text-white tracking-tight leading-none">
              {t("situation.rankedActionAreas")}
            </h2>
            <p className="text-[12px] font-medium text-slate-500 mt-1">
              {situations.length === 0
                ? `0 ${t("situation.rankedActionAreas").toLowerCase()} • ${totalReports} ${t("situation.evidenceReports")}`
                : `${situations.length} ${t("situation.rankedActionAreas").toLowerCase()} • ${totalReports} ${t("situation.evidenceReports")}`}
            </p>
          </div>
          <button
            onClick={onReportClick}
            className="primary-button !px-3 !py-2 !gap-1.5"
            title={t("report.submitReport")}
          >
            <Camera size={15} />
            <span className="hidden sm:inline">{t("nav.capture")}</span>
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`filter-chip flex-shrink-0 ${activeFilter === f ? "filter-chip-active" : ""}`}
            >
              {filterLabel(f)}
            </button>
          ))}
        </div>
      </div>

      {/* Ranked list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 hide-scrollbar">
        {filtered.length > 0 ? (
          filtered.map((situation) => (
            <SituationListItem
              key={situation.id}
              situation={situation}
              isSelected={selectedSituation?.id === situation.id}
              onClick={() => onSelectSituation(situation)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <SlidersHorizontal size={24} className="text-slate-700 mb-3" />
            <p className="text-[14px] font-medium text-slate-500">
              {totalReports === 0 ? "No reports yet" : "No active situations"}
            </p>
            <p className="text-[13px] text-slate-600 mt-1">
              {totalReports === 0 ? "Submit a report to generate a situation." : "Submit or verify reports to create situations."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
