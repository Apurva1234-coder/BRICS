import { AlertCircle, CheckCircle2, ShieldCheck, FileText, X, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AqiForecastResult, CpcbLocalContext, CpcbPollutantCode, PollutionReport, PollutionSituation } from "../types";
import { PhotoEvidence } from "./PhotoEvidence";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { StatusPill } from "./StatusPill";
import { reportPhotoUrl, resolveMediaUrl } from "../utils/mediaUrl";
import { apiClient } from "../services/apiClient";
import { ForecastPanel } from "./ForecastPanel";
import { CpcbContextPanel } from "./CpcbContextPanel";

interface SituationDetailDrawerProps {
  situation: PollutionSituation;
  linkedReports?: PollutionReport[];
  onClose: () => void;
  onViewOfficer?: () => void;
  onViewReport?: (report: PollutionReport) => void;
}

function pollutionLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(diff / 60000)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: "var(--critical)",
  high:     "var(--high)",
  moderate: "var(--moderate)",
  low:      "var(--low)",
};

export function SituationDetailDrawer({
  situation,
  linkedReports = [],
  onClose,
  onViewOfficer,
  onViewReport
}: SituationDetailDrawerProps) {
  const { t } = useTranslation();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [forecast, setForecast] = useState<AqiForecastResult | undefined>();
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [cpcbContext, setCpcbContext] = useState<CpcbLocalContext | undefined>();
  const color = PRIORITY_COLOR[situation.priority] ?? PRIORITY_COLOR.low;
  const availableSituationPhotos = useMemo(() => {
    const candidates = [...situation.photoUrls, ...linkedReports.map(reportPhotoUrl)];
    const seen = new Set<string>();
    return candidates.reduce<string[]>((photos, candidate) => {
      const url = resolveMediaUrl(candidate);
      if (!url || seen.has(url)) return photos;
      seen.add(url);
      photos.push(url);
      return photos;
    }, []);
  }, [linkedReports, situation.photoUrls]);

  const preferredPollutants: CpcbPollutantCode[] =
    situation.dominantPollutionType === "construction_dust" || situation.dominantPollutionType === "road_dust"
      ? ["PM10", "PM2.5"]
      : situation.dominantPollutionType === "vehicle_smoke"
        ? ["NO2", "CO", "PM2.5"]
        : situation.dominantPollutionType === "industrial_smoke" || situation.dominantPollutionType === "garbage_burning"
          ? ["PM2.5", "PM10", "SO2"]
          : ["PM2.5", "PM10", "NO2", "SO2", "CO"];

  // suppress unused warning — onClose used by parent
  void onClose;

  useEffect(() => {
    let cancelled = false;
    setForecast(undefined);
    setForecastError(null);
    apiClient
      .getForecast({ lat: situation.centerLat, lng: situation.centerLng })
      .then((value) => {
        if (!cancelled) setForecast(value);
      })
      .catch((error) => {
        if (!cancelled) setForecastError(error instanceof Error ? error.message : "Unable to load 24-hour forecast.");
      });
    return () => { cancelled = true; };
  }, [situation.centerLat, situation.centerLng]);

  useEffect(() => {
    setActivePhotoIdx(0);
  }, [situation.id]);

  useEffect(() => {
    setActivePhotoIdx((index) => Math.min(index, Math.max(availableSituationPhotos.length - 1, 0)));
  }, [availableSituationPhotos.length]);

  useEffect(() => {
    let cancelled = false;
    setCpcbContext(undefined);
    apiClient
      .getCpcbLocalContext({ lat: situation.centerLat, lng: situation.centerLng, radiusKm: 25 })
      .then((context) => {
        if (!cancelled) setCpcbContext(context);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [situation.centerLat, situation.centerLng]);

  return (
    <div className="space-y-5 animate-slide-in-right">

      {/* Large photo — always first */}
      <div className="overflow-hidden lg:rounded-2xl -mx-4 lg:-mx-5 -mt-12 lg:-mt-5">
        {availableSituationPhotos.length > 0 ? (
          <PhotoEvidence
            src={availableSituationPhotos[activePhotoIdx]}
            alt={situation.placeLabel}
            variant="main"
            className="w-full aspect-video lg:aspect-auto lg:h-64 object-cover"
          />
        ) : (
          <PhotoEvidence variant="main" className="w-full aspect-video lg:aspect-auto lg:h-52" />
        )}
      </div>

      {/* Photo strip (if multiple) */}
      {availableSituationPhotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mt-2">
          {availableSituationPhotos.map((url, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Evidence photo ${i + 1}`}
              onClick={() => setActivePhotoIdx(i)}
              className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-150
                ${activePhotoIdx === i ? "border-white/60 scale-95" : "border-transparent opacity-40 hover:opacity-80"}`}
            >
              <PhotoEvidence src={url} variant="strip" />
            </button>
          ))}
        </div>
      )}

      {/* Rank + priority + place */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-3">
          <span className="text-[32px] font-black leading-none" style={{ color }}>#{situation.rank}</span>
          <span className="priority-badge capitalize" style={
            situation.priority === "critical" ? { color: "var(--critical)", background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.25)" } :
            situation.priority === "high"     ? { color: "var(--high)",     background: "rgba(249,115,22,0.1)", borderColor: "rgba(249,115,22,0.25)" } :
            situation.priority === "moderate" ? { color: "var(--moderate)", background: "rgba(234,179,8,0.1)",  borderColor: "rgba(234,179,8,0.25)"  } :
                                                { color: "var(--low)",      background: "rgba(100,116,139,0.1)",borderColor: "rgba(100,116,139,0.25)" }
          }>
            {situation.priority}
          </span>
        </div>
        <h2 className="text-[20px] font-bold text-white leading-snug">{situation.placeLabel}</h2>
        <p className="text-[14px] text-slate-400 leading-relaxed">{situation.shortDescription}</p>
        <div className="flex gap-2 p-3 mt-2 rounded-xl text-[13px] text-slate-400" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
          <FileText size={16} className="shrink-0 text-slate-500 mt-0.5" />
          <p className="leading-snug">{t("situation.groupedNearbyEvidence")}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t("nav.capture"), value: situation.reportCount, color: "white" },
          { label: t("common.open"), value: situation.unresolvedCount, color: "var(--moderate)" },
          { label: "Score", value: situation.situationScore, color: "var(--accent)" },
        ].map(({ label, value, color: c }) => (
          <div key={label} className="rounded-xl p-3 text-center"
               style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
            <div className="text-[22px] font-black" style={{ color: c }}>{value}</div>
            <div className="text-[12px] text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-slate-300 capitalize">
          {pollutionLabel(situation.dominantPollutionType)}
        </span>
        <span className="text-slate-600">·</span>
        <span className="text-[13px] text-slate-500">{timeAgo(situation.latestReportAt)}</span>
        <span className="text-slate-600">·</span>
        <span className="text-[13px] text-slate-500 capitalize">{situation.dominantSeverity}</span>
      </div>

      {/* Contextual Intelligence: Recurring Hotspot & Sensitive Locations */}
      {(() => {
        const recurrence = situation.recurrence ?? {
          isRecurringHotspot: false,
          classification: "no_recurring_history",
          recurrenceScore: 0,
          similarIncidentCount: 0,
          verifiedIncidentCount: 0,
          activeIncidentCount: 0,
          radiusMeters: 2000,
          windowDays: 90,
          observedPollutionTypes: [situation.dominantPollutionType],
          explanation: "No historical recurrence detected.",
          reasons: [],
          historicalIncidentIds: []
        };
        const sensitiveLocations = situation.sensitiveLocations ?? {
          hasSensitiveLocations: false,
          impactScore: 0,
          totalCount: 0,
          categoryCounts: { school: 0, hospital: 0, childcare: 0, elderly_care: 0 },
          locations: [],
          primaryImpactRadiusMeters: 1000,
          summary: "No sensitive facilities within 1.0 km.",
          reasons: [],
          affectedFacilitiesSummary: []
        };
        const contextualPriority = situation.contextualPriority;

        return (
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{
              background: "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(59,130,246,0.04))",
              border: "1px solid rgba(249,115,22,0.2)"
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>🔁</span> Contextual Intelligence
              </span>
              {contextualPriority?.priorityElevated && (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Priority Elevated
                </span>
              )}
            </div>

            {/* Recurring Hotspot Details */}
            <div className="flex items-start gap-2 text-[13px]">
              <span className="mt-0.5 text-base leading-none">🔁</span>
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white capitalize">
                    {recurrence.classification.replace(/_/g, " ")}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({recurrence.similarIncidentCount} incident{recurrence.similarIncidentCount === 1 ? "" : "s"} / 2 km / 90d)
                  </span>
                </div>
                <p className="text-[12px] text-slate-400 leading-snug">{recurrence.explanation}</p>
              </div>
            </div>

            {/* Sensitive Locations Details */}
            <div className="flex items-start gap-2 text-[13px] pt-2 border-t border-white/5">
              <span className="mt-0.5 text-base leading-none">🏫</span>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Sensitive Facilities</span>
                  <span className="text-[11px] text-slate-400">
                    {sensitiveLocations.totalCount} within 1 km
                  </span>
                </div>
                <p className="text-[12px] text-slate-400 leading-snug">{sensitiveLocations.summary}</p>
                {sensitiveLocations.locations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {sensitiveLocations.locations.slice(0, 4).map((loc) => (
                      <span
                        key={loc.id}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-300"
                      >
                        <span>{loc.category === "hospital" ? "🏥" : loc.category === "school" ? "🏫" : loc.category === "childcare" ? "👶" : "👵"}</span>
                        <span className="truncate max-w-[120px]">{loc.name}</span>
                        <span className="text-slate-500 font-mono text-[10px]">({loc.distanceMeters}m)</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Why Priority Increased Rationale */}
            {contextualPriority?.elevationReasons && contextualPriority.elevationReasons.length > 0 && (
              <div className="pt-2 border-t border-white/5 space-y-1">
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  Why Priority Escalated:
                </span>
                <ul className="space-y-1 text-[12px] text-slate-300">
                  {contextualPriority.elevationReasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })()}

      {/* Suggested Department Readiness Card */}
      <div className="flex flex-col gap-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Suggested Department</span>
        <span className="text-[14px] font-semibold text-white">
          {situation.dominantPollutionType.includes("garbage") || situation.dominantPollutionType.includes("waste") || situation.dominantPollutionType.includes("dumping") ? "Solid Waste / Sanitation" :
           situation.dominantPollutionType.includes("industrial") ? "Environment Dept / Pollution Control" :
           situation.dominantPollutionType.includes("construction") || situation.dominantPollutionType.includes("dust") ? "Roads / Construction Enforcement" :
           situation.dominantPollutionType.includes("sewage") || situation.dominantPollutionType.includes("stagnant") ? "Drainage / Health Department" :
           situation.dominantPollutionType.includes("vehicle") ? "Traffic / Transport Enforcement" :
           "Environment Department"}
        </span>
      </div>

      {(() => {
        if (!linkedReports || linkedReports.length === 0) return null;
        let pending = 0, ready = 0, unavailable = 0, failed = 0, supported = 0;
        linkedReports.forEach(r => {
          if (r.satelliteEvidence) {
            if (r.satelliteEvidence.status === 'pending' || r.satelliteEvidence.status === 'processing') pending++;
            else if (r.satelliteEvidence.status === 'ready') {
              ready++;
              if (r.satelliteEvidence.evidenceContributionPoints > 0) {
                supported++;
              }
            }
            else if (r.satelliteEvidence.status === 'unavailable') unavailable++;
            else if (r.satelliteEvidence.status === 'failed') failed++;
          }
        });
        
        if (pending === 0 && ready === 0 && unavailable === 0 && failed === 0) return null;

        const unavailableCount = unavailable + failed;
        const citizenEvidence = `${linkedReports.length} citizen evidence report${linkedReports.length === 1 ? "" : "s"}`;
        const satelliteStatus = unavailableCount > 0
          ? `Satellite context is temporarily unavailable for ${unavailableCount} report${unavailableCount === 1 ? "" : "s"}. Citizen evidence and local data remain available.`
          : pending > 0
            ? `Satellite context pending for ${pending} report${pending === 1 ? "" : "s"}.`
            : supported > 0
              ? `Satellite context available for ${supported} report${supported === 1 ? "" : "s"}.`
              : ready > 0
                ? "Satellite context checked; no supporting signal is available."
                : "Satellite context unavailable.";

        return (
          <div className="flex flex-col gap-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{t("satellite.satelliteEvidence")}</span>
            <span className="text-[13px] font-medium text-slate-300">{citizenEvidence}</span>
            <span className="text-[11px] font-medium text-slate-500">{satelliteStatus}</span>
          </div>
        );
      })()}

      <ForecastPanel
        forecast={forecast || (forecastError ? {
          provider: "unavailable",
          predictions: {},
          categories: {},
          trend: "unknown",
          spikeRisk: "unknown",
          spikeReason: forecastError,
          confidenceNote: "Forecast lookup failed for this situation.",
          sourceNote: "Local statistical prediction unavailable because station history could not be loaded.",
          generatedAt: new Date().toISOString(),
          reason: forecastError
        } : undefined)}
        compact
      />

      <CpcbContextPanel
        context={cpcbContext}
        title="CPCB station-derived context"
        preferred={preferredPollutants}
      />

      {/* Effects */}
      {situation.effects.length > 0 && (
        <div>
          <p className="section-eyebrow mb-2 flex items-center gap-1.5">
            <AlertCircle size={12} /> {t("detail.possible_effects")}
          </p>
          <ul className="space-y-1.5">
            {situation.effects.map((effect) => (
              <li key={effect} className="flex items-start gap-2.5 text-[14px] text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--moderate)" }} />
                {effect}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended actions */}
      {situation.recommendedActions.length > 0 && (
        <div>
          <p className="section-eyebrow mb-2 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> {t("detail.recommended_actions")}
          </p>
          <ul className="space-y-1.5">
            {situation.recommendedActions.map((action) => (
              <li key={action} className="flex items-start gap-2.5 text-[14px] text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Linked reports */}
      {linkedReports.length > 0 && (
        <div>
          <p className="section-eyebrow mb-2 flex items-center gap-1.5">
            <FileText size={12} /> Evidence Gallery ({linkedReports.length})
          </p>
          <div className="space-y-2">
            {linkedReports.slice(0, 5).map((report) => (
              <button
                key={report.id}
                onClick={() => onViewReport?.(report)}
                className="w-full rounded-xl flex items-center gap-3 p-3 text-left transition-all duration-150 group"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <div className="overflow-hidden rounded-lg shrink-0">
                  <PhotoEvidence
                    src={resolveMediaUrl(report.media?.[0]?.displayUrl || report.imageUrl)}
                    variant="strip"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusPill status={report.status} />
                  </div>
                  <p className="text-[13px] text-slate-400 truncate mt-0.5">{report.areaText}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Score breakdown — collapsed */}
      <div>
        <button className="collapse-toggle" onClick={() => setShowScores(v => !v)}>
          <span>{t("detail.score_breakdown")}</span>
          <ChevronDown size={15} className={`transition-transform duration-200 ${showScores ? "rotate-180" : ""}`} />
        </button>
        {showScores && (
          <div className="mt-2">
            <ScoreBreakdown scoreBreakdown={situation.scoreBreakdown} situationScore={situation.situationScore} />
          </div>
        )}
      </div>

      {/* Officer link */}
      {onViewOfficer && (
        <div style={{ borderTop: "1px solid var(--border)" }} className="pt-4">
          <button className="ghost-button" onClick={onViewOfficer}>
            <ShieldCheck size={14} /> {t("detail.officer_dashboard")}
          </button>
        </div>
      )}
    </div>
  );
}
