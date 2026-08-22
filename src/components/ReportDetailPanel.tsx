import { MapPinned, CheckCircle2, Clock, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { CpcbLocalContext, PollutionReport, PollutionSituation } from "../types";
import { PhotoEvidence } from "./PhotoEvidence";
import { StatusPill } from "./StatusPill";
import { reportPhotoUrl, resolveMediaUrl } from "../utils/mediaUrl";
import { apiClient } from "../services/apiClient";
import { CpcbContextPanel } from "./CpcbContextPanel";
import { SatelliteEvidenceCard } from "./SatelliteEvidenceCard";
import { MeteorologyCard } from "./MeteorologyCard";
import { useTranslation } from "react-i18next";

interface ReportDetailPanelProps {
  report: PollutionReport;
  linkedSituation?: PollutionSituation | null;
  situationReports?: PollutionReport[];
  onSelectReport?: (report: PollutionReport) => void;
  onClose?: () => void;
  onViewMap?: () => void;
  officer?: boolean;
}

function timeLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function pollutionLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ReportDetailPanel({
  report,
  linkedSituation,
  situationReports = [],
  onSelectReport,
  onClose,
  onViewMap,
  officer = false
}: ReportDetailPanelProps) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);
  const [cpcbContext, setCpcbContext] = useState<CpcbLocalContext | undefined>(report.cpcbContext);
  const [satelliteEvidence, setSatelliteEvidence] = useState(report.satelliteEvidence ?? null);
  const displayUrl = reportPhotoUrl(report);

  useEffect(() => {
    let cancelled = false;
    setCpcbContext(report.cpcbContext);
    setSatelliteEvidence(report.satelliteEvidence ?? null);

    if (!report.cpcbContext) {
      apiClient
        .getCpcbLocalContext({ lat: report.lat, lng: report.lng, radiusKm: 25 })
        .then((context) => {
          if (!cancelled) setCpcbContext(context);
        })
        .catch(() => undefined);
    }

    let intervalId: NodeJS.Timeout;
    
    const pollSatellite = () => {
      apiClient.getReportSatelliteEvidence(report.id)
        .then(res => {
          if (cancelled) return;
          const ev = res.satelliteEvidence;
          setSatelliteEvidence(ev);
          if (ev.status === "ready" || ev.status === "unavailable" || ev.status === "failed") {
            clearInterval(intervalId);
          }
        })
        .catch(() => {});
    };

    if (report.satelliteEvidence?.status === "pending" || report.satelliteEvidence?.status === "processing") {
      intervalId = setInterval(pollSatellite, 10000);
      
      // Safety stop after 60s
      setTimeout(() => clearInterval(intervalId), 60000);
    }

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [report.id, report.lat, report.lng, report.cpcbContext, report.satelliteEvidence]);

  const handleRetrySatellite = () => {
    setSatelliteEvidence(prev => prev ? { ...prev, status: "pending" } : null);
    apiClient.verifyReportSatellite(report.id)
      .then(res => setSatelliteEvidence(res.satelliteEvidence))
      .catch(() => setSatelliteEvidence(prev => prev ? { ...prev, status: "failed" } : null));
  };

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* Large photo — first and prominent */}
      <div className="overflow-hidden rounded-2xl w-full aspect-video lg:aspect-auto lg:h-64 bg-slate-900/50">
        <PhotoEvidence
          src={displayUrl}
          alt={t("a11y.citizenEvidence", { location: report.areaText })}
          variant="main"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Status + ticket */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-eyebrow mb-1">{t("report.ticket")}</p>
          <p className="font-mono text-[15px] font-bold text-white">{report.id}</p>
        </div>
        <StatusPill status={report.status} />
      </div>

      {/* Linked situation */}
      {linkedSituation && (
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-[14px]"
             style={{ background: "rgba(0,224,122,0.07)", border: "1px solid rgba(0,224,122,0.2)" }}>
          <span className="text-[22px] font-black" style={{ color: "var(--accent)" }}>#{linkedSituation.rank}</span>
          <div className="min-w-0">
            <p className="font-semibold text-white">{t("nav.situation")} {linkedSituation.priority}</p>
            <p className="text-[13px] text-slate-400 truncate">{linkedSituation.placeLabel}</p>
          </div>
        </div>
      )}

      {/* What was found */}
      <div>
        <p className="section-eyebrow mb-1.5">{t("detail.whatWasFound")}</p>
        <p className="text-[18px] font-bold text-white capitalize">{pollutionLabel(report.gemini.pollution_type)}</p>
        <p className="mt-1.5 text-[14px] text-slate-300 leading-relaxed">{report.gemini.public_summary}</p>
      </div>

      {/* Location + time row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <p className="section-eyebrow mb-1">{t("common.location")}</p>
          <p className="text-[14px] text-white font-medium leading-snug">{report.areaText}</p>
        </div>
        <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
          <p className="section-eyebrow mb-1">{t("common.submitted")}</p>
          <p className="text-[14px] text-white font-medium leading-snug">{timeLabel(report.createdAt)}</p>
        </div>
      </div>

      {/* Contextual Intelligence: Recurrence & Sensitive Locations */}
      {(report.recurrence || report.sensitiveLocations || report.contextualPriority) && (
        <div
          className="rounded-2xl p-4 space-y-2.5"
          style={{
            background: "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(59,130,246,0.04))",
            border: "1px solid rgba(249,115,22,0.2)"
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <span>🔁</span> Contextual Intelligence
            </span>
            {report.contextualPriority?.priorityElevated && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Priority Elevated
              </span>
            )}
          </div>

          {report.recurrence && report.recurrence.isRecurringHotspot && (
            <div className="flex items-start gap-2 text-[13px]">
              <span className="mt-0.5 text-base leading-none">🔁</span>
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white capitalize">
                    {report.recurrence.classification.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({report.recurrence.similarIncidentCount} incident{report.recurrence.similarIncidentCount === 1 ? "" : "s"} / 2 km / 90d)
                  </span>
                </div>
                <p className="text-[12px] text-slate-400 leading-snug">{report.recurrence.explanation}</p>
              </div>
            </div>
          )}

          {report.sensitiveLocations && report.sensitiveLocations.hasSensitiveLocations && (
            <div className="flex items-start gap-2 text-[13px] pt-1.5 border-t border-white/5">
              <span className="mt-0.5 text-base leading-none">🏫</span>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Sensitive Facilities</span>
                  <span className="text-[11px] text-slate-400">
                    {report.sensitiveLocations.totalCount} within 1 km
                  </span>
                </div>
                <p className="text-[12px] text-slate-400 leading-snug">{report.sensitiveLocations.summary}</p>
                {report.sensitiveLocations.locations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {report.sensitiveLocations.locations.slice(0, 3).map((loc) => (
                      <span
                        key={loc.id}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300"
                      >
                        <span>{loc.category === "hospital" ? "🏥" : loc.category === "school" ? "🏫" : loc.category === "childcare" ? "👶" : "👵"}</span>
                        <span className="truncate max-w-[110px]">{loc.name}</span>
                        <span className="text-slate-500 font-mono text-[10px]">({loc.distanceMeters}m)</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {report.contextualPriority?.elevationReasons && report.contextualPriority.elevationReasons.length > 0 && (
            <div className="pt-2 border-t border-white/5 space-y-1">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Why Priority Escalated:
              </span>
              <ul className="space-y-1 text-[12px] text-slate-300">
                {report.contextualPriority.elevationReasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <SatelliteEvidenceCard
        evidence={satelliteEvidence}
        reportId={report.id}
        onRetry={handleRetrySatellite}
      />

      <MeteorologyCard
        latitude={report.lat}
        longitude={report.lng}
        timestamp={report.createdAt}
      />

      <CpcbContextPanel context={cpcbContext} />

      {/* Satellite verification layer */}
      {satelliteEvidence && (
        <SatelliteEvidenceCard
          evidence={satelliteEvidence}
          onRetry={handleRetrySatellite}
        />
      )}
      {/* Resolution proof */}
      {report.resolutionProof && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <p className="flex items-center gap-2 font-semibold text-emerald-400 text-[14px]">
            <CheckCircle2 size={15} /> {t("detail.resolvedProof")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="section-eyebrow mb-2">{t("common.before")}</p>
              <PhotoEvidence
                src={reportPhotoUrl(report)}
                alt={t("a11y.beforeCleanupEvidence", { location: report.areaText })}
                variant="main"
                className="w-full h-[120px] rounded-xl object-cover"
              />
            </div>
            <div>
              <p className="section-eyebrow mb-2">{t("common.after")}</p>
              <PhotoEvidence
                src={resolveMediaUrl(report.resolutionProof.afterMedia?.displayUrl)}
                alt={t("a11y.afterCleanupEvidence", { location: report.areaText })}
                variant="main"
                className="w-full h-[120px] rounded-xl object-cover"
              />
            </div>
          </div>
          <p className="text-[14px] text-slate-300 leading-relaxed">{report.resolutionProof.actionTaken}</p>
          {report.resolutionProof.resolvedAt && (
            <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
              <Clock size={12} /> {timeLabel(report.resolutionProof.resolvedAt)}
            </p>
          )}
        </div>
      )}



      {/* Grouped evidence */}
      {linkedSituation && situationReports.length > 1 && (
        <div className="pt-2">
          <p className="section-eyebrow mb-2">{t("detail.groupedEvidence")} ({situationReports.length})</p>
          <p className="text-[13px] text-slate-500 mb-3">
            {t("situation.groupedNearbyEvidence")}
          </p>

          <div className="grid grid-cols-1 gap-2">
            {situationReports.map((item) => {
              const selected = item.id === report.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectReport?.(item)}
                  className={`w-full rounded-xl p-3 flex gap-3 text-left border transition ${
                    selected ? "border-accent/50 bg-accent/5" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="h-14 w-14 overflow-hidden rounded-lg shrink-0">
                    <PhotoEvidence src={reportPhotoUrl(item)} decorative variant="thumb" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusPill status={item.status} />
                      {selected && <span className="text-[10px] text-accent font-bold">{t("common.current").toUpperCase()}</span>}
                    </div>
                    <p className="text-[13px] text-white font-semibold truncate mt-1">
                      {pollutionLabel(item.gemini.pollution_type)}
                    </p>
                    <p className="text-[12px] text-slate-500 truncate">
                      {item.areaText}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Trust & ML Details (collapsible) */}
      <div>
        <button className="collapse-toggle" onClick={() => setShowDetails(v => !v)}>
          <span>{t("detail.verificationDetails")}</span>
          <ChevronDown size={15} className={`transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`} />
        </button>
        {showDetails && (
          <div className="mt-2 rounded-xl p-4 space-y-2.5 text-[13px]"
               style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
            {[
              [t("detail.evidenceScore"), `${report.evidenceScore}/100`],
              [t("detail.imageCheck"), report.gemini.image_quality || t("common.unknown")],
              [t("detail.verification"), report.gemini.confidence ? `${Math.round(report.gemini.confidence)}%` : "—"],
              ...(officer ? [[t("detail.secondPass"), report.gemini.second_pass_used ? t("detail.used") : t("detail.notNeeded")]] : [])
            ].map(([label, value]) => (
              <div key={label} className="detail-row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2.5 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        {onViewMap && (
          <button className="ghost-button" onClick={onViewMap}>
            <MapPinned size={14} /> {t("detail.viewOnMap")}
          </button>
        )}
      </div>
    </div>
  );
}
