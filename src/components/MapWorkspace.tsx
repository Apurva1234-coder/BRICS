import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import type { AqiForecastResult, PollutionReport, PollutionSituation, StateForecastResponse } from "../types";
import { SituationRail } from "./SituationRail";
import { SituationDetailDrawer } from "./SituationDetailDrawer";
import { ReportDetailPanel } from "./ReportDetailPanel";
import { LocalLeafletMap, type PublicMapMode } from "./LocalLeafletMap";
import { apiClient } from "../services/apiClient";
import { useTranslation } from "react-i18next";
import { X, TrendingUp, TrendingDown, Minus, Wind, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { aqiCategory, aqiColor, getForecastDisplayState, isFiniteNonNegative } from "../services/airQualityDisplay";

interface MapWorkspaceProps {
  reports: PollutionReport[];
  situations: PollutionSituation[];
  mapLayer: any;
  loadingMap: boolean;
  mapError: string | null;
  onRetryMap: () => void;
  onNavigate: (route: any) => void;
  focusReport?: PollutionReport | null;
}

type TrendDir = "rising" | "falling" | "stable" | "unknown";

function riskColor(risk?: AqiForecastResult["spikeRisk"]) {
  if (risk === "severe") return "#ef4444";
  if (risk === "high") return "#f97316";
  if (risk === "medium") return "#eab308";
  if (risk === "low") return "#00e07a";
  return "#64748b";
}

function TrendIcon({ trend }: { trend: TrendDir }) {
  if (trend === "rising") return <TrendingUp size={12} className="text-orange-400" />;
  if (trend === "falling") return <TrendingDown size={12} className="text-emerald-400" />;
  if (trend === "stable") return <Minus size={12} className="text-slate-400" />;
  return <Wind size={12} className="text-slate-500" />;
}

/** Nominatim reverse geocode — free, no key required */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { "Accept-Language": "en" }, signal: controller.signal }
    );
    if (!res.ok) return "Unknown area";
    const data = await res.json();
    const a = data?.address ?? {};
    return (
      a.city || a.town || a.village || a.county || a.state_district || a.state || "Unknown area"
    );
  } catch {
    return "Unknown area";
  } finally {
    window.clearTimeout(timeout);
  }
}

