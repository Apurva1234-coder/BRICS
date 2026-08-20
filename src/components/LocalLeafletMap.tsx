import { useEffect, useMemo, useState, useRef, Fragment } from "react";
import { Gauge, Info, LocateFixed, MapPinned, RotateCw, X } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Circle, CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents, Popup, Tooltip } from "react-leaflet";
import { apiClient } from "../services/apiClient";
import { useTranslation } from "react-i18next";
import type {
  AirQualityMapMetric,
  AirQualityMapPoint,
  AirQualityMapResponse,
  AirQualityAqiQuality,
  AqiForecastResult,
  ForecastStationItem,
  ForecastHorizon,
  PollutionReport,
  PollutionSituation
} from "../types";
import { ForecastPanel } from "./ForecastPanel";
import { CpcbLayerPanel } from "./CpcbLayerPanel";
import { formatAge } from "../services/airQualityDisplay";
import { reportPhotoUrl, resolveMediaUrl } from "../utils/mediaUrl";
import { DraggableMobileAqiPanel } from "./DraggableMobileAqiPanel";
import { BRICS_COUNTRIES, type BricsCountry } from "../data/bricsCountries";

export type PublicMapMode = "global" | "situations" | "reports" | "air" | "satellite";
type MapMode = PublicMapMode;
type LayerKey = "regionalAqi" | "localAqi" | "forecastStations" | "citizenReports" | "situations" | "cpcbStations";
type ForecastStationMapPoint = { id: string; stationName: string; lat: number; lng: number };
type MapView = { lat: number; lng: number; zoom: number };

const WORLD_BOUNDS: L.LatLngBoundsExpression = [[-58, -180], [82, 180]];
const BRICS_ISO3 = new Set(["BRA", "RUS", "IND", "CHN", "ZAF", "EGY", "ETH", "IDN", "IRN", "ARE", "SAU"]);
const WORLD_GEOJSON_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";

function BricsBoundaryLayer() {
  const [data, setData] = useState<GeoJSON.GeoJsonObject | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(WORLD_GEOJSON_URL)
      .then((response) => response.ok ? response.json() : null)
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;
  return (
    <GeoJSON
      data={data}
      style={(feature) => {
        const iso = String(feature?.properties?.ISO_A3 || feature?.properties?.ADM0_A3 || "");
        const isBrics = BRICS_ISO3.has(iso);
        return {
          color: isBrics ? "#69e6ae" : "#64748b",
          weight: isBrics ? 1.8 : 0.55,
          opacity: isBrics ? 0.95 : 0.38,
          fillColor: isBrics ? "#1f9d68" : "#273244",
          fillOpacity: isBrics ? 0.32 : 0.12
        };
      }}
      onEachFeature={(feature, layer) => {
        const iso = String(feature?.properties?.ISO_A3 || feature?.properties?.ADM0_A3 || "");
        if (BRICS_ISO3.has(iso)) layer.bindTooltip(String(feature?.properties?.ADMIN || feature?.properties?.NAME || iso));
      }}
    />
  );
}

const DEFAULT_CENTER = { lat: 22.9734, lng: 78.6569, label: "India" };
const forecastHorizons: ForecastHorizon[] = ["1h", "6h", "12h", "24h"];

const mapModes: { key: MapMode; label: string }[] = [
  { key: "global", label: "BRICS Global" },
  { key: "situations", label: "Situations" },
  { key: "reports", label: "Reports" },
  { key: "air", label: "AIR" },
  { key: "satellite", label: "SATELLITE" }
];

const visibleByMode: Record<MapMode, Record<LayerKey, boolean>> = {
  global: { situations: true, regionalAqi: false, localAqi: false, forecastStations: false, citizenReports: true, cpcbStations: true },
  situations: { situations: true, regionalAqi: false, localAqi: false, forecastStations: false, citizenReports: true, cpcbStations: false },
  air: { situations: false, regionalAqi: false, localAqi: false, forecastStations: false, citizenReports: false, cpcbStations: true },
  reports: { situations: false, regionalAqi: false, localAqi: false, forecastStations: false, citizenReports: true, cpcbStations: false }
  ,satellite: { situations: false, regionalAqi: false, localAqi: false, forecastStations: false, citizenReports: false, cpcbStations: false }
};

const legendByMode: Record<MapMode, { key: LayerKey; label: string; iconClass: string }[]> = {
  global: [
    { key: "situations", label: "Pollution hotspot", iconClass: "legend-dot-situation" },
    { key: "citizenReports", label: "Citizen report", iconClass: "legend-dot-report" },
    { key: "cpcbStations", label: "India AQI stations", iconClass: "legend-dot-cpcb" }
  ],
  situations: [
    { key: "situations", label: "Situation risk zone", iconClass: "legend-dot-situation" },
    { key: "citizenReports", label: "Grouped evidence marker", iconClass: "legend-dot-report" }
  ],
  air: [
    { key: "cpcbStations", label: "Monitoring station clusters", iconClass: "legend-dot-cpcb" }
  ],
  reports: [
    { key: "citizenReports", label: "Citizen report", iconClass: "legend-dot-report" }
  ],
  satellite: []
};



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

function hasMetric(point: AirQualityMapPoint, metric: AirQualityMapMetric) {
  const value = point.metrics[metric];
  return typeof value === "number" && Number.isFinite(value);
}

const METRIC_PREFERENCE: AirQualityMapMetric[] = ["aqi", "PM2.5", "PM10", "NO2", "SO2", "CO", "OZONE", "NH3"];

/** Returns the best available metric for a point (aqi preferred, then pollutants). */
function bestMetric(point: AirQualityMapPoint): AirQualityMapMetric | null {
  return METRIC_PREFERENCE.find((m) => hasMetric(point, m)) ?? null;
}

/** Returns true if the point has any useful metric at all. */
function hasAnyMetric(point: AirQualityMapPoint) {
  return METRIC_PREFERENCE.some((m) => hasMetric(point, m));
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
  return point?.units[metric] || (metric === "CO" ? "as reported" : "ug/m3");
}

function formatValue(metric: AirQualityMapMetric, value: number, point?: AirQualityMapPoint) {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return metric === "aqi" ? formatted : `${formatted} ${unitFor(metric, point)}`;
}

function aqiQualityLabel(quality?: AirQualityAqiQuality) {
  if (quality === "rolling_validated") return "Validated rolling AQI";
  if (quality === "indicative") return "Indicative CPCB AQI";
  if (quality === "provider_reported") return "Provider-reported AQI";
  return "AQI unavailable";
}

function isPunePcmcRegion(location: { lat: number; lng: number }) {
  return location.lat >= 18.45 && location.lat <= 18.72 && location.lng >= 73.68 && location.lng <= 73.92;
}

function isDelhiRegion(location: { lat: number; lng: number }) {
  return location.lat >= 28.35 && location.lat <= 28.9 && location.lng >= 76.8 && location.lng <= 77.45;
}

function stationNameFromItem(item: ForecastStationItem) {
  if (typeof item === "string") return item;
  return item.stationName || item.station_name || item.station || item.name || "";
}

function numberFromStationValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function stationCoordsFromItem(item: ForecastStationItem) {
  if (typeof item === "string") return undefined;
  const lat = numberFromStationValue(item.lat ?? item.latitude);
  const lng = numberFromStationValue(item.lng ?? item.longitude);
  if (lat === undefined || lng === undefined) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

function normalizeForecastStation(item: ForecastStationItem): ForecastStationMapPoint | null {
  const stationName = stationNameFromItem(item);
  const coords = stationCoordsFromItem(item);
  if (!stationName || !coords) return null;
  return {
    id: `${stationName}:${coords.lat}:${coords.lng}`,
    stationName,
    ...coords
  };
}

const CPCB_POLLUTANT_PREFERENCE: AirQualityMapMetric[] = [
  "PM2.5",
  "PM10",
  "NO2",
  "SO2",
  "CO",
  "OZONE",
  "NH3",
  "PB"
];

export type CpcbDisplayMetric = "aqi";

function getCpcbDisplayReading(
  point: AirQualityMapPoint,
  selected: CpcbDisplayMetric
): {
  metric: AirQualityMapMetric | null;
  value?: number;
  unit?: string;
  missing: boolean;
} {
  if (!hasMetric(point, selected)) {
    return { metric: selected, missing: true };
  }

  return {
    metric: selected,
    value: point.metrics[selected],
    unit: point.units?.[selected],
    missing: false
  };
}

function cpcbStationMarkerIcon(point: AirQualityMapPoint, selected: boolean) {
  const reading = getCpcbDisplayReading(point, "aqi");

  if (reading.missing || reading.value === undefined || reading.metric === null) return L.divIcon({ className: "", html: "", iconAnchor: [0, 0], iconSize: [0, 0] });

  const color = colorFor(reading.metric, reading.value);
  const label = Number.isInteger(reading.value)
    ? String(Math.round(reading.value))
    : reading.value.toFixed(1);

  return L.divIcon({
    className: "",
    html: `<span class="aq-map-marker cpcb-station-marker${selected ? " aq-map-marker-selected" : ""}${point.aqiStatus?.selected?.quality === "indicative" ? " aq-map-marker-indicative" : ""}" style="--marker-color:${color}">${label}</span>`,
    iconAnchor: [14, 14],
    iconSize: [28, 28]
  });
}

function aqiMarkerIcon(value: number, selected: boolean, local = false, metric: AirQualityMapMetric = "aqi") {
  return L.divIcon({
    className: "",
    html: `<span class="aq-map-marker leaflet-value-marker${local ? " local-aqi-map-marker" : ""}${
      selected ? " aq-map-marker-selected" : ""
    }" style="--marker-color:${colorFor(
      metric,
      value
    )}">${Math.round(value)}</span>`,
    iconAnchor: local ? [12, 12] : [14, 14],
    iconSize: local ? [24, 24] : [28, 28]
  });
}

function aggregateMarkerIcon(value: number, count: number, metric: AirQualityMapMetric) {
  const color = colorFor(metric, value);
  return L.divIcon({
    className: "",
    html: `<div class="aq-map-cluster" style="--marker-color:${color}"><span>×${count}</span></div>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36]
  });
}

type ClusteredPoint = { point: AirQualityMapPoint; count: number; members: AirQualityMapPoint[]; median: number; validated: number; indicative: number; providerReported: number };

function clusteredPoints(points: AirQualityMapPoint[], zoom: number, metric: AirQualityMapMetric): ClusteredPoint[] {
  if (zoom >= 9) return points.map((point) => ({ point, count: 1, members: [point], median: point.metrics[metric]!, validated: point.aqiStatus?.status === "validated_available" ? 1 : 0, indicative: point.aqiStatus?.status === "indicative_available" ? 1 : 0, providerReported: point.aqiStatus?.status === "provider_reported_available" ? 1 : 0 }));
  const cell = zoom <= 5 ? 6 : 1.5;
  const groups = new Map<string, AirQualityMapPoint[]>();
  for (const point of points) {
    const key = `${Math.floor(point.lat / cell)}:${Math.floor(point.lng / cell)}`;
    const members = groups.get(key);
    if (members) members.push(point);
    else groups.set(key, [point]);
  }
  return [...groups.values()].map((members) => {
    const values = members.map((member) => member.metrics[metric]).filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const median = values.length ? values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2 : 0;
    return {
      point: members[0], count: members.length, members, median,
      validated: members.filter((member) => member.aqiStatus?.status === "validated_available").length,
      indicative: members.filter((member) => member.aqiStatus?.status === "indicative_available").length,
      providerReported: members.filter((member) => member.aqiStatus?.status === "provider_reported_available").length
    };
  });
}

function dedupePhysicalStations(points: AirQualityMapPoint[]) {
  const groups = new Map<string, AirQualityMapPoint>();
  for (const point of points) {
    const key = `${point.lat.toFixed(3)}:${point.lng.toFixed(3)}`;
    const previous = groups.get(key);
    if (!previous || (point.provider === "cpcb_data_gov" && previous.provider !== "cpcb_data_gov") || Object.keys(point.metrics).length > Object.keys(previous.metrics).length) groups.set(key, point);
  }
  return [...groups.values()];
}

function StationClusterMarker({ cluster, metric }: { cluster: ClusteredPoint; metric: AirQualityMapMetric }) {
  const map = useMap();
  const value = cluster.median;
  return (
    <Marker
      position={[cluster.point.lat, cluster.point.lng]}
      icon={aggregateMarkerIcon(value, cluster.count, metric)}
      eventHandlers={{ click: () => map.fitBounds(L.latLngBounds(cluster.members.map((member) => [member.lat, member.lng] as [number, number])), { padding: [48, 48], maxZoom: 9, animate: true }) }}
    >
      <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
        ×{cluster.count} monitoring stations · Median AQI {Number.isFinite(value) ? value.toFixed(0) : "unavailable"} · Validated {cluster.validated} · Indicative {cluster.indicative} · Provider-reported {cluster.providerReported}
      </Tooltip>
    </Marker>
  );
}

function forecastMarkerIcon(selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<span class="forecast-map-marker${selected ? " forecast-map-marker-selected" : ""}">F</span>`,
    iconAnchor: [13, 13],
    iconSize: [26, 26]
  });
}

const SITUATION_PRIORITY_COLORS: Record<string, { fill: string; glow: string; ring: string }> = {
  critical: { fill: "#ef4444", glow: "rgba(239,68,68,0.55)",  ring: "rgba(239,68,68,0.2)" },
  high:     { fill: "#f97316", glow: "rgba(249,115,22,0.5)", ring: "rgba(249,115,22,0.18)" },
  moderate: { fill: "#eab308", glow: "rgba(234,179,8,0.5)",  ring: "rgba(234,179,8,0.18)" },
  low:      { fill: "#00e07a", glow: "rgba(0,224,122,0.45)", ring: "rgba(0,224,122,0.15)" }
};

function situationMarkerIcon(situation: PollutionSituation, selected: boolean) {
  const pal = SITUATION_PRIORITY_COLORS[situation.priority] || SITUATION_PRIORITY_COLORS.high;
  const score = Math.min(100, situation.situationScore ?? 50);
  const base = selected ? 52 : Math.max(38, Math.min(52, 34 + score / 8));
  const inner = Math.round(base * 0.62);
  const pulse = selected
    ? `<div style="position:absolute;inset:-${Math.round(base*0.28)}px;border-radius:50%;background:${pal.ring};animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></div>`
    : `<div style="position:absolute;inset:-${Math.round(base*0.18)}px;border-radius:50%;background:${pal.ring};"></div>`;
  return L.divIcon({
    className: "",
    html: `
      <style>
        @keyframes ping{0%{transform:scale(1);opacity:0.7}70%{transform:scale(1.8);opacity:0}100%{transform:scale(1.8);opacity:0}}
        @keyframes glow-pulse{0%,100%{box-shadow:0 0 0 0 ${pal.glow},0 2px 12px ${pal.glow}}50%{box-shadow:0 0 0 6px transparent,0 4px 20px ${pal.glow}}}
      </style>
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${base}px;height:${base}px;">
        ${pulse}
        <div style="
          position:relative;z-index:10;
          width:${base}px;height:${base}px;
          border-radius:50%;
          background:${pal.fill};
          box-shadow:0 0 0 2px rgba(255,255,255,${selected?'0.6':'0.2'}),0 4px 18px ${pal.glow};
          display:flex;align-items:center;justify-content:center;
          animation:glow-pulse 2.4s ease-in-out infinite;
          cursor:pointer;
        ">
          <div style="
            width:${inner}px;height:${inner}px;
            border-radius:50%;
            background:rgba(0,0,0,0.22);
            display:flex;align-items:center;justify-content:center;
            flex-direction:column;
          ">
            <span style="color:#fff;font-size:${selected?11:10}px;font-weight:900;line-height:1;font-family:system-ui,sans-serif;">#${situation.rank}</span>
            <span style="color:rgba(255,255,255,0.72);font-size:7px;font-weight:700;letter-spacing:0.5px;font-family:system-ui,sans-serif;text-transform:uppercase;">${situation.priority.slice(0,3)}</span>
          </div>
        </div>
      </div>
    `,
    iconAnchor: [base / 2, base / 2],
    iconSize: [base, base]
  });
}

type ReportMarkerGroup = {
  id: string;
  lat: number;
  lng: number;
  reports: PollutionReport[];
};

function buildReportMarkerGroups(reports: PollutionReport[]): ReportMarkerGroup[] {
  const cellSize = 0.00025; // roughly 20–30m
  const groups = new Map<string, PollutionReport[]>();

  for (const r of reports) {
    const key = `${Math.round(r.lat / cellSize)}:${Math.round(r.lng / cellSize)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return [...groups.entries()].map(([key, items]) => ({
    id: key,
    lat: items.reduce((s, r) => s + r.lat, 0) / items.length,
    lng: items.reduce((s, r) => s + r.lng, 0) / items.length,
    reports: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }));
}

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markerPhotoHtml(url: string | undefined, color: string) {
  const fallback = `<span style="display:${url ? "none" : "flex"};width:100%;height:100%;align-items:center;justify-content:center;background:${color}22;"><span style="width:8px;height:8px;border-radius:50%;background:${color};"></span></span>`;
  if (!url) return fallback;
  return `<img src="${escapeHtmlAttribute(url)}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />${fallback}`;
}

function reportGroupMarkerIcon(group: ReportMarkerGroup, selected: boolean, isSecondary: boolean = false) {
  const first = group.reports[0];
  const color = reportColor(first);
  const count = group.reports.length;

  if (count === 1) {
    return reportMarkerIcon(first, selected, isSecondary);
  }

  const rawUrl = reportPhotoUrl(first);
  const imgUrl = resolveMediaUrl(rawUrl);
  const size = isSecondary ? 28 : 42;
  const innerSize = isSecondary ? 24 : 38;
  const badgeSize = isSecondary ? 18 : 22;
  const badgeText = isSecondary ? 9 : 11;
  const offset = isSecondary ? -3 : -5;

  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div style="
          width:${innerSize}px;height:${innerSize}px;border-radius:50%;overflow:hidden;
          background:#0d0e13;
          border:2px solid ${color};
          box-shadow:0 0 0 5px ${color}33,0 6px 20px ${color}66;
        ">
          ${markerPhotoHtml(imgUrl, color)}
        </div>
        <div style="
          position:absolute;right:${offset}px;top:${offset}px;
          min-width:${badgeSize}px;height:${badgeSize}px;border-radius:999px;
          display:flex;align-items:center;justify-content:center;
          background:#050608;color:white;font-size:${badgeText}px;font-weight:900;
          border:2px solid ${color};
        ">${count}</div>
      </div>
    `,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size]
  });
}

function reportMarkerIcon(report: PollutionReport, selected: boolean, isSecondary: boolean = false) {
  const color = reportColor(report);
  const rawUrl = reportPhotoUrl(report);
  const imgUrl = resolveMediaUrl(rawUrl);
  const hasPhoto = imgUrl && imgUrl !== "" && !imgUrl.includes("pwa-icon.svg");
  const size = selected ? 40 : (isSecondary ? 20 : 28);
  const ring = selected ? `box-shadow:0 0 0 3px ${color},0 0 0 6px ${color}44,0 4px 16px ${color}88;` : `box-shadow:0 0 0 2px ${color}88,0 2px 10px ${color}55;`;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;">
        ${selected ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ""}
        <div style="
          width:${size}px;height:${size}px;
          border-radius:50%;
          overflow:hidden;
          background:#0d0e13;
          ${ring}
          cursor:pointer;
        ">
          ${markerPhotoHtml(hasPhoto ? imgUrl : undefined, color)}
        </div>
      </div>
    `,
    iconAnchor: [size / 2, size / 2],
    iconSize: [size, size]
  });
}



