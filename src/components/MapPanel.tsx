import { useEffect, useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import type { PollutionReport } from "../types";
import { loadGoogleMaps } from "../services/googleMapsLoader";
import { hasGoogleMapsKey } from "../services/env";

const colorByPriority = {
  resolved: "#24e0a6",
  watch: "#f7c948",
  high: "#fb923c",
  severe: "#ff5c7a"
};

function FallbackMap({
  reports,
  height,
  message,
  onRetry
}: {
  reports: PollutionReport[];
  height: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className={`relative ${height} overflow-hidden rounded-lg border border-line bg-[#0a1626]`}>
      <div className="absolute inset-0 map-grid" />
      {reports.map((report, index) => (
        <div
          key={report.id}
          className="absolute h-4 w-4 rounded-full border-2 border-ink shadow-glow"
          style={{
            backgroundColor: colorByPriority[report.priority],
            left: `${18 + ((index * 23) % 62)}%`,
            top: `${20 + ((index * 17) % 56)}%`
          }}
          title={report.areaText}
        />
      ))}
      <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-line bg-ink/85 p-3 text-sm text-slate-300 backdrop-blur">
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

export function MapPanel({ reports, height = "h-[420px]" }: { reports: PollutionReport[]; height?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!hasGoogleMapsKey()) {
      setStatus("failed");
      return;
    }
    setStatus("loading");
    loadGoogleMaps()
      .then(({ Map, AdvancedMarkerElement }) => {
        if (cancelled || !ref.current) return;
        const center = reports[0] || { lat: 20.5937, lng: 78.9629 };
        const map = new Map(ref.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom: reports.length ? 11 : 5,
          disableDefaultUI: true,
          mapId: "cleanair-local-sentinel"
        });
        reports.forEach((report) => {
          const marker = document.createElement("div");
          marker.className = "h-4 w-4 rounded-full border-2 border-ink shadow-glow";
          marker.style.backgroundColor = colorByPriority[report.priority];
          marker.title = `${report.areaText} - ${report.gemini.severity}`;
          new AdvancedMarkerElement({
            map,
            position: { lat: report.lat, lng: report.lng },
            content: marker,
            title: marker.title
          });
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [reports, retryKey]);

  if (status === "ready" || status === "loading") {
    return (
      <div className="relative">
        <div ref={ref} className={`${height} overflow-hidden rounded-lg border border-line`} />
        {status === "loading" && (
          <div className="absolute inset-x-4 bottom-4 rounded-lg border border-line bg-ink/85 p-3 text-sm text-slate-300 backdrop-blur">
            Loading map...
          </div>
        )}
      </div>
    );
  }

  return (
    <FallbackMap
      reports={reports}
      height={height}
      message={
        reports.length
          ? hasGoogleMapsKey()
            ? "Map temporarily unavailable. Reports are still listed below."
            : "Map key is not configured. Reports are still listed below."
          : "No verified report locations yet."
      }
      onRetry={hasGoogleMapsKey() ? () => setRetryKey((value) => value + 1) : undefined}
    />
  );
}
