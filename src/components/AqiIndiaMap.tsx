import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Gauge, Layers, LocateFixed, MapPinned, RotateCw } from "lucide-react";
import type { AirQualityMapMetric, AirQualityMapPoint, AirQualityMapResponse, PollutionReport } from "../types";
import { hasGoogleMapsKey } from "../services/env";
import { loadGoogleMaps } from "../services/googleMapsLoader";
import { distanceMeters } from "../utils/geo";

const metrics: { key: AirQualityMapMetric; label: string }[] = [
  { key: "aqi", label: "AQI" },
  { key: "PM2.5", label: "PM2.5" },
  { key: "PM10", label: "PM10" },
  { key: "NO2", label: "NO2" },
  { key: "SO2", label: "SO2" },
  { key: "CO", label: "CO" },
  { key: "OZONE", label: "O3" },
  { key: "NH3", label: "NH3" }
];

const aqiBands = [
  { max: 50, color: "#24e0a6", label: "Good" },
  { max: 100, color: "#a3e635", label: "Satisfactory" },
  { max: 200, color: "#f7c948", label: "Moderate" },
  { max: 300, color: "#fb923c", label: "Poor" },
  { max: 400, color: "#ff5c7a", label: "Very poor" },
  { max: Infinity, color: "#b91c1c", label: "Severe" }
];

const pollutantBands: Record<Exclude<AirQualityMapMetric, "aqi">, number[]> = {
  "PM2.5": [30, 60, 90, 120, 250],
  PM10: [50, 100, 250, 350, 430],
  NO2: [40, 80, 180, 280, 400],
  SO2: [40, 80, 380, 800, 1600],
  CO: [1, 2, 10, 17, 34],
  OZONE: [50, 100, 168, 208, 748],
  NH3: [200, 400, 800, 1200, 1800],
  PB: [0.5, 1, 2, 3, 3.5]
};

const reportColors = {
  low: "#49d5ff",
  watch: "#f7c948",
  resolved: "#24e0a6",
  high: "#fb923c",
  severe: "#ff5c7a"
};

const activeHeatmapStatuses = new Set(["Submitted", "New", "Assigned", "In Progress", "Manual review needed"]);

const DEFAULT_MAP_CENTER = { lat: 18.6298, lng: 73.7997 };

type LayerKey = "officialAqi" | "citizenReports" | "heatmap";
type MapMode = "combined" | "aqi" | "reports" | "heatmap";

const mapModes: { key: MapMode; label: string }[] = [
  { key: "combined", label: "Combined" },
  { key: "aqi", label: "AQI" },
  { key: "reports", label: "Reports" },
  { key: "heatmap", label: "Heatmap" }
];

const defaultLayersByMode: Record<MapMode, Record<LayerKey, boolean>> = {
  combined: { officialAqi: true, citizenReports: true, heatmap: true },
  aqi: { officialAqi: true, citizenReports: false, heatmap: false },
  reports: { officialAqi: false, citizenReports: true, heatmap: false },
  heatmap: { officialAqi: false, citizenReports: false, heatmap: true }
};

const legendByMode: Record<MapMode, { key: LayerKey; label: string; iconClass: string }[]> = {
  combined: [
    { key: "officialAqi", label: "AQI marker", iconClass: "legend-dot-aqi" },
    { key: "citizenReports", label: "Citizen report", iconClass: "legend-dot-report" },
    { key: "heatmap", label: "Heatmap", iconClass: "legend-dot-heat" }
  ],
  aqi: [{ key: "officialAqi", label: "AQI marker", iconClass: "legend-dot-aqi" }],
  reports: [{ key: "citizenReports", label: "Citizen report", iconClass: "legend-dot-report" }],
  heatmap: [
    { key: "heatmap", label: "Heatmap", iconClass: "legend-dot-heat" },
    { key: "citizenReports", label: "Show points", iconClass: "legend-dot-report" }
  ]
};

function reportColor(report: PollutionReport) {
  if (report.status === "Resolved") return reportColors.resolved;
  if (report.priority === "watch") return reportColors.watch;
  if (report.hotspotScore < 35) return reportColors.low;
  return reportColors[report.priority];
}

function severityScore(report: PollutionReport) {
  return { low: 25, medium: 50, high: 78, severe: 100 }[report.gemini.severity];
}