function situationRiskColor(priority: string) {
  const p = priority.toLowerCase();
  if (p === "critical") return "#991b1b";
  if (p === "high") return "#dc2626";
  if (p === "moderate") return "#f97316";
  return "#f59e0b"; // low
}

function situationRiskRadius(situation: PollutionSituation) {
  const p = situation.priority.toLowerCase();
  const r = situation.radiusMeters || 250;
  if (p === "critical") return r * 1.5;
  if (p === "high") return r * 1.3;
  if (p === "moderate") return r * 1.15;
  return r;
}

function situationRiskOpacity(score: number) {
  const fillOpacity = Math.max(0.08, Math.min(0.22, 0.05 + score / 700));
  const opacity = Math.max(0.25, Math.min(0.65, 0.18 + score / 300));
  return { fillOpacity, opacity };
}

function reportImage(report: PollutionReport) {
  return reportPhotoUrl(report) || "/pwa-icon.svg";
}

function reportColor(report: PollutionReport) {
  if (report.status === "Resolved") return "#94a3b8";
  if (report.status === "Manual review needed") return "#64748b";
  if (report.priority === "severe") return "#dc2626";
  if (report.priority === "high") return "#fb923c";
  return "#f7c948";
}

function severityScore(report: PollutionReport) {
  const s = report.gemini?.severity || "medium";
  if (s === "low") return 25;
  if (s === "medium") return 50;
  if (s === "high") return 78;
  if (s === "severe") return 100;
  return 50;
}

function recencyScore(report: PollutionReport) {
  const ageHours = (Date.now() - new Date(report.createdAt).getTime()) / (60 * 60 * 1000);
  if (ageHours < 1) return 100;
  if (ageHours < 6) return 90;
  if (ageHours < 24) return 75;
  if (ageHours < 24 * 7) return 45;
  return 20;
}

function trustScore(report: PollutionReport) {
  const t = report.trustLevel;
  if (t === "Verified") return 100;
  if (t === "Likely Valid") return 85;
  if (t === "Needs Review") return 55;
  if (t === "Rejected") return 0;
  return 60;
}

function forecastRiskScore(report: PollutionReport) {
  const r = report.forecast?.spikeRisk;
  if (r === "severe") return 100;
  if (r === "high") return 80;
  if (r === "medium") return 55;
  if (r === "low") return 30;
  return 35;
}

