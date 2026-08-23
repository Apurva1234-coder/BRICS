import { CheckCircle2, ClipboardList, Flame, AlertTriangle, BarChart3, Satellite } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildRankedSituationsClient } from "../utils/situationClient";
import { AirQualityPanel } from "../components/AirQualityPanel";
import { ForecastPanel } from "../components/ForecastPanel";
import { PhotoEvidence } from "../components/PhotoEvidence";
import { StatusPill } from "../components/StatusPill";
import { SeverityBadge } from "../components/SeverityBadge";
import { approveResolvedReport, assignDemoMunicipalReport, updateReportAction, updateReportStatus } from "../services/reportService";
import type { PollutionReport, PollutionSituation, ReportStatus } from "../types";
import { reportPhotoUrl, resolveMediaUrl } from "../utils/mediaUrl";
import { apiClient } from "../services/apiClient";
import { useTranslation } from "react-i18next";

const QUEUE_FILTERS = ["All", "Needs Review", "High Priority", "In Progress", "Resolved"];
const DEPARTMENTS = ["Sanitation", "Roads", "Drainage", "Traffic"] as const;

function timeLabel(s: string) {
  return new Date(s).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
}

export function AdminPage({
  reports,
  onReportsChanged
}: {
  reports: PollutionReport[];
  onReportsChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState<PollutionReport | null>(reports[0] ?? null);
  const [approving, setApproving] = useState(false);
  const [showAqi, setShowAqi] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const approvalStatus = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected((current) => reports.find((report) => report.id === current?.id) || reports[0] || null);
  }, [reports]);

  const situations = useMemo(() => buildRankedSituationsClient(reports), [reports]);

  const filtered = useMemo(() => reports.filter((r) => {
    if (filter === "Needs Review") return r.status === "Manual review needed" || r.trustLevel === "Needs Review";
    if (filter === "High Priority") return ["high", "severe"].includes(r.priority);
    if (filter === "In Progress") return r.status === "Assigned" || r.status === "In Progress";
    if (filter === "Resolved") return r.status === "Resolved";
    return true;
  }).sort((a, b) => (b.hotspotScore + b.evidenceScore) - (a.hotspotScore + a.evidenceScore)), [filter, reports]);

  const today = reports.filter((r) => new Date(r.createdAt).toDateString() === new Date().toDateString()).length;
  const highPriority = reports.filter((r) => ["high", "severe"].includes(r.priority)).length;
  const openHotspots = reports.filter((r) => r.nearby.similarReportCount >= 3).length;
  const resolved = reports.filter((r) => r.status === "Resolved").length;

  const changeStatus = async (status: ReportStatus) => {
    if (!selected) return;
    const updated = await updateReportStatus(selected.id, status);
    if (updated) setSelected(updated);
    await onReportsChanged();
  };
  const updateAction = async (payload: any) => {
    if (!selected) return;
    const updated = await updateReportAction(selected.id, payload);
    if (updated) setSelected(updated);
    await onReportsChanged();
  };
  const assignToMunicipal = async () => {
    if (!selected) return;
    const updated = await assignDemoMunicipalReport(selected.id);
    if (updated) setSelected(updated);
    await onReportsChanged();
  };
  const approveAsResolved = async () => {
    if (!selected?.cleanupProof || selected.status === "Resolved" || approving) return;
    setApproving(true);
    setApprovalMessage("Approving resolution");
    try {
      const updated = await approveResolvedReport(selected.id);
      if (updated) setSelected(updated);
      await onReportsChanged();
      setApprovalMessage("Resolution approved");
      window.setTimeout(() => approvalStatus.current?.focus(), 0);
    } catch {
      setApprovalMessage("Resolution failed. The report remains selected.");
      window.setTimeout(() => approvalStatus.current?.focus(), 0);
    } finally { setApproving(false); }
  };

  return (
    <div className="max-w-screen-xl mx-auto py-8 space-y-10">

      {/* Header */}
      <div>
        <p className="section-eyebrow mb-1">{t("admin.officerDashboard")}</p>
        <h1 className="text-[28px] font-bold text-white tracking-tight">{t("admin.situationCommand")}</h1>
        <p className="text-[15px] text-slate-400 mt-1.5">{t("admin.dashboardDesc")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("admin.todaysReports"), value: today, icon: ClipboardList, color: "white" },
          { label: t("admin.highPriority"), value: highPriority, icon: AlertTriangle, color: "var(--moderate)" },
          { label: t("admin.activeHotspots"), value: openHotspots, icon: Flame, color: "var(--critical)" },
          { label: t("admin.resolved"), value: resolved, icon: CheckCircle2, color: "#34d399" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="flex items-center justify-between rounded-2xl p-5"
               style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div>
              <p className="section-eyebrow mb-1">{label}</p>
              <p className="text-[32px] font-black leading-none tabular-nums" style={{ color }}>{value}</p>
            </div>
            <Icon size={24} style={{ color, opacity: 0.35 }} />
          </div>
        ))}
      </div>

      {/* Ranked situations overview */}
      {situations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-slate-400" />
            <h2 className="text-[17px] font-bold text-white">{t("admin.rankedSituations")}</h2>
            <span className="text-[13px] text-slate-500">{situations.length} {t("admin.active")}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {situations.map((sit) => {
              const color =
                sit.priority === "critical" ? "var(--critical)" :
                sit.priority === "high" ? "var(--high)" :
                sit.priority === "moderate" ? "var(--moderate)" : "var(--low)";
              return (
                <div key={sit.id} className="rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                     style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <div style={{ height: "120px", overflow: "hidden" }}>
                    <PhotoEvidence src={resolveMediaUrl(sit.photoUrls[0])} variant="main" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[22px] font-black leading-none" style={{ color }}>#{sit.rank}</span>
                      <span className="text-[13px] font-semibold capitalize" style={{ color }}>{sit.priority}</span>
                      <span className="ml-auto text-[13px] text-slate-500">{sit.reportCount} {t("admin.reportsCount")}</span>
                    </div>
                    <p className="text-[15px] font-semibold text-white truncate">{sit.placeLabel}</p>
                    <p className="text-[13px] text-slate-400 line-clamp-2">{sit.shortDescription}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Queue + Action panel */}
      <div className="relative flex gap-6 min-h-[600px] lg:items-start">
        {/* Left: ticket queue */}
        <div className={`w-full lg:w-[400px] flex-shrink-0 flex flex-col ${selected ? "hidden lg:flex" : "flex"}`}
             style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px" }}>
          {/* Filters */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            <p className="text-[15px] font-semibold text-white mb-3">{t("admin.ticketQueue")}</p>
            <div className="flex flex-wrap gap-1.5 hide-scrollbar" role="group" aria-label="Officer ticket filters">
              {QUEUE_FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`filter-chip ${filter === f ? "filter-chip-active" : ""}`}>
                  {t("report.filters." + f.toLowerCase().replace(" ", ""), f)}
                </button>
              ))}
            </div>
          </div>
          {/* List */}
          <div className="hide-scrollbar px-3 py-3 space-y-2 pb-[calc(100px+env(safe-area-inset-bottom))] lg:pb-3">
            {filtered.map((report) => {
              const isSelected = selected?.id === report.id;
              const imgUrl = reportPhotoUrl(report);
              return (
                <button
                  key={report.id}
                  onClick={() => setSelected(report)}
                  className={`w-full text-left report-row ${isSelected ? "report-row-selected" : ""}`}
                >
                  <div className="overflow-hidden rounded-xl shrink-0" style={{ width: "56px", height: "56px" }}>
                    <PhotoEvidence src={imgUrl} variant="thumb" className="w-14 h-14 object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <StatusPill status={report.status} />
                      {report.satelliteEvidence && (
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-500/20 bg-slate-500/10 text-slate-400">
                          <Satellite size={10} />
                          {report.satelliteEvidence.status === 'pending' || report.satelliteEvidence.status === 'processing' ? 'Sat pending' :
                           report.satelliteEvidence.status === 'unavailable' || report.satelliteEvidence.status === 'failed' ? 'Sat unavailable' :
                           report.satelliteEvidence.assessment.result === 'potentially_consistent' ? <span className="text-emerald-400">Context consistent</span> :
                           report.satelliteEvidence.assessment.result === 'possible_surface_change' ? <span className="text-emerald-300">Surface change</span> : 'Sat checked'}
                        </div>
                      )}
                    </div>
                    <p className="text-[14px] font-semibold text-white capitalize truncate">
                      {report.gemini.pollution_type.replace(/_/g, " ")}
                    </p>
                    <p className="text-[12px] text-slate-500 truncate">{report.areaText}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: action panel */}
        {selected && (
          <div className={`
            absolute inset-0 z-[200] overflow-y-auto overflow-x-hidden bg-[var(--bg)] lg:static lg:flex-1 lg:min-w-0 lg:bg-[var(--surface)] lg:rounded-2xl lg:border lg:border-[var(--border)] lg:z-auto hide-scrollbar
          `}>
            {/* Mobile back button */}
            <div className="lg:hidden p-4 border-b border-white/10 sticky top-0 bg-[var(--bg)]/95 backdrop-blur z-[250]">
              <button onClick={() => setSelected(null)} className="icon-button flex items-center justify-center gap-2 w-auto px-5 min-h-[44px] !rounded-full text-slate-300 font-medium">
                &larr; {t("common.back")}
              </button>
            </div>

            <div className="p-4 lg:p-6 pb-[calc(100px+env(safe-area-inset-bottom))] lg:pb-6 space-y-6">
              {/* Evidence photo — large */}
              {selected.cleanupProof ? <section className="rounded-2xl border border-white/10 bg-white/[.02] p-4 space-y-4"><div ref={approvalStatus} tabIndex={-1} role={approvalMessage.includes("failed") ? "alert" : "status"} aria-live="polite" className="sr-only">{approvalMessage}</div><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-sm font-black text-amber-300">BEFORE <span className="ml-2 text-[11px] font-normal text-slate-500">Submitted by Citizen</span></p><PhotoEvidence src={reportPhotoUrl(selected)} alt={`Before cleanup: citizen evidence for ${selected.gemini.pollution_type.replace(/_/g, " ")} near ${selected.areaText}.`} variant="main" className="mt-2 h-52 w-full rounded-xl object-cover"/></div><div><p className="text-sm font-black text-emerald-300">AFTER <span className="ml-2 text-[11px] font-normal text-slate-500">Submitted by Municipal Team</span></p><PhotoEvidence src={resolveMediaUrl(selected.cleanupProof.afterMedia.displayUrl)} alt={`After cleanup: municipal evidence submitted for the same report near ${selected.areaText}.`} variant="main" className="mt-2 h-52 w-full rounded-xl object-cover"/></div></div><div className="grid gap-3 text-sm sm:grid-cols-3"><p><span className="section-eyebrow block">Action taken</span>{selected.cleanupProof.actionTaken || "Cleanup completed"}</p><p><span className="section-eyebrow block">Proof submitted</span>{timeLabel(selected.cleanupProof.submittedAt)}</p>{selected.cleanupProof.note && <p><span className="section-eyebrow block">Cleanup note</span>{selected.cleanupProof.note}</p>}</div><p className="text-sm text-slate-300">Final decision belongs to the Officer.</p><div className="flex flex-wrap gap-2">{selected.status === "Resolved" ? <span className="rounded-full bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-300">Resolved</span> : <button className="primary-button" aria-busy={approving} disabled={approving} onClick={approveAsResolved}>{approving ? "Approving resolution…" : "Approve as Resolved"}</button>}</div></section> : <PhotoEvidence src={reportPhotoUrl(selected)} alt={`Citizen evidence for ${selected.gemini.pollution_type.replace(/_/g, " ")} near ${selected.areaText}.`} variant="main" className="w-full h-56 rounded-2xl object-cover" />}

              {/* Status + badges */}
              <div className="flex flex-wrap gap-2">
                <StatusPill status={selected.status} />
                <SeverityBadge severity={selected.gemini.severity} />
                {selected.satelliteEvidence && (
                  <div className="flex items-center gap-1 text-[12px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-slate-500/20 bg-slate-500/10 text-slate-400">
                    <Satellite size={12} />
                    {selected.satelliteEvidence.status === 'pending' || selected.satelliteEvidence.status === 'processing' ? 'Satellite pending' :
                     selected.satelliteEvidence.status === 'unavailable' || selected.satelliteEvidence.status === 'failed' ? 'Satellite unavailable' :
                     selected.satelliteEvidence.assessment.result === 'potentially_consistent' ? <span className="text-emerald-400">Potentially consistent</span> :
                     selected.satelliteEvidence.assessment.result === 'possible_surface_change' ? <span className="text-emerald-300">Possible surface change</span> : 'Satellite checked'}
                  </div>
                )}
              </div>

              {/* Type + summary */}
              <div>
                <p className="text-[20px] font-bold text-white capitalize">{selected.gemini.pollution_type.replace(/_/g, " ")}</p>
                <p className="text-[14px] text-slate-400 mt-1.5 leading-relaxed">{selected.gemini.public_summary}</p>
              </div>

              {/* Location + evidence */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                  <p className="section-eyebrow mb-1">{t("common.location")}</p>
                  <p className="text-[14px] text-white">{selected.areaText}</p>
                </div>
                <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                  <p className="section-eyebrow mb-1">{t("detail.evidenceScore")}</p>
                  <p className="text-[14px] text-white font-semibold">{selected.evidenceScore}/100</p>
                </div>
              </div>

              {/* Action log */}
              {selected.actionLog?.length > 0 && (
                <div className="rounded-xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                  <p className="section-eyebrow">{t("admin.workflowHistory")}</p>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto scrollbar-none">
                    {selected.actionLog.slice(-4).map((entry, i) => (
                      <div key={i} className="flex justify-between gap-3 text-[13px]">
                        <span className="text-slate-300 capitalize">{entry.type.replace(/_/g, " ")}{entry.note ? ` — ${entry.note}` : ""}</span>
                        <span className="text-slate-600 font-mono shrink-0">{timeLabel(entry.at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dispatch */}
              <div className="space-y-3" style={{ paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                <p className="text-[14px] font-semibold text-white">{t("admin.dispatchService")}</p>
                <div className="grid grid-cols-2 gap-2"><button className="primary-button min-h-[44px] col-span-2" disabled={selected.status === "Resolved" || selected.municipalAssignment?.status === "Assigned" || selected.municipalAssignment?.status === "Accepted" || selected.municipalAssignment?.status === "Cleanup In Progress" || selected.municipalAssignment?.status === "Cleanup Proof Submitted"} onClick={assignToMunicipal}>Assign to Municipal</button>
                  {DEPARTMENTS.map((dept) => (
                    <button key={dept}
                      className="ghost-button w-full justify-center text-[13px]"
                      onClick={() => updateAction({ status: "Assigned", assignedDepartment: dept, assignedTo: dept })}>
                      {dept}
                    </button>
                  ))}
                  <button className="ghost-button w-full justify-center text-[13px]"
                    onClick={() => updateAction({ status: "In Progress", notes: "Work started." })}>
                    {t("admin.markInProgress")}
                  </button>
                  <button className="ghost-button w-full justify-center text-[13px] text-red-400 hover:text-red-300"
                    onClick={() => changeStatus("False Report")}>
                    {t("admin.falseReport")}
                  </button>
                </div>
              </div>

              {/* AQI context */}
              <details style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                <summary className="section-eyebrow cursor-pointer hover:text-slate-300 transition-colors">
                  {t("admin.airQualityContext")}
                </summary>
                <div className="mt-4 space-y-4">
                  <AirQualityPanel airQuality={selected.airQuality} compact />
                  <ForecastPanel forecast={selected.forecast} compact />
                </div>
              </details>
            </div>
          </div>
        )}
        
        {/* Empty state for desktop when no report is selected */}
        {!selected && (
          <div className="hidden lg:flex flex-1 flex-col items-center justify-center h-full text-center p-8 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
            <p className="text-[16px] font-medium text-slate-500">{t("admin.selectTicket")}</p>
            <p className="text-[14px] text-slate-600 mt-1 max-w-xs leading-relaxed">
              {t("admin.selectTicketDesc")}
            </p>
          </div>
        )}
      </div>

      {/* Satellite Status Debug */}
      {import.meta.env.VITE_ENABLE_SYSTEM_DIAGNOSTICS === "true" && <div className="pt-8">
        <details>
          <summary className="text-[12px] text-slate-500 cursor-pointer hover:text-slate-300">
            System Diagnostics
          </summary>
          <div className="mt-4 p-4 rounded-xl text-[12px] font-mono text-slate-400 bg-black/40 border border-white/5 whitespace-pre-wrap">
            <button 
              className="mb-2 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10"
              onClick={async (e) => {
                try {
                  const res = await apiClient.getSatelliteStatus();
                  (e.target as HTMLButtonElement).nextElementSibling!.textContent = JSON.stringify(res, null, 2);
                } catch (err: any) {
                  (e.target as HTMLButtonElement).nextElementSibling!.textContent = String(err);
                }
              }}>
              Fetch Satellite Status
            </button>
            <div>Press button to load...</div>
          </div>
        </details>
      </div>}

    </div>
  );
}