function recencyScore(report: PollutionReport) {
  const ageHours = (Date.now() - new Date(report.createdAt).getTime()) / (60 * 60 * 1000);
  if (ageHours <= 1) return 100;
  if (ageHours <= 6) return 85;
  if (ageHours <= 24) return 70;
  if (ageHours <= 24 * 7) return 40;
  return 15;
}

function heatWeight(report: PollutionReport) {
  return Math.round(
    0.35 * report.evidenceScore +
      0.3 * report.hotspotScore +
      0.2 * severityScore(report) +
      0.15 * recencyScore(report)
  );
}

function heatColors(weight: number) {
  if (weight >= 85) return { core: "rgba(127, 29, 29, 0.62)", mid: "rgba(185, 28, 28, 0.34)" };
  if (weight >= 70) return { core: "rgba(255, 92, 122, 0.52)", mid: "rgba(185, 28, 28, 0.28)" };
  if (weight >= 50) return { core: "rgba(251, 146, 60, 0.46)", mid: "rgba(251, 146, 60, 0.24)" };
  return { core: "rgba(247, 201, 72, 0.38)", mid: "rgba(247, 201, 72, 0.2)" };
}

function includeInHeatmap(report: PollutionReport) {
  return activeHeatmapStatuses.has(report.status);
}

function includeReportMarker(report: PollutionReport) {
  return !["Rejected", "False Report"].includes(report.status);
}

function reportImage(report: PollutionReport) {
  return report.media?.[0]?.displayUrl || report.imageUrl || "/pwa-icon.svg";
}

function colorFor(metric: AirQualityMapMetric, value: number) {
  if (metric === "aqi") return aqiBands.find((band) => value <= band.max)?.color || "#b91c1c";
  const thresholds = pollutantBands[metric];
  const bandIndex = thresholds.findIndex((max) => value <= max);
  return aqiBands[bandIndex === -1 ? aqiBands.length - 1 : bandIndex].color;
}

function categoryFor(metric: AirQualityMapMetric, value: number) {
  if (metric === "aqi") return aqiBands.find((band) => value <= band.max)?.label || "Severe";
  const thresholds = pollutantBands[metric];
  const bandIndex = thresholds.findIndex((max) => value <= max);
  return aqiBands[bandIndex === -1 ? aqiBands.length - 1 : bandIndex].label;
}

function unitFor(metric: AirQualityMapMetric, point?: AirQualityMapPoint) {
  if (metric === "aqi") return "AQI";
  return point?.units[metric] || (metric === "CO" ? "as reported" : "µg/m³");
}

function formatValue(metric: AirQualityMapMetric, value: number, point?: AirQualityMapPoint) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  const unit = unitFor(metric, point);
  return metric === "aqi" ? formatted : `${formatted} ${unit}`;
}

function hasMetric(point: AirQualityMapPoint, metric: AirQualityMapMetric) {
  const value = point.metrics[metric];
  return typeof value === "number" && Number.isFinite(value);
}

function markerElement(point: AirQualityMapPoint, metric: AirQualityMapMetric, selected: boolean, onSelect: () => void) {
  const value = point.metrics[metric] || 0;
  const element = document.createElement("button");
  element.type = "button";
  element.className = `aq-map-marker ${selected ? "aq-map-marker-selected" : ""}`;
  element.style.setProperty("--marker-color", colorFor(metric, value));
  element.title = `${point.label}: ${formatValue(metric, value, point)}`;
  element.innerHTML = `<span>${metric === "aqi" ? Math.round(value) : ""}</span>`;
  element.addEventListener("click", onSelect);
  return element;
}

function reportMarker(report: PollutionReport, onSelect: () => void) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "report-map-marker";
  element.style.setProperty("--report-color", reportColor(report));
  element.title = `${report.id}: ${report.gemini.pollution_type.replace(/_/g, " ")}`;
  element.innerHTML = `<span></span>`;
  element.addEventListener("click", onSelect);
  return element;
}

function heatmapElement(report: PollutionReport) {
  const element = document.createElement("div");
  element.className = "report-heatmap-point";
  const weight = heatWeight(report);
  const colors = heatColors(weight);
  element.style.setProperty("--heat-size", `${Math.max(34, Math.min(96, weight))}px`);
  element.style.setProperty("--heat-opacity", `${Math.max(0.16, Math.min(0.38, weight / 220))}`);
  element.style.setProperty("--heat-core", colors.core);
  element.style.setProperty("--heat-mid", colors.mid);
  element.title = `${report.id}: heat weight ${weight}`;
  return element;
}