function pollutionLabel(report: PollutionReport) {
  return report.gemini.pollution_type.replace(/_/g, " ");
}

function actionRecommendation(report: PollutionReport) {
  return report.gemini.municipal_action || report.airQuality.healthRecommendations || "Review nearby reports and dispatch field inspection if corroborated.";
}

function MapBoundsController({
  mode,
  reports,
  situations,
  selectedReport,
  selectedSituation,
  selectedAqi,
  selectedForecastStation,
  cpcbStationPoints
}: {
  mode: MapMode;
  reports: PollutionReport[];
  situations: PollutionSituation[];
  selectedReport?: PollutionReport | null;
  selectedSituation?: PollutionSituation | null;
  selectedAqi?: AirQualityMapPoint | null;
  selectedForecastStation?: ForecastStationMapPoint | null;
  cpcbStationPoints?: AirQualityMapPoint[];
}) {
  const map = useMap();
  const lastFitKeyRef = useRef("");

  useEffect(() => {
    if (selectedReport || selectedSituation || selectedAqi || selectedForecastStation) return;

    if (mode === "global") {
      const fitKey = "global:world";
      if (lastFitKeyRef.current === fitKey) return;
      lastFitKeyRef.current = fitKey;
      requestAnimationFrame(() => map.fitBounds(WORLD_BOUNDS, { padding: [24, 24], animate: true }));
      return;
    }

    const points: [number, number][] = [];

    if (mode === "reports") {
      for (const r of reports) {
        if (Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
          points.push([r.lat, r.lng]);
        }
      }
    }

    if (mode === "situations") {
      for (const s of situations) {
        if (Number.isFinite(s.centerLat) && Number.isFinite(s.centerLng)) {
          points.push([s.centerLat, s.centerLng]);
        }
      }
      // If no situations yet but reports exist, fallback to reports
      if (points.length === 0) {
        for (const r of reports) {
          if (Number.isFinite(r.lat) && Number.isFinite(r.lng)) {
            points.push([r.lat, r.lng]);
          }
        }
      }
    }

    if (mode === "air" && cpcbStationPoints) {
      for (const p of cpcbStationPoints) {
        if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
          points.push([p.lat, p.lng]);
        }
      }
    }

    if (points.length === 0) return;

    const fitKey = `${mode}:${points.length}:${points.map(([lat,lng]) => `${lat.toFixed(4)},${lng.toFixed(4)}`).join("|")}`;
    if (lastFitKeyRef.current === fitKey) return;
    lastFitKeyRef.current = fitKey;

    requestAnimationFrame(() => {
      if (points.length === 1) {
        map.setView(points[0], 15, { animate: true });
        return;
      }

      let opts: L.FitBoundsOptions = {
        padding: [80, 80],
        maxZoom: 16,
        animate: true
      };

      if (mode === "air") {
        opts = {
          paddingTopLeft: [80, 80],
          paddingBottomRight: [420, 120],
          maxZoom: 9,
          animate: true
        };
      }

      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, opts);
    });
  }, [map, mode, reports, situations, selectedReport, selectedSituation, selectedAqi, selectedForecastStation, cpcbStationPoints]);

  return null;
}

function MapFocus({
  center,
  zoom,
  selectedReport,
  selectedAqi,
  selectedForecastStation
  ,selectedCountry
}: {
  center: { lat: number; lng: number };
  zoom: number;
  selectedReport?: PollutionReport | null;
  selectedAqi?: AirQualityMapPoint | null;
  selectedForecastStation?: ForecastStationMapPoint | null;
  selectedCountry?: BricsCountry | null;
}) {
  const map = useMap();
  // Track what we last programmatically set so we don't loop back
  const lastSetRef = useRef<string>("");

  // Only fly to selected items — NOT to the initial center (that's handled by MapContainer props)
  useEffect(() => {
    if (!selectedCountry) return;
    const key = `country:${selectedCountry.iso3}`;
    if (lastSetRef.current === key) return;
    lastSetRef.current = key;
    map.flyTo(selectedCountry.center, selectedCountry.zoom, { animate: true, duration: 1.2 });
  }, [map, selectedCountry]);

  useEffect(() => {
    if (!selectedReport) return;
    const key = `report:${selectedReport.id}`;
    if (lastSetRef.current === key) return;
    lastSetRef.current = key;
    map.setView([selectedReport.lat, selectedReport.lng], Math.max(map.getZoom(), 15), { animate: true });
  }, [map, selectedReport]);

  useEffect(() => {
    if (!selectedAqi) return;
    const key = `aqi:${selectedAqi.id}`;
    if (lastSetRef.current === key) return;
    lastSetRef.current = key;
    map.setView([selectedAqi.lat, selectedAqi.lng], Math.max(map.getZoom(), 11), { animate: true });
  }, [map, selectedAqi]);

  useEffect(() => {
    if (!selectedForecastStation) return;
    const key = `fs:${selectedForecastStation.id}`;
    if (lastSetRef.current === key) return;
    lastSetRef.current = key;
    map.setView([selectedForecastStation.lat, selectedForecastStation.lng], Math.max(map.getZoom(), 12), { animate: true });
  }, [map, selectedForecastStation]);

  return null;
}

function MapClickReset({ onReset }: { onReset: () => void }) {
  useMapEvents({
    click: () => onReset()
  });
  return null;
}

function MapResizeSync() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => map.invalidateSize({ pan: false, animate: false });
    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(invalidate)
      : null;

    observer?.observe(container);
    window.addEventListener("resize", invalidate);
    invalidate();

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);

  return null;
}

function MapViewTracker({ onViewChange }: { onViewChange: (view: MapView) => void }) {
  // Store callback in ref so useMapEvents closures always call the latest version
  // without triggering effect dependencies and causing infinite loops.
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => { onViewChangeRef.current = onViewChange; });

  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      onViewChangeRef.current({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    },
    zoomend: () => {
      const center = map.getCenter();
      onViewChangeRef.current({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    }
  });

  return null;
}