function LiveForecastWidget({
  mapCenter
}: {
  mapCenter: { lat: number; lng: number };
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language || "en";
  const [forecast, setForecast] = useState<AqiForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [areaName, setAreaName] = useState<string>("");
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCenterRef = useRef<string>("");

  const fetchForecast = useCallback((lat: number, lng: number) => {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    if (key === lastCenterRef.current) return;
    lastCenterRef.current = key;
    setLoading(true);
    // Fetch forecast + area name in parallel
    Promise.all([
      apiClient.getForecast({ lat, lng }),
      reverseGeocode(lat, lng)
    ])
      .then(([result, name]) => {
        setForecast(result);
        setAreaName(name);
      })
      .catch(() => setForecast(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const isFirst = lastCenterRef.current === "";
    timerRef.current = setTimeout(() => {
      fetchForecast(mapCenter.lat, mapCenter.lng);
    }, isFirst ? 0 : 900);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mapCenter, fetchForecast]);

  const aqi = forecast?.latestAvailableAqi;
  const provider = forecast?.provider;
  const isLocalForecast = provider === "locally_forecast";
  const peakAqi = forecast?.peakAqi;
  const trend = (forecast?.trend ?? "unknown") as TrendDir;
  const risk = forecast?.spikeRisk;
  const predictions = forecast?.predictions ?? {};
  const category = aqiCategory(aqi);
  const display = getForecastDisplayState(forecast);

  // Trend label in current language
  const trendLabel: Record<TrendDir, string> = {
    rising: language === "hi" ? "बढ़ रहा" : language === "mr" ? "वाढत आहे" : "Rising",
    falling: language === "hi" ? "घट रहा" : language === "mr" ? "कमी होत आहे" : "Falling",
    stable: language === "hi" ? "स्थिर" : language === "mr" ? "स्थिर" : "Stable",
    unknown: "–"
  };

  if (loading && !forecast) return null;
  if (!forecast || !display.available) return null;

  return (
    <div className="w-[300px] rounded-2xl border border-white/[0.08] bg-slate-950/97 shadow-2xl backdrop-blur-xl overflow-hidden"
      style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)" }}>

      {/* ── Header ── */}
      <button
        className="w-full flex items-start justify-between gap-3 px-4 pt-3 pb-2.5 hover:bg-white/[0.03] transition-colors text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* AQI circle */}
          <div
            className="shrink-0 h-11 w-11 rounded-xl flex flex-col items-center justify-center text-black"
            style={{ background: aqiColor(aqi) }}
          >
            <span className="text-[14px] font-black leading-none">{aqi ?? "–"}</span>
            <span className="text-[8px] font-bold leading-none opacity-70 mt-0.5">AQI</span>
          </div>
          <div className="min-w-0">
            {/* Area name */}
            <div className="flex items-center gap-1 mb-0.5">
              <MapPin size={10} className="text-slate-500 shrink-0" />
              <p className="text-[11px] text-slate-400 font-medium truncate">{areaName || "…"}</p>
            </div>
            <p className="text-[13px] font-bold text-white leading-tight">
              {language === "hi" ? "24 घंटे पूर्वानुमान" : language === "mr" ? "२४ तास अंदाज" : "24h Forecast"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TrendIcon trend={trend} />
              <span className="text-[10px] text-slate-500">{trendLabel[trend]}</span>
              <span className="text-[9px] text-slate-600">·</span>
              <span className="text-[10px]" style={{ color: aqiColor(aqi) }}>{category}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pt-1">
          {risk && risk !== "unknown" && (
            <span
              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full tracking-wide"
              style={{ color: riskColor(risk), background: riskColor(risk) + "22", border: `1px solid ${riskColor(risk)}33` }}
            >
              {risk === "severe" ? (language === "hi" ? "गंभीर" : language === "mr" ? "गंभीर" : "Severe")
                : risk === "high" ? (language === "hi" ? "उच्च" : language === "mr" ? "उच्च" : "High")
                : risk === "medium" ? (language === "hi" ? "मध्यम" : language === "mr" ? "मध्यम" : "Medium")
                : (language === "hi" ? "कम" : language === "mr" ? "कमी" : "Low")}
            </span>
          )}
          {expanded
            ? <ChevronDown size={13} className="text-slate-500" />
            : <ChevronUp size={13} className="text-slate-500" />}
        </div>
      </button>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 space-y-3">

          {/* Hourly bar chart */}
          {isLocalForecast && display.hourlyValues.length > 0 && (
            <div className="pt-3">
              <p className="text-[9px] text-slate-500 font-bold mb-2 uppercase tracking-widest">
                {language === "hi" ? "प्रति घंटे AQI (24 घंटे)" : language === "mr" ? "तासानुसार AQI (२४ तास)" : "Hourly AQI — 24 hours"}
              </p>
              <div className="flex items-end gap-[1.5px] h-14 rounded-lg overflow-hidden">
                {display.hourlyValues.slice(0, 24).map((h, i) => {
                  if (!isFiniteNonNegative(h.aqi)) return null;
                  const pct = Math.max(6, Math.min(100, (h.aqi / 300) * 100));
                  const hour = new Date(h.dateTime).toLocaleTimeString([], { hour: "2-digit", hour12: false });
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm cursor-default transition-opacity hover:opacity-80"
                      style={{ height: `${pct}%`, background: aqiColor(h.aqi), opacity: i === 0 ? 1 : 0.75 + (i / 24) * 0.25 }}
                      title={`${hour}: AQI ${h.aqi ?? "–"} (${aqiCategory(h.aqi ?? undefined)})`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-slate-600 mt-1 px-0.5">
                <span>{language === "hi" ? "अभी" : language === "mr" ? "आत्ता" : "Now"}</span>
                <span>+24h</span>
              </div>
            </div>
          )}

          {/* Prediction grid */}
          <div className={`grid gap-1.5 ${display.availableHorizons.length > 2 ? "grid-cols-4" : "grid-cols-2"}`}>
            {display.availableHorizons.map(h => (
              <div key={h} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-2.5 text-center">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wide">{h}</p>
                <p className="text-[15px] font-black mt-1 leading-none" style={{ color: aqiColor(predictions[h]) }}>
                  {predictions[h]}
                </p>
                <p className="text-[8px] mt-0.5 leading-none" style={{ color: aqiColor(predictions[h]), opacity: 0.7 }}>
                  {aqiCategory(predictions[h]).split(" ")[0]}
                </p>
              </div>
            ))}
          </div>

          {/* Peak row */}
          {isFiniteNonNegative(peakAqi) && (
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] text-slate-500">
                {language === "hi" ? "शीर्ष AQI" : language === "mr" ? "शिखर AQI" : "Peak AQI"}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: aqiColor(peakAqi) }} />
                <span className="text-[11px] font-bold" style={{ color: aqiColor(peakAqi) }}>{peakAqi}</span>
                <span className="text-[9px] text-slate-600">({aqiCategory(peakAqi)})</span>
              </div>
            </div>
          )}

          {/* Source */}
          <p className="text-[9px] text-slate-700 leading-relaxed">
            {isLocalForecast
              ? (language === "hi" ? "स्रोत: OpenAQ स्टेशन इतिहास पर आधारित स्थानीय सांख्यिकीय अनुमान" : language === "mr" ? "स्रोत: OpenAQ स्टेशन इतिहासावर आधारित स्थानिक सांख्यिकीय अंदाज" : "Source: local statistical prediction from OpenAQ station history")
              : forecast.sourceNote}
          </p>
        </div>
      )}
    </div>
  );
}


export function MapWorkspace({
  reports,
  situations,
  mapLayer,
  loadingMap,
  mapError,
  onRetryMap,
  onNavigate,
  focusReport
}: MapWorkspaceProps) {
  const { t } = useTranslation();
  const [selectedSituation, setSelectedSituation] = useState<PollutionSituation | null>(null);
  const [selectedReport, setSelectedReport] = useState<PollutionReport | null>(focusReport ?? null);
  const [mapMode, setMapMode] = useState<PublicMapMode>("global");
  const [activeFilter, setActiveFilter] = useState("All");
  // Seed with India default so forecast fetches immediately on mount.
  // MapViewTracker updates this as the user pans.
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(
    { lat: 22.9734, lng: 78.6569 }
  );
  
  const [showStateForecast, setShowStateForecast] = useState(true);
  const [stateForecasts, setStateForecasts] = useState<StateForecastResponse | null>(null);
  const [stateForecastLoading, setStateForecastLoading] = useState(false);
  const [stateForecastError, setStateForecastError] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const detailOpenerRef = useRef<HTMLElement | null>(null);

  // Auto-load state forecasts on mount; refresh when force-toggled while null
  useEffect(() => {
    if (showStateForecast && !stateForecasts && !stateForecastLoading && !stateForecastError) {
      setStateForecastLoading(true);
      apiClient.getStateForecasts()
        .then(setStateForecasts)
        .catch(err => {
          setStateForecastError(true);
          if (err.message?.includes("Backend unavailable")) {
            setGlobalError(err.message);
          }
        })
        .finally(() => setStateForecastLoading(false));
    }
  }, [showStateForecast, stateForecasts, stateForecastLoading, stateForecastError]);

  const linkedReports = useMemo(() => {
    if (!selectedSituation) return [];
    return reports.filter((r) => selectedSituation.reportIds.includes(r.id));
  }, [selectedSituation, reports]);

  const reportSituation = useMemo(() => {
    if (!selectedReport) return null;
    return situations.find((s) => s.reportIds.includes(selectedReport.id)) ?? null;
  }, [selectedReport, situations]);

  const selectedReportSituationReports = useMemo(() => {
    if (!reportSituation) return selectedReport ? [selectedReport] : [];
    return reports.filter((r) => reportSituation.reportIds.includes(r.id));
  }, [reportSituation, selectedReport, reports]);

  const handleSelectSituation = (sit: PollutionSituation | null) => {
    if (sit && document.activeElement instanceof HTMLElement) detailOpenerRef.current = document.activeElement;
    setSelectedSituation(sit);
    setSelectedReport(null);
  };
  const handleSelectReport = (rep: PollutionReport | null) => {
    setSelectedReport(rep);
    setSelectedSituation(null);
  };

  const hasDetail = !!(selectedSituation || selectedReport);
  const isAirMode = mapMode === "air";
  const closeDetails = useCallback(() => {
    setSelectedSituation(null);
    setSelectedReport(null);
    requestAnimationFrame(() => detailOpenerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!hasDetail) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDetails();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDetails, hasDetail]);

  return (
    // Outer: LEFT RAIL | MAP | RIGHT DRAWER
    <div className="relative flex h-full min-h-0 w-full overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Left workspace rail / Mobile Bottom Sheet ── */}
      <div className={`
          absolute bottom-0 w-full max-h-[45svh] z-[500]
          rounded-t-3xl border-t border-white/10 bg-[#070b0a]/95 backdrop-blur overflow-hidden flex flex-col
          lg:relative lg:max-h-full lg:w-[300px] 2xl:w-[380px] lg:z-10 lg:rounded-none lg:border-none lg:bg-[rgba(10,11,15,0.95)] lg:backdrop-blur-xl lg:border-r lg:border-[var(--border)]
          ${isAirMode ? "hidden" : ""}
        `}>
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <SituationRail
            situations={situations}
            totalReports={reports.length}
            selectedSituation={selectedSituation}
            onSelectSituation={handleSelectSituation}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
            onReportClick={() => onNavigate("capture")}
          />
        </div>
      </div>

      {/* ── Center map canvas — fills remaining space ── */}
      <div className="relative flex-1 h-full min-h-0 min-w-0">
        {globalError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-xl backdrop-blur-md border border-red-400 text-sm font-medium flex items-center gap-3">
            <span className="flex-shrink-0">⚠️</span>
            {globalError}
          </div>
        )}
          <LocalLeafletMap
            layer={mapLayer}
            loading={loadingMap}
            error={mapError}
            reports={reports}
            situations={situations}
            selectedSituation={selectedSituation}
            selectedReport={selectedReport}
            onRetry={onRetryMap}
            onCapture={() => onNavigate("capture")}
            onSelectSituation={handleSelectSituation}
            onSelectReport={handleSelectReport}
            onMapCenterChange={setMapCenter}
            stateForecasts={showStateForecast ? stateForecasts : null}
            onModeChange={setMapMode}
          />

          {/* ── Live 24h Forecast widget — bottom-left overlay ── */}
          {!isAirMode && (
            <div className="absolute bottom-4 left-4 z-[450] mb-[calc(8px+env(safe-area-inset-bottom))] lg:mb-0">
              <LiveForecastWidget mapCenter={mapCenter} />
            </div>
          )}
      </div>

      {/* ── Right drawer: responsive, slides in when detail selected ── */}
      {hasDetail && (
        <div
          className="
            fixed inset-0 z-[999] bg-[#070806]
            lg:absolute lg:inset-y-0 lg:right-0 lg:z-[700] lg:w-[380px] lg:h-full lg:bg-[rgba(10,11,15,0.97)] lg:border-l lg:border-[var(--border)] lg:shadow-[-12px_0_40px_rgba(0,0,0,0.5)]
            2xl:relative 2xl:inset-auto 2xl:z-10 2xl:w-[440px] 2xl:flex-shrink-0
            animate-slide-in-right overflow-hidden
          "
        >
          {/* Close */}
          <div className="absolute top-4 right-4 z-[1000]">
            <button
              onClick={closeDetails}
              className="icon-button min-h-11 min-w-11 bg-black/70"
              aria-label={t("common.close")}
            >
              <X size={16} />
            </button>
          </div>

          <div className="h-full overflow-y-auto hide-scrollbar px-4 lg:px-5 pt-12 lg:pt-5 pb-6">
            {selectedSituation ? (
              <SituationDetailDrawer
                situation={selectedSituation}
                linkedReports={linkedReports}
                onClose={closeDetails}
                onViewOfficer={() => onNavigate("admin")}
                onViewReport={handleSelectReport}
              />
            ) : selectedReport ? (
              <ReportDetailPanel
                report={selectedReport}
                linkedSituation={reportSituation}
                situationReports={selectedReportSituationReports}
                onSelectReport={handleSelectReport}
                onClose={closeDetails}
                onViewMap={closeDetails}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