function projectedPosition(lat: number, lng: number) {
  return {
    left: `${((lng - 68) / 30) * 100}%`,
    top: `${100 - ((lat - 6) / 31) * 100}%`
  };
}

function FallbackIndiaMap({
  points,
  reports,
  metric,
  selectedId,
  onSelect,
  onRetry,
  message,
  visibleLayers,
  userLocation,
  onSelectReport
}: {
  points: AirQualityMapPoint[];
  reports: PollutionReport[];
  metric: AirQualityMapMetric;
  selectedId?: string;
  onSelect: (point: AirQualityMapPoint) => void;
  onRetry?: () => void;
  message: string;
  visibleLayers: Record<LayerKey, boolean>;
  userLocation?: { lat: number; lng: number };
  onSelectReport: (report: PollutionReport) => void;
}) {
  const visible = points.filter((point) => hasMetric(point, metric)).slice(0, 80);
  const heatReports = reports.filter(includeInHeatmap);
  const markerReports = reports.filter(includeReportMarker);
  return (
    <div className="aq-fallback-map">
      <div className="india-frame">
        {visibleLayers.heatmap && heatReports.map((report) => {
          const weight = heatWeight(report);
          const colors = heatColors(weight);
          return (
          <span
            key={`heat:${report.id}`}
            className="report-heatmap-point"
            style={{
              "--heat-size": `${Math.max(34, Math.min(96, weight))}px`,
              "--heat-opacity": `${Math.max(0.16, Math.min(0.38, weight / 220))}`,
              "--heat-core": colors.core,
              "--heat-mid": colors.mid,
              ...projectedPosition(report.lat, report.lng)
            } as CSSProperties}
          />
        );})}
        {visibleLayers.officialAqi && visible.map((point) => (
          <button
            key={point.id}
            type="button"
            className={`aq-map-marker ${selectedId === point.id ? "aq-map-marker-selected" : ""}`}
            style={{
              "--marker-color": colorFor(metric, point.metrics[metric] || 0),
              ...projectedPosition(point.lat, point.lng)
            } as CSSProperties}
            onClick={() => onSelect(point)}
            title={point.label}
          >
            <span>{metric === "aqi" ? Math.round(point.metrics[metric] || 0) : ""}</span>
          </button>
        ))}
        {visibleLayers.citizenReports && markerReports.map((report) => (
          <button
            key={report.id}
            type="button"
            className="report-map-marker"
            style={{
              "--report-color": reportColor(report),
              ...projectedPosition(report.lat, report.lng)
            } as CSSProperties}
            title={report.id}
            onClick={() => onSelectReport(report)}
          >
            <span />
          </button>
        ))}
        {userLocation && (
          <span className="user-location-marker" style={projectedPosition(userLocation.lat, userLocation.lng)} />
        )}
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-line bg-ink/90 p-3 text-sm text-slate-300 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{message}</span>
          {onRetry && (
            <button className="secondary-button min-h-9 px-3 py-2" onClick={onRetry}>
              <RotateCw size={16} /> Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AqiIndiaMap({
  layer,
  loading,
  error,
  reports,
  onRetry,
  onCapture,
  focusReport
}: {
  layer: AirQualityMapResponse | null;
  loading: boolean;
  error: string | null;
  reports: PollutionReport[];
  onRetry: () => void;
  onCapture?: () => void;
  focusReport?: PollutionReport | null;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<{ panTo: (latLng: { lat: number; lng: number }) => void; setZoom: (zoom: number) => void } | null>(null);
  const markersRef = useRef<unknown[]>([]);
  const listenersRef = useRef<unknown[]>([]);
  const [metric, setMetric] = useState<AirQualityMapMetric>("aqi");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(focusReport?.id);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [localityPoint, setLocalityPoint] = useState<{ lat: number; lng: number; label: string } | undefined>();
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("combined");
  const [visibleLayers, setVisibleLayers] = useState<Record<LayerKey, boolean>>(defaultLayersByMode.combined);
  const points = layer?.points || [];
  const markerReports = useMemo(() => reports.filter(includeReportMarker), [reports]);
  const visiblePoints = useMemo(() => points.filter((point) => hasMetric(point, metric)), [metric, points]);
  const selected = selectedId ? visiblePoints.find((point) => point.id === selectedId) : undefined;
  const selectedReport = reports.find((report) => report.id === selectedReportId);
  const activeHeatReports = useMemo(() => reports.filter(includeInHeatmap), [reports]);
  const localityFocus = selectedReport
    ? { lat: selectedReport.lat, lng: selectedReport.lng, label: selectedReport.areaText }
    : localityPoint || (userLocation ? { ...userLocation, label: "Your location" } : undefined);
  const localityReports = localityFocus
    ? reports
        .map((report) => ({ report, distance: distanceMeters(localityFocus.lat, localityFocus.lng, report.lat, report.lng) }))
        .filter((item) => item.distance <= 500)
        .sort((a, b) => a.distance - b.distance)
    : [];
  const activeLocalityReports = localityReports.filter((item) => activeHeatmapStatuses.has(item.report.status));
  const dominantPollutionType = activeLocalityReports
    .reduce<Record<string, number>>((acc, item) => {
      const label = item.report.gemini.pollution_type.replace(/_/g, " ");
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
  const topPollutionType = Object.entries(dominantPollutionType).sort((a, b) => b[1] - a[1])[0]?.[0] || "No dominant type";
  const maxHotspotScore = localityReports.length ? Math.max(...localityReports.map((item) => item.report.hotspotScore || 0)) : 0;
  const averageEvidenceScore = localityReports.length
    ? Math.round(localityReports.reduce((sum, item) => sum + item.report.evidenceScore, 0) / localityReports.length)
    : 0;
  const latestLocalReport = localityReports
    .map((item) => item.report)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const mapFocus = useMemo(
    () =>
      focusReport
        ? { lat: focusReport.lat, lng: focusReport.lng }
      : userLocation || (markerReports[0] ? { lat: markerReports[0].lat, lng: markerReports[0].lng } : DEFAULT_MAP_CENTER),
    [focusReport, markerReports, userLocation]
  );
  const localZoom = Boolean(focusReport || userLocation || markerReports[0]);
  const modeLabel = mapModes.find((item) => item.key === mapMode)?.label || "Combined";
  const locateMe = () => {
    navigator.geolocation?.getCurrentPosition((position) => {
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      setUserLocation(next);
      setLocalityPoint(undefined);
      setSelectedId(undefined);
      setSelectedReportId(undefined);
      googleMapRef.current?.panTo(next);
      googleMapRef.current?.setZoom(13);
    });
  };
  const toggleLayer = (key: LayerKey) => {
    setVisibleLayers((current) => ({ ...current, [key]: !current[key] }));
  };
  const selectMode = (nextMode: MapMode) => {
    setMapMode(nextMode);
    setVisibleLayers(defaultLayersByMode[nextMode]);
    setModeMenuOpen(false);
    if (nextMode === "aqi") setSelectedReportId(undefined);
    if (nextMode === "reports" || nextMode === "heatmap") setSelectedId(undefined);
  };

  useEffect(() => {
    if (!visiblePoints.length && metric === "aqi") return;
    if (!visiblePoints.length) setSelectedId(undefined);
    if (selectedId && !visiblePoints.some((point) => point.id === selectedId)) setSelectedId(undefined);
  }, [metric, selectedId, visiblePoints]);

  useEffect(() => {
    if (focusReport || userLocation) return;
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(next);
        googleMapRef.current?.panTo(next);
        googleMapRef.current?.setZoom(13);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8000 }
    );
  }, [focusReport, userLocation]);

  useEffect(() => {
    if (!focusReport) return;
    setSelectedReportId(focusReport.id);
    setLocalityPoint({ lat: focusReport.lat, lng: focusReport.lng, label: focusReport.areaText });
    googleMapRef.current?.panTo({ lat: focusReport.lat, lng: focusReport.lng });
    googleMapRef.current?.setZoom(14);
  }, [focusReport]);

  useEffect(() => {
    let cancelled = false;
    markersRef.current.forEach((marker) => {
      (marker as { map?: unknown }).map = null;
      (marker as { setMap?: (map: unknown) => void }).setMap?.(null);
    });
    listenersRef.current.forEach((listener) => {
      (listener as { remove?: () => void }).remove?.();
    });
    markersRef.current = [];
    listenersRef.current = [];

    if (!hasGoogleMapsKey()) {
      setStatus("failed");
      return;
    }
    setStatus("loading");
    loadGoogleMaps()
      .then(({ Map, Circle, AdvancedMarkerElement }) => {
        if (cancelled || !mapRef.current) return;
        const map = new Map(mapRef.current, {
          center: mapFocus,
          zoom: localZoom ? 13 : 11,
          restriction: {
            latLngBounds: { north: 37.5, south: 6, west: 67, east: 98 },
            strictBounds: false
          },
          clickableIcons: false,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          mapId: "cleanair-local-sentinel"
        });
        googleMapRef.current = map;

        if (visibleLayers.officialAqi) visiblePoints.forEach((point) => {
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: point.lat, lng: point.lng },
            content: markerElement(point, metric, selected?.id === point.id, () => {
              setSelectedReportId(undefined);
              setSelectedId(point.id);
              setLocalityPoint({ lat: point.lat, lng: point.lng, label: point.label });
            }),
            title: point.label
          });
          markersRef.current.push(marker);
        });

        if (visibleLayers.heatmap) activeHeatReports.forEach((report) => {
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: report.lat, lng: report.lng },
            content: heatmapElement(report),
            title: `${report.id} heatmap`
          });
          markersRef.current.push(marker);
        });

        if (visibleLayers.citizenReports) markerReports.forEach((report) => {
          const marker = new AdvancedMarkerElement({
            map,
            position: { lat: report.lat, lng: report.lng },
            content: reportMarker(report, () => {
              setSelectedId(undefined);
              setSelectedReportId(report.id);
              setLocalityPoint({ lat: report.lat, lng: report.lng, label: report.areaText });
              googleMapRef.current?.panTo({ lat: report.lat, lng: report.lng });
              googleMapRef.current?.setZoom(14);
            }),
            title: `${report.id}: ${report.areaText}`
          });
          markersRef.current.push(marker);
        });

        if (userLocation) {
          [150, 250, 500].forEach((radius) => {
            const circle = new Circle({
              map,
              center: userLocation,
              radius,
              strokeColor: radius === 500 ? "#49d5ff" : "#24e0a6",
              strokeOpacity: 0.75,
              strokeWeight: 1,
              fillColor: "#24e0a6",
              fillOpacity: radius === 500 ? 0.04 : 0.025
            });
            markersRef.current.push(circle);
          });
          const marker = new AdvancedMarkerElement({
            map,
            position: userLocation,
            content: (() => {
              const element = document.createElement("div");
              element.className = "user-location-marker";
              return element;
            })(),
            title: "Your location"
          });
          markersRef.current.push(marker);
        }

        const listener = map.addListener?.("click", (event: { latLng?: { lat: () => number; lng: () => number } }) => {
          if (!event.latLng) return;
          setSelectedId(undefined);
          setSelectedReportId(undefined);
          setLocalityPoint(undefined);
        });
        if (listener) listenersRef.current.push(listener);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      googleMapRef.current = null;
      markersRef.current.forEach((marker) => {
        (marker as { map?: unknown }).map = null;
        (marker as { setMap?: (map: unknown) => void }).setMap?.(null);
      });
      listenersRef.current.forEach((listener) => {
        (listener as { remove?: () => void }).remove?.();
      });
      markersRef.current = [];
      listenersRef.current = [];
    };
  }, [activeHeatReports, focusReport, localZoom, mapFocus, markerReports, metric, selected?.id, userLocation, visibleLayers, visiblePoints]);

  return (
    <section className="aq-map-shell">
      <div className="aq-map-header">
        <div>
          <span className="eyebrow">Live local map</span>
          <h1>Local Pollution Intelligence Map</h1>
          <p>View nearby reports, AQI context, and local pollution intensity.</p>
        </div>
        <div className="aq-map-stat">
          <Gauge size={18} />
          <span>
            Local reports
            <strong>{reports.length} captured</strong>
          </span>
        </div>
      </div>

      <div className={`aq-map-stage ${onCapture ? "aq-map-stage-capture" : ""}`}>
        {(status === "ready" || status === "loading") && (
          <>
            <div ref={mapRef} className="aq-google-map" />
            {(status === "loading" || loading) && <div className="map-loading-strip">Loading live air-quality layer...</div>}
          </>
        )}
        {status === "failed" && (
          <FallbackIndiaMap
            points={visiblePoints}
            reports={reports}
            metric={metric}
            selectedId={selected?.id}
            onSelect={(point) => {
              setSelectedReportId(undefined);
              setSelectedId(point.id);
            }}
            onRetry={hasGoogleMapsKey() ? onRetry : undefined}
            visibleLayers={visibleLayers}
            userLocation={userLocation}
            onSelectReport={(report) => {
              setSelectedId(undefined);
              setSelectedReportId(report.id);
              setLocalityPoint({ lat: report.lat, lng: report.lng, label: report.areaText });
            }}
            message={
              hasGoogleMapsKey()
                ? "Google map temporarily unavailable. Live AQI points are still shown in a simplified India view."
                : "Google Maps browser key is not configured. Live AQI points are shown in a simplified India view."
            }
          />
        )}

        <div className={`view-mode-menu ${modeMenuOpen ? "view-mode-menu-open" : ""}`}>
          <button type="button" className="view-mode-button" onClick={() => setModeMenuOpen((value) => !value)}>
            <Layers size={16} /> View: {modeLabel}
          </button>
          {modeMenuOpen && (
            <div className="view-mode-panel">
              {mapModes.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={item.key === mapMode ? "view-mode-option view-mode-option-active" : "view-mode-option"}
                  onClick={() => selectMode(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="map-locate-button" onClick={locateMe} title="Use current location">
          <LocateFixed size={18} />
        </button>

        <div className="local-map-legend">
          {legendByMode[mapMode].map((item) => (
            <button
              key={item.key}
              type="button"
              className={visibleLayers[item.key] ? "legend-toggle legend-toggle-active" : "legend-toggle"}
              onClick={() => toggleLayer(item.key)}
              aria-pressed={visibleLayers[item.key]}
            >
              <i className={item.iconClass} /> {item.label}
            </button>
          ))}
        </div>

        {selectedReport ? (
          <div className="local-report-drawer">
            <img src={reportImage(selectedReport)} alt="" />
            <div>
              <span className="drawer-source">Citizen report</span>
              <h2>{selectedReport.id}</h2>
              <p className="capitalize">{selectedReport.gemini.pollution_type.replace(/_/g, " ")}</p>
              <div className="drawer-meta">
                <span>{selectedReport.trustLevel}</span>
                <span>Evidence {selectedReport.evidenceScore}</span>
                <span>{selectedReport.status}</span>
                <span>{new Date(selectedReport.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            </div>
            <div className="local-dashboard">
              <span>Local area</span>
              <strong>{localityFocus?.label || selectedReport.areaText}</strong>
              <p>{localityReports.length} report(s) in 500m - {activeLocalityReports.length} active hotspot(s)</p>
              <p>Top type: {topPollutionType}. Latest: {latestLocalReport?.id || "none"}</p>
              <p>AQI context: {selectedReport.airQuality.category || selectedReport.airQuality.provider}</p>
              <p>Action recommendation: prioritize visible high-risk clusters and verify source control safely.</p>
            </div>
          </div>
        ) : selected ? (
          <div className="aq-detail-drawer">
            <div>
              <span className="drawer-source">{selected.sourceLabel}</span>
              <h2>{selected.label}</h2>
              <p>{selected.city || selected.state || selected.category || "India"}</p>
            </div>
            <div className="drawer-reading">
              <strong>{formatValue(metric, selected.metrics[metric] || 0, selected)}</strong>
              <span>{categoryFor(metric, selected.metrics[metric] || 0)}</span>
            </div>
            <div className="drawer-meta">
              {selected.dominantPollutant && <span>Dominant {selected.dominantPollutant.toUpperCase()}</span>}
              {selected.lastUpdate && <span>Updated {selected.lastUpdate}</span>}
              <span>{selected.provider === "openaq" ? "OpenAQ monitoring station" : selected.provider === "fused_measured" ? "Matched CPCB + OpenAQ station" : "CPCB/data.gov.in"}</span>
            </div>
          </div>
        ) : null}

        {onCapture && (
          <button type="button" className="capture-fab" onClick={onCapture}>
            Capture Report
          </button>
        )}

        {!visiblePoints.length && !loading && (
          <div className="empty-map-state">
            <MapPinned size={20} />
            <span>No usable {metrics.find((item) => item.key === metric)?.label} readings returned for this layer.</span>
          </div>
        )}
      </div>

      {(error || layer) && (
        <div className="aq-map-footer">
          <span>
            <LocateFixed size={15} />
            {error || `${layer?.cpcbReason || "CPCB unavailable"} · ${layer?.openAqReason || "OpenAQ unavailable"}`}
          </span>
          <button type="button" className="secondary-button min-h-9 px-3 py-2" onClick={onRetry}>
            <RotateCw size={16} /> Refresh
          </button>
        </div>
      )}
    </section>
  );
}