export function LocalLeafletMap({
  layer,
  reports,
  situations = [],
  selectedSituation = null,
  selectedReport = null,
  focusReport,
  loading,
  error,
  onRetry,
  onCapture,
  onSelectSituation,
  onSelectReport,
  onMapCenterChange,
  stateForecasts,
  onModeChange
}: {
  layer: AirQualityMapResponse | null;
  reports: PollutionReport[];
  situations?: PollutionSituation[];
  selectedSituation?: PollutionSituation | null;
  selectedReport?: PollutionReport | null;
  focusReport?: PollutionReport | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCapture?: () => void;
  onSelectSituation?: (situation: PollutionSituation | null) => void;
  onSelectReport?: (report: PollutionReport | null) => void;
  onMapCenterChange?: (center: { lat: number; lng: number }) => void;
  stateForecasts?: import("../types").StateForecastResponse | null;
  onModeChange?: (mode: PublicMapMode) => void;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<MapMode>("global");
  const [selectedAqi, setSelectedAqi] = useState<AirQualityMapPoint | null>(null);
  const [forecastStations, setForecastStations] = useState<ForecastStationMapPoint[]>([]);
  const [selectedForecastStation, setSelectedForecastStation] = useState<ForecastStationMapPoint | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<BricsCountry | null>(null);
  const [satellitePollutant, setSatellitePollutant] = useState("NO2");
  const [satelliteStartDate, setSatelliteStartDate] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [satelliteEndDate, setSatelliteEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [satelliteTileUrl, setSatelliteTileUrl] = useState<string | null>(null);
  const [satelliteStatus, setSatelliteStatus] = useState("Satellite data not loaded");
  const [satelliteLoading, setSatelliteLoading] = useState(false);
  const satelliteCacheRef = useRef(new Map<string, string>());
  const [selectedForecast, setSelectedForecast] = useState<AqiForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [localAqiLayer, setLocalAqiLayer] = useState<AirQualityMapResponse | null>(null);
  const [localAqiLoading, setLocalAqiLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapView, setMapView] = useState<MapView>({ lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, zoom: 5 });
  const selectedMetric: CpcbDisplayMetric = "aqi";
  const [legendOpen, setLegendOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const mapOverlayRef = useRef<HTMLDivElement>(null);

  const validReports = useMemo(
    () => reports.filter((report) => Number.isFinite(report.lat) && Number.isFinite(report.lng)),
    [reports]
  );
  const initialFocus = useMemo(() => {
    if (selectedSituation) return { lat: selectedSituation.centerLat, lng: selectedSituation.centerLng, zoom: 15 };
    if (selectedReport) return { lat: selectedReport.lat, lng: selectedReport.lng, zoom: 16 };
    if (focusReport) return { lat: focusReport.lat, lng: focusReport.lng, zoom: 16 };
    if (userLocation) return { ...userLocation, zoom: 15 };
    if (mode === "satellite") return { lat: 22.9734, lng: 78.6569, zoom: 5 };
    if (mode === "global") return { lat: 20, lng: 0, zoom: 2 };
    const firstReport = validReports[0];
    if (firstReport) return { lat: firstReport.lat, lng: firstReport.lng, zoom: 13 };
    return { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng, zoom: 5 };
  }, [mode, selectedSituation, selectedReport, focusReport, validReports, userLocation]);
  const visibleLayers = visibleByMode[mode];
  const userInPunePcmc = userLocation ? isPunePcmcRegion(userLocation) : false;
  const mapNearPunePcmc = isPunePcmcRegion(mapView) && mapView.zoom >= 10;
  const shouldLoadLocalAqi = userInPunePcmc || mapNearPunePcmc;
  const showDelhiForecast = isDelhiRegion(mapView);
  const allStationPoints = useMemo(
    () => dedupePhysicalStations((layer?.points || []).filter((point) => hasAnyMetric(point) && Number.isFinite(point.lat) && Number.isFinite(point.lng))),
    [layer]
  );
  const visibleStationPoints = useMemo(
    () => mode === "global" || mode === "air" ? allStationPoints.filter((point) => {
      // The marker renderer already omits points without a real AQI value.
      // Keep stations with usable AQI data visible even when provider status
      // metadata is pending or absent.
      return hasMetric(point, "aqi");
    }) : [],
    [allStationPoints, mode]
  );
  const displayStationPoints = useMemo(
    () => clusteredPoints(visibleStationPoints, selectedCountry ? Math.max(mapView.zoom, 9) : mapView.zoom, selectedMetric),
    [selectedCountry, visibleStationPoints, mapView.zoom, selectedMetric]
  );

  const aqiCoverage = layer?.aqiCoverage;
  const localAqiPoints = localAqiLayer?.points ?? [];
  const localPoints = useMemo(
    () =>
      shouldLoadLocalAqi && localAqiPoints.length
        ? localAqiPoints.filter(
            (point) => hasAnyMetric(point) && Number.isFinite(point.lat) && Number.isFinite(point.lng)
          )
        : [],
    [localAqiPoints, shouldLoadLocalAqi]
  );
  const visibleForecastStations = useMemo(
    () => (showDelhiForecast ? forecastStations.filter((station) => isDelhiRegion(station)) : []),
    [forecastStations, showDelhiForecast]
  );
  const legendItems = useMemo(
    () =>
      legendByMode[mode].filter((item) => {
        if (item.key === "forecastStations") return visibleForecastStations.length > 0;
        if (item.key === "localAqi") return localPoints.length > 0 || localAqiLoading;
        return true;
      }),
    [localAqiLoading, localPoints.length, mode, visibleForecastStations.length]
  );

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    if (mode !== "satellite") {
      setSatelliteTileUrl(null);
      setSatelliteStatus("Satellite data not loaded");
    }
  }, [mode]);

  const loadSatellitePollution = async () => {
    const cacheKey = `India:${satellitePollutant}:${satelliteStartDate}:${satelliteEndDate}`;
    const cached = satelliteCacheRef.current.get(cacheKey);
    if (cached) {
      setSatelliteTileUrl(cached);
      setSatelliteStatus("Satellite data loaded (cached)");
      return;
    }
    setSatelliteLoading(true);
    setSatelliteStatus("Loading satellite data…");
    try {
      const response = await apiClient.loadSatellitePollution({ country: "India", pollutant: satellitePollutant, startDate: satelliteStartDate, endDate: satelliteEndDate });
      satelliteCacheRef.current.set(cacheKey, response.tileUrl);
      setSatelliteTileUrl(response.tileUrl);
      setSatelliteStatus("Satellite data loaded");
    } catch (error) {
      setSatelliteTileUrl(null);
      setSatelliteStatus(error instanceof Error ? error.message : "Satellite data could not be loaded. Please try again.");
    } finally {
      setSatelliteLoading(false);
    }
  };

  useEffect(() => {
    if (!legendOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLegendOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (legendRef.current && !legendRef.current.contains(event.target as Node)) setLegendOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [legendOpen]);

  useEffect(() => {
    if (!focusReport) return;
    onSelectReport?.(focusReport);
    setSelectedAqi(null);
    setSelectedForecastStation(null);
    setSelectedForecast(null);
  }, [focusReport]);

  useEffect(() => {
    if (!shouldLoadLocalAqi) return undefined;
    let cancelled = false;
    setLocalAqiLoading(true);
    apiClient
      .getLocalAirQualityMap("pune_pcmc")
      .then((response) => {
        if (!cancelled) setLocalAqiLayer(response);
      })
      .catch(() => {
        if (!cancelled) setLocalAqiLayer(null);
      })
      .finally(() => {
        if (!cancelled) setLocalAqiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shouldLoadLocalAqi]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getForecastStations()
      .then((response) => {
        if (cancelled) return;
        setForecastStations(response.stations.map(normalizeForecastStation).filter((station): station is ForecastStationMapPoint => Boolean(station)));
      })
      .catch(() => {
        if (!cancelled) setForecastStations([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (showDelhiForecast) return;
    setSelectedForecastStation(null);
    setSelectedForecast(null);
  }, [showDelhiForecast]);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!cancelled) {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const focusUser = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setSelectedAqi(null);
        onSelectReport?.(null);
        onSelectSituation?.(null);
        setSelectedForecastStation(null);
        setSelectedForecast(null);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  };

  const selectAqi = (point: AirQualityMapPoint) => {
    setSelectedAqi(point);
    onSelectReport?.(null);
    onSelectSituation?.(null);
    setSelectedForecastStation(null);
    setSelectedForecast(null);
    setForecastLoading(true);
    setForecastError(null);
    apiClient
      .getForecast({ lat: point.lat, lng: point.lng })
      .then(setSelectedForecast)
      .catch((fetchError) => {
        setForecastError(fetchError instanceof Error ? fetchError.message : "Unable to load 24 hour AQI forecast.");
      })
      .finally(() => setForecastLoading(false));
  };
  const selectForecastStation = (station: ForecastStationMapPoint) => {
    setSelectedForecastStation(station);
    setSelectedAqi(null);
    onSelectReport?.(null);
    onSelectSituation?.(null);
    setSelectedForecast(null);
    setForecastLoading(true);
    setForecastError(null);
    apiClient
      .getForecast(station.stationName)
      .then(setSelectedForecast)
      .catch((fetchError) => {
        setForecastError(fetchError instanceof Error ? fetchError.message : "Unable to load station forecast.");
      })
      .finally(() => setForecastLoading(false));
  };
  const selectedAqiIsLocal = Boolean(selectedAqi?.id.startsWith("local-"));


  if (mapFailed) {
    return (
      <section className="aq-map-shell">
        <div className="aq-map-header">
          <div>
            <span className="eyebrow">Local map</span>
            <h1>Local Pollution Intelligence Map</h1>
            <p>View nearby reports, AQI context, and local pollution intensity.</p>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-ink/70 p-4 text-sm text-slate-300">
          Map could not load. Reports are still available below.
        </div>
      </section>
    );
  }

  const reportMarkerGroups = useMemo(
    () => buildReportMarkerGroups(validReports),
    [validReports]
  );

  return (
    <div ref={mapOverlayRef} className="relative w-full h-full">
      <aside className="absolute top-4 right-4 z-[700] w-[220px] max-w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl lg:w-[230px]">
        <div className="mb-2 px-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">BRICS Countries</p>
          <p className="mt-1 text-[11px] text-slate-500">Select a country to navigate</p>
        </div>
        <div className="max-h-[min(48svh,360px)] space-y-1 overflow-y-auto pr-1">
          {BRICS_COUNTRIES.map((country) => {
            const active = selectedCountry?.iso3 === country.iso3;
            return (
              <button
                key={country.iso3}
                type="button"
                aria-pressed={active}
                onClick={() => { setSelectedCountry(country); setSelectedAqi(null); onSelectReport?.(null); onSelectSituation?.(null); setSelectedForecastStation(null); }}
                className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs transition-colors ${active ? "bg-emerald-400/15 text-white ring-1 ring-emerald-300/40" : "text-slate-300 hover:bg-white/[0.07] hover:text-white"}`}
              >
                <span aria-hidden="true" className="text-base">{country.flag}</span>
                <span className="truncate">{country.name}</span>
                {active && <span className="ml-auto text-emerald-300">●</span>}
              </button>
            );
          })}
        </div>
      </aside>
      {selectedCountry && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-[500] -translate-x-1/2 rounded-xl border border-emerald-300/25 bg-slate-950/90 px-4 py-2.5 text-center shadow-xl backdrop-blur-md">
          <p className="text-sm font-bold text-white">{selectedCountry.flag} {selectedCountry.name}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">BRICS Member • Pollution Monitoring</p>
        </div>
      )}
      <div className="w-full h-full bg-slate-950">
        <MapContainer
          center={[initialFocus.lat, initialFocus.lng]}
          zoom={initialFocus.zoom}
          scrollWheelZoom
          className="w-full h-full z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={19}
            eventHandlers={{ tileerror: () => setMapFailed(true) }}
          />
          {mode === "satellite" && satelliteTileUrl && (
            <TileLayer url={satelliteTileUrl} opacity={0.72} attribution="Sentinel-5P / Google Earth Engine" zIndex={450} />
          )}
          <BricsBoundaryLayer />
          <MapFocus
            center={{ lat: initialFocus.lat, lng: initialFocus.lng }}
            zoom={initialFocus.zoom}
            selectedAqi={selectedAqi}
            selectedReport={selectedReport}
            selectedForecastStation={selectedForecastStation}
            selectedCountry={selectedCountry}
          />
          <MapResizeSync />
          <MapBoundsController
            mode={mode}
            reports={validReports}
            situations={situations}
            selectedReport={selectedReport}
            selectedSituation={selectedSituation}
            selectedAqi={selectedAqi}
            selectedForecastStation={selectedForecastStation}
            cpcbStationPoints={allStationPoints}
          />
          <MapViewTracker onViewChange={(view) => {
            setMapView(view);
            onMapCenterChange?.({ lat: view.lat, lng: view.lng });
          }} />
          <MapClickReset
            onReset={() => {
              setSelectedAqi(null);
              onSelectReport?.(null);
              onSelectSituation?.(null);
              setSelectedForecastStation(null);
              setSelectedForecast(null);
            }}
          />

          {mode === "situations" && situations.map((sit) => {
            const { fillOpacity, opacity } = situationRiskOpacity(sit.situationScore);
            return (
              <Circle
                key={`zone-${sit.id}`}
                center={[sit.centerLat, sit.centerLng]}
                radius={situationRiskRadius(sit)}
                pathOptions={{
                  color: situationRiskColor(sit.priority),
                  fillColor: situationRiskColor(sit.priority),
                  fillOpacity,
                  opacity,
                  weight: 1.5,
                  dashArray: "4,6"
                }}
                eventHandlers={{
                  click: () => onSelectSituation?.(sit)
                }}
              />
            );
          })}

          {userLocation ? (
            <>
              {/* Outer soft glow rings */}
              {[300, 180].map((radius) => (
                <Circle
                  key={radius}
                  center={[userLocation.lat, userLocation.lng]}
                  pathOptions={{ color: "#00e5ff", fillColor: "#00e5ff", fillOpacity: 0.04, opacity: radius === 300 ? 0.12 : 0.22, weight: 1 }}
                  radius={radius}
                />
              ))}
              {/* Glowing dot */}
              <CircleMarker
                center={[userLocation.lat, userLocation.lng]}
                pathOptions={{ color: "#00e5ff", fillColor: "#00e5ff", fillOpacity: 1, opacity: 1, weight: 3 }}
                radius={6}
              />
              {/* Bright white core */}
              <CircleMarker
                center={[userLocation.lat, userLocation.lng]}
                pathOptions={{ color: "transparent", fillColor: "#ffffff", fillOpacity: 1, opacity: 0 }}
                radius={2.5}
              />
            </>
          ) : null}

          {visibleLayers.cpcbStations
            ? displayStationPoints.map((cluster) => cluster.count > 1 ? (
                <StationClusterMarker
                  key={`${cluster.point.id}:${cluster.count}`}
                  cluster={cluster}
                  metric={selectedMetric}
                />
      ) : (
                <Marker
                  key={cluster.point.id}
                  icon={cpcbStationMarkerIcon(cluster.point, selectedAqi?.id === cluster.point.id)}
                  position={[cluster.point.lat, cluster.point.lng]}
                  eventHandlers={{ click: () => selectAqi(cluster.point) }}
                >
                  <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
                    <strong>{cluster.point.label}</strong><br />
                    {aqiQualityLabel(cluster.point.aqiStatus?.selected?.quality)}: {formatValue("aqi", cluster.point.metrics.aqi!, cluster.point)}<br />
                    {cluster.point.sourceLabel}<br />
                    Updated {formatAge(cluster.point.lastUpdate)}<br />
                    {cluster.point.aqiStatus?.selected?.quality === "indicative" ? "Indicative station AQI" : "AQI from station data"}
                  </Tooltip>
                </Marker>
              ))
            : null}

          {visibleLayers.localAqi
            ? localPoints.map((point) => {
                const m = bestMetric(point);
                if (!m) return null;
                const value = point.metrics[m];
                if (typeof value !== "number" || !Number.isFinite(value)) return null;
                return (
                  <Marker
                    key={point.id}
                    icon={aqiMarkerIcon(value, selectedAqi?.id === point.id, true)}
                    position={[point.lat, point.lng]}
                    eventHandlers={{ click: () => selectAqi(point) }}
                  />
                );
              })
            : null}

          {visibleLayers.forecastStations
            ? visibleForecastStations.map((station) => (
                <Marker
                  key={station.id}
                  icon={forecastMarkerIcon(selectedForecastStation?.id === station.id)}
                  position={[station.lat, station.lng]}
                  eventHandlers={{ click: () => selectForecastStation(station) }}
                />
              ))
            : null}

          {null}

          {visibleLayers.situations
            ? situations.map((situation) => (
                <Marker
                  key={situation.id}
                  icon={situationMarkerIcon(situation, selectedSituation?.id === situation.id)}
                  position={[situation.centerLat, situation.centerLng]}
                  eventHandlers={{
                    click: () => {
                      setSelectedAqi(null);
                      setSelectedForecastStation(null);
                      setSelectedForecast(null);
                      onSelectSituation?.(situation);
                    }
                  }}
                />
              ))
            : null}

          {visibleLayers.citizenReports
            ? reportMarkerGroups.map((group) => {
                const selected = group.reports.some((r) => r.id === selectedReport?.id);
                const groupSituation = situations.find((s) =>
                  group.reports.some((r) => s.reportIds.includes(r.id))
                );

                return (
                  <Marker
                    key={group.id}
                    position={[group.lat, group.lng]}
                    icon={reportGroupMarkerIcon(group, selected, false)}
                    eventHandlers={{
                      click: () => {
                        setSelectedAqi(null);
                        setSelectedForecastStation(null);
                        setSelectedForecast(null);

                        if (group.reports.length > 1 && groupSituation) {
                          onSelectSituation?.(groupSituation);
                        } else {
                          onSelectReport?.(group.reports[0]);
                        }
                      }
                    }}
                  >
                    {group.reports.length > 1 && !groupSituation && (
                      <Popup>
                        <div style={{ minWidth: 220 }}>
                          <strong>{group.reports.length} evidence reports here</strong>
                          <p style={{ margin: "4px 0 8px", color: "#64748b", fontSize: 12 }}>
                            Nearby reports are grouped into one municipal action area.
                          </p>
                          {group.reports.slice(0, 4).map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "6px 0",
                                borderTop: "1px solid #e2e8f0"
                              }}
                              onClick={() => onSelectReport?.(r)}
                            >
                              {r.id.slice(0, 5)} · {r.gemini.pollution_type.replace(/_/g, " ")}
                            </button>
                          ))}
                        </div>
                      </Popup>
                    )}
                  </Marker>
                );
              })
            : null}
        </MapContainer>

        {/* View mode menu */}
        <div data-map-mode-selector className="absolute left-1/2 top-4 z-[400] -translate-x-1/2 pointer-events-auto">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-950/90 p-1 shadow-xl backdrop-blur-md">
            <span className="hidden px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:inline">Mode:</span>
            {mapModes.map((item) => (
              <button
                key={item.key}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase transition-all
                  ${
                    mode === item.key
                      ? "bg-slate-800 text-slate-100"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
                  }
                `}
                type="button"
                onClick={() => {
                  setMode(item.key);
                  setLegendOpen(false);
                  setSelectedAqi(null);
                  onSelectReport?.(null);
                  onSelectSituation?.(null);
                  setSelectedForecastStation(null);
                  setSelectedForecast(null);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "satellite" && (
          <div className="absolute left-4 top-20 z-[700] w-[min(320px,calc(100%-2rem))] rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">Satellite Pollution</p>
            <p className="mt-1 text-[11px] text-slate-500">Sentinel-5P atmospheric pollutant concentration</p>
            <div className="mt-3 space-y-2.5">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pollutant
                <select value={satellitePollutant} onChange={(event) => setSatellitePollutant(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white">
                  <option value="NO2">NO₂</option><option value="SO2">SO₂</option><option value="CO">CO</option><option value="O3">O₃</option><option value="HCHO">HCHO</option>
                </select>
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Region
                <select disabled value="India" className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white"><option>India</option></select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Start<input type="date" value={satelliteStartDate} onChange={(event) => setSatelliteStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white" /></label>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">End<input type="date" value={satelliteEndDate} onChange={(event) => setSatelliteEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white" /></label>
              </div>
              <button type="button" disabled={satelliteLoading} onClick={loadSatellitePollution} className="w-full rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{satelliteLoading ? "Loading…" : "🛰 Load Satellite Pollution"}</button>
              <p className="text-[11px] text-slate-400">Status: {satelliteStatus}</p>
              {satelliteTileUrl && <p className="text-[10px] text-slate-500">Legend: relative satellite concentration. This is not AQI.</p>}
            </div>
          </div>
        )}

        {mode === "air" && (
          <CpcbLayerPanel
            totalStations={aqiCoverage?.totalPhysicalStations || allStationPoints.length}
            processedStations={aqiCoverage?.processedStations || 0}
            providerReportedCount={aqiCoverage?.providerReportedEligibleStations || 0}
            indicativeCount={aqiCoverage?.indicativeEligibleStations || 0}
            pendingCount={aqiCoverage?.pendingStations || 0}
            validatedCount={aqiCoverage?.validatedEligibleStations || 0}
            snapshotRefreshing={aqiCoverage?.snapshotRefreshing || false}
            snapshotComplete={aqiCoverage?.snapshotComplete || false}
            selectedDisplayStations={visibleStationPoints.length}
            sourceAvailable={Boolean(layer?.cpcbUsable || layer?.openAqUsable)}
            mapContainerRef={mapOverlayRef}
          />
        )}

        {/* Fixed map controls: Leaflet zoom stays top-left; app actions sit below it. */}
        <div className="absolute left-4 top-20 z-[400] flex flex-col gap-2 pointer-events-auto">
          <button
            className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.12] bg-slate-950/90 text-slate-300 shadow-lg backdrop-blur transition hover:border-slate-800 hover:text-white"
            type="button"
            aria-label="Center on my location"
            onClick={focusUser}
          >
            <LocateFixed size={15} />
          </button>
          {onCapture && (
            <button
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.12] bg-slate-950/90 text-slate-300 shadow-lg backdrop-blur transition hover:border-slate-800 hover:text-white"
              type="button"
              aria-label="Create report"
              title="Create report"
              onClick={onCapture}
            >
              <MapPinned size={15} />
            </button>
          )}
        </div>

        {/* Legend: collapsed by default so the map remains the dominant surface. */}
        {legendItems.length > 0 && (
          <div ref={legendRef} className="absolute bottom-4 right-4 z-[400] pointer-events-auto">
            <button
              type="button"
              aria-expanded={legendOpen}
              aria-label="Open map legend"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/[0.12] bg-slate-950/90 px-3 text-[11px] font-semibold text-slate-300 shadow-lg backdrop-blur hover:text-white"
              onClick={() => setLegendOpen((open) => !open)}
            >
              <Info size={14} /> Legend
            </button>
            {legendOpen && (
              <div className="absolute bottom-12 right-0 w-64 rounded-xl border border-white/[0.12] bg-slate-950/98 p-3 text-[11px] text-slate-300 shadow-xl">
                <p className="font-bold text-white">Map legend</p>
              <div className="mt-2 grid gap-2">
                {mode === "global" && (
                  <>
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#1f9d68", border: "1px solid #69e6ae" }} /> BRICS Nation</span>
                    <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#273244", border: "1px solid #64748b" }} /> Other Countries</span>
                  </>
                )}
                {legendItems.map((item) => (
                    <span key={item.key} className="flex items-center gap-2">
                      <i className={`${item.iconClass} h-2.5 w-2.5 rounded-full`} style={{ backgroundColor: item.key === "situations" ? "#f97316" : item.key === "citizenReports" ? "#f7c948" : "#dc2626" }} />
                      {item.label}
                    </span>
                  ))}
                </div>
                {mode === "air" && <p className="mt-3 border-t border-white/[0.08] pt-2 leading-relaxed text-slate-500">Stations are grouped by zoom and filtered to the selected metric.</p>}
              </div>
            )}
          </div>
        )}

        {/* Loading indicators */}
        {(loading || localAqiLoading) && (
          <div className="absolute bottom-4 left-4 z-[400] rounded-xl border border-slate-900 bg-slate-950/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 shadow-xl backdrop-blur-md">
            {localAqiLoading && shouldLoadLocalAqi ? "Syncing PCMC AQI..." : "Syncing official stations..."}
          </div>
        )}

        {/* Floating AQI Details overlay if clicked */}
        {selectedAqi && (() => {
          const isStation = mode === "air";
          let headlineMetric = bestMetric(selectedAqi) ?? "aqi";
          let headlineValue: number | undefined = selectedAqi.metrics[headlineMetric];
          
          if (isStation) {
            headlineMetric = selectedMetric;
            headlineValue = selectedAqi.metrics[selectedMetric as AirQualityMapMetric];
          }

          return (
            <DraggableMobileAqiPanel mapContainerRef={mapOverlayRef} summary={`Air Quality · ${headlineValue !== undefined ? formatValue(headlineMetric, headlineValue, selectedAqi) : "Data unavailable"}`}>
              <div className="mobile-aqi-panel-content p-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">
                    {isStation ? "Monitoring station" : selectedAqiIsLocal ? "Pune/PCMC sample" : "Regional AQI"}
                  </span>
                  <h3 className="text-sm font-semibold mt-0.5 text-white">{selectedAqi.label}</h3>
                </div>
                <button onClick={() => setSelectedAqi(null)} className="text-slate-500 hover:text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -mt-2">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <strong className="text-2xl font-black text-white">{headlineValue !== undefined ? formatValue(headlineMetric, headlineValue, selectedAqi) : "—"}</strong>
                <span className="text-xs text-slate-400 font-medium">{headlineMetric !== "aqi" ? headlineMetric : headlineValue !== undefined ? categoryFor(headlineMetric, headlineValue) : "Unavailable"}</span>
              </div>
              {isStation && selectedMetric === "aqi" && selectedAqi.aqiStatus && (
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px]">
                  <div className="font-semibold text-white">{aqiQualityLabel(selectedAqi.aqiStatus.selected?.quality)}</div>
                  {selectedAqi.aqiStatus.status === "pending" && <p className="mt-1 text-amber-300">Station history is still being processed.</p>}
                  {selectedAqi.aqiStatus.status === "insufficient_history" && <p className="mt-1 text-slate-400">Not enough recent hourly history for a validated rolling AQI.</p>}
                  {selectedAqi.aqiStatus.status === "insufficient_coverage" && <p className="mt-1 text-slate-400">Recent hourly coverage has gaps that cannot be filled safely.</p>}
                  {selectedAqi.aqiStatus.status === "insufficient_pollutants" && <p className="mt-1 text-slate-400">At least three supported pollutants, including PM2.5 or PM10, are required.</p>}
                  {selectedAqi.aqiStatus.selected?.quality === "rolling_validated" && <p className="mt-1 text-slate-400">Calculated from recent OpenAQ hourly station history. This is application-calculated, not an official CPCB AQI.</p>}
                  {selectedAqi.aqiStatus.selected?.quality === "indicative" && <p className="mt-1 text-amber-300">CPCB-reported average estimate; the averaging period is not verified.</p>}
                  {selectedAqi.aqiStatus.warnings?.length > 0 && <p className="mt-1 text-slate-500">{selectedAqi.aqiStatus.warnings[0]}</p>}
                </div>
              )}
              {isStation && (
                <div className="mt-3 bg-slate-900/50 rounded-xl p-3">
                  {selectedMetric !== "aqi" && headlineValue === undefined && (
                    <p className="text-[11px] text-orange-400 mb-2 font-medium">
                      {selectedMetric} not available at this station. Other pollutants are listed below.
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-300">
                    {CPCB_POLLUTANT_PREFERENCE.map((k) => {
                      const v = selectedAqi.metrics[k];
                      return (
                        <div key={k} className="flex justify-between items-center">
                          <span className="font-semibold text-slate-400">{k}</span>
                          <span className="text-right text-white font-mono">{typeof v === "number" && Number.isFinite(v) ? `${v.toFixed(1)} ${selectedAqi.units?.[k] || "ug/m3"}` : "Not reported"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-slate-900 text-[10px] text-slate-500 space-y-1">
                <div>{isStation ? "Station-derived context from CPCB/OpenAQ monitoring data; not an exact street-level sensor reading." : selectedAqiIsLocal ? "OpenAQ local monitoring station context." : "OpenAQ/CPCB monitoring station context."}</div>
                <div>{formatAge(selectedAqi.lastUpdate)}</div>
              </div>
              <div className="mt-3 border-t border-slate-900 pt-3">
                {forecastLoading ? (
                  <p className="text-xs text-slate-500">Loading local 24h prediction...</p>
                ) : forecastError ? (
                  <p className="text-xs text-red-400">{forecastError}</p>
                ) : selectedForecast ? (
                  <ForecastPanel forecast={selectedForecast} compact framed={false} />
                ) : null}
              </div>
              </div>
            </DraggableMobileAqiPanel>
          );
        })()}

        {selectedForecastStation && (
          <article className="absolute bottom-[env(safe-area-inset-bottom)] left-0 right-0 m-2 lg:m-0 lg:left-auto lg:bottom-4 lg:right-4 z-[700] lg:w-76 rounded-2xl border border-slate-900 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-md pointer-events-auto text-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500">AQI Forecast Station</span>
                <h3 className="text-sm font-semibold mt-0.5 text-white line-clamp-1">{selectedForecast?.nearestStation || selectedForecastStation.stationName}</h3>
              </div>
              <button onClick={() => setSelectedForecastStation(null)} className="text-slate-500 hover:text-slate-300 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -mt-2">
                <X size={16} />
              </button>
            </div>
            {forecastLoading ? (
              <p className="text-xs text-slate-500 mt-2">Loading prediction model...</p>
            ) : forecastError ? (
              <p className="text-xs text-red-400 mt-2">{forecastError}</p>
            ) : selectedForecast ? (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-slate-400">Latest Available AQI</span>
                  <strong className="text-sm text-white font-bold">{selectedForecast.latestAvailableAqi ?? "--"}</strong>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-900 text-center">
                  {forecastHorizons.map((horizon) => (
                    <div key={horizon} className="bg-slate-900/60 p-1.5 rounded-xl border border-slate-900">
                      <div className="text-[9px] text-slate-500 font-bold uppercase">{horizon}</div>
                      <div className="text-xs text-slate-200 font-black mt-0.5">{selectedForecast.predictions[horizon] ?? "--"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>
        )}
      </div>
    </div>
  );
}
