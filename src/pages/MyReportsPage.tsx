import { useState, useMemo, useEffect, useRef } from "react";
import type { Route } from "../App";
import { ReportDetailPanel } from "../components/ReportDetailPanel";
import { PhotoEvidence } from "../components/PhotoEvidence";
import { StatusPill } from "../components/StatusPill";
import type { PollutionReport, PollutionSituation } from "../types";
import { Camera, MapPin, Clock } from "lucide-react";
import { reportPhotoUrl } from "../utils/mediaUrl";
import { cleanAreaText } from "../utils/geo";
import { useTranslation } from "react-i18next";
import { CitizenProgressSummary, CitizenProgressTracker } from "../components/CitizenProgressTracker";
import { listReports as listStoredReports } from "../services/reportService";
import { DEMO_REPORTS_CHANGED_EVENT } from "../services/demoBrowserStorage";

function timeLabel(isoDate: string) {
  return new Date(isoDate).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MyReportsPage({
  situations = [],
  onNavigate
}: {
  situations?: PollutionSituation[];
  onNavigate: (route: Route) => void;
}) {
  const { t } = useTranslation();
  const [reports, setReports] = useState<PollutionReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<PollutionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [activeFilter, setActiveFilter] = useState("All");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const selectedButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (selectedReport && window.matchMedia("(max-width: 1023px)").matches) detailHeading.current?.focus(); }, [selectedReport]);
  useEffect(() => {
    const refresh = () => setReloadToken((value) => value + 1);
    window.addEventListener(DEMO_REPORTS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DEMO_REPORTS_CHANGED_EVENT, refresh);
  }, []);

  const filteredReports = useMemo(() => {
    if (activeFilter === "All") return reports;
    if (activeFilter === "Manual Review") return reports.filter(r => r.trustLevel === "Needs Review");
    return reports.filter(r => r.status === activeFilter);
  }, [reports, activeFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listStoredReports()
      .then((mine) => {
        if (cancelled) return;
        setReports(mine);
        setSelectedReport(mine[0] ?? null);
      })
      .catch((error) => {
        if (cancelled) return;
        setReports([]);
        setSelectedReport(null);
        setLoadError(error instanceof Error ? error.message : "Unable to load your reports.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // Auto-select first report of filtered list
  useEffect(() => {
    if (filteredReports.length > 0 && (!selectedReport || !filteredReports.some((report) => report.id === selectedReport.id))) {
      setSelectedReport(filteredReports[0]);
    }
  }, [filteredReports, selectedReport]);

  const linkedSituation = useMemo(() => {
    if (!selectedReport) return null;
    return situations.find((s) => s.reportIds.includes(selectedReport.id)) ?? null;
  }, [selectedReport, situations]);

  const selectedSituationReports = useMemo(() => {
    if (!linkedSituation) return selectedReport ? [selectedReport] : [];
    return reports.filter((r) => linkedSituation.reportIds.includes(r.id));
  }, [linkedSituation, selectedReport, reports]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
        <p className="text-[14px] text-slate-400">{t("common.loading")}</p>
      </div>
    );
  }

  if (loadError) {
    const rateLimited = /rate limit|too many|wait/i.test(loadError);
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-5">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <Camera size={28} className="text-amber-300" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-white">{rateLimited ? "Too many requests" : t("common.error")}</h1>
          <p className="text-[15px] text-slate-400 mt-2 leading-relaxed">{loadError}</p>
        </div>
        {!rateLimited && <button className="primary-button mx-auto" onClick={() => setReloadToken((value) => value + 1)}>{t("common.retry")}</button>}
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-5">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto"
             style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <Camera size={28} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-white">{t("report.noReportsYet")}</h1>
          <p className="text-[15px] text-slate-400 mt-2 leading-relaxed">
            {loadError || t("report.noReportsDesc")}
          </p>
        </div>
        <button className="primary-button mx-auto" onClick={() => onNavigate("capture")}>
          <Camera size={15} /> {t("nav.capture")}
        </button>
      </div>
    );

  }

  return (
    <div className="max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <p className="section-eyebrow mb-1">{t("report.citizenHistory")}</p>
          <div className="flex items-center gap-3">
            <h1 className="text-[28px] font-bold text-white tracking-tight">{t("nav.myReports")}</h1>
            {!loading && reports.length > 0 && (
              <span className="text-[13px] font-semibold text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10 mt-1">
                {t("report.submittedCount", { count: reports.length })}
              </span>
            )}
          </div>
          <p className="text-[15px] text-slate-400 mt-1">{t("report.trackTickets")}</p>
        </div>
        <button className="primary-button" onClick={() => onNavigate("capture")}>
          <Camera size={15} /> {t("nav.capture")}
        </button>
      </div>

      {/* Two-column layout: list | detail */}
      <div className="relative flex gap-6 min-h-[500px] lg:items-start">
        {/* Left: report list */}
        <div className={`w-full lg:w-[380px] flex-shrink-0 flex flex-col min-h-0 ${selectedReport ? "hidden lg:flex" : "flex"}`}>
          
          <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar shrink-0" role="group" aria-label={t("report.filters.all", "Report filters")}>
            {["All", "Submitted", "In Progress"].map(f => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                aria-pressed={activeFilter === f}
                className={`filter-chip flex-shrink-0 ${activeFilter === f ? "filter-chip-active" : ""}`}
              >
                {t("report.filters." + f.toLowerCase().replace(" ", ""), f)}
              </button>
            ))}
          </div>

          <div className="space-y-2 pb-[calc(80px+env(safe-area-inset-bottom))] lg:pb-6">
          {filteredReports.map((report) => {
            const sit = situations.find((s) => s.reportIds.includes(report.id));
            const isSelected = selectedReport?.id === report.id;
            const imgUrl = reportPhotoUrl(report);

            return (
              <button
                key={report.id}
                ref={isSelected ? selectedButton : undefined}
                onClick={() => setSelectedReport(report)}
                aria-pressed={isSelected}
                className={`report-row ${isSelected ? "report-row-selected" : ""}`}
              >
                {/* Thumbnail 72×72 */}
                <div className="shrink-0 overflow-hidden rounded-xl" style={{ width: "72px", height: "72px" }}>
                  <PhotoEvidence src={imgUrl} decorative variant="thumb" className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusPill status={report.status} />
                    {sit && (
                      <span className="text-[11px] font-bold uppercase tracking-wide bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20" style={{ color: "var(--accent)" }}>
                        Part of Sit #{sit.rank}
                      </span>
                    )}
                  </div>
                  <p className="text-[15px] font-semibold text-white capitalize truncate">
                    {report.gemini.pollution_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-[13px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                    <MapPin size={11} /> {cleanAreaText(report.areaText, report.lat, report.lng)}
                  </p>
                  <p className="text-[12px] text-slate-600 flex items-center gap-1 mt-1">
                    <Clock size={10} /> {timeLabel(report.createdAt)}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1"><CitizenProgressSummary report={report} /></p>
                  {report.status === "Resolved" && report.reward && <p className="mt-1 text-[11px] font-semibold text-emerald-300">Cleanup resolved — you earned {report.reward.points} civic points.</p>}
                </div>
              </button>
            );
          })}
          </div>
        </div>

        {/* Right: details panel */}
        {selectedReport && (
          <div className={`
            absolute inset-0 z-50 overflow-y-auto overflow-x-hidden bg-[var(--bg)] lg:static lg:flex-1 lg:min-w-0 lg:bg-slate-900/50 lg:rounded-2xl lg:border lg:border-white/5 lg:z-auto hide-scrollbar
          `} role="dialog" aria-modal="true" aria-labelledby="report-detail-title" onKeyDown={(event) => { if (event.key === "Escape") { setSelectedReport(null); window.setTimeout(() => selectedButton.current?.focus(), 0); } }}>
            {/* Mobile back button */}
            <div className="lg:hidden p-4 border-b border-white/10 sticky top-0 bg-[var(--bg)]/95 backdrop-blur z-[100]">
              <button onClick={() => { setSelectedReport(null); window.setTimeout(() => selectedButton.current?.focus(), 0); }} className="icon-button flex items-center justify-center gap-2 w-auto px-5 min-h-[44px] !rounded-full text-slate-300 font-medium">
                &larr; {t("common.back")}
              </button>
            </div>
            
            <div className="p-4 lg:p-6 pb-[calc(100px+env(safe-area-inset-bottom))] lg:pb-6">
              <h2 id="report-detail-title" ref={detailHeading} tabIndex={-1} className="sr-only">{t("report.ticket")}</h2>
              <ReportDetailPanel
                report={selectedReport}
                linkedSituation={linkedSituation}
                situationReports={selectedSituationReports}
                onSelectReport={setSelectedReport}
              />
              <CitizenProgressTracker report={selectedReport} />
              {selectedReport.status === "Resolved" && selectedReport.reward && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.08] px-4 py-3 text-sm font-semibold text-emerald-200">Cleanup resolved — you earned {selectedReport.reward.points} civic points.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
