import { Activity, TrendingUp } from "lucide-react";
import type { AqiForecastResult, ForecastHorizon } from "../types";
import { getForecastDisplayState, isFiniteNonNegative } from "../services/airQualityDisplay";

const horizons: ForecastHorizon[] = ["1h", "6h", "12h", "24h"];

function riskClass(risk: AqiForecastResult["spikeRisk"]) {
  if (risk === "severe") return "text-red-400";
  if (risk === "high") return "text-orange-400";
  if (risk === "medium") return "text-warning";
  if (risk === "low") return "text-civic";
  return "text-slate-400";
}

export function ForecastPanel({
  forecast,
  compact = false,
  framed = true
}: {
  forecast?: AqiForecastResult;
  compact?: boolean;
  framed?: boolean;
}) {
  const shellClass = framed ? "rounded-lg border border-line bg-ink/60 p-4" : "";

  const display = getForecastDisplayState(forecast);
  if (!forecast || !display.available) return null;

  const isAvailable = forecast.provider === "locally_forecast";
  const sourceLabel = isAvailable ? "Local statistical model" : "Unavailable";

  return (
    <div className={shellClass}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="metric-pill">24-Hour AQI Risk Forecast</span>
        <span className="metric-pill">{sourceLabel}</span>
      </div>

      {!isAvailable ? (
        <>
          <p className={compact ? "text-sm text-slate-300" : "text-base text-slate-300"}>
            {forecast.reason || "Forecast unavailable for this report."}
          </p>
          <p className="mt-2 text-xs text-slate-500">{forecast.sourceNote}</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={compact ? "text-base font-semibold text-white" : "text-xl font-semibold text-white"}>
                {forecast.nearestStation || "Nearest station context"}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Current forecast AQI {forecast.latestAvailableAqi ?? "n/a"}
                {forecast.latestAvailableTimestamp ? ` - ${forecast.latestAvailableTimestamp}` : ""}
              </p>
            </div>
            <div className="rounded-lg border border-civic/30 bg-civic/10 px-3 py-2 text-right">
              <p className="text-xs text-slate-400">Spike risk</p>
              <p className={`font-semibold capitalize ${riskClass(forecast.spikeRisk)}`}>{forecast.spikeRisk}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-line bg-panel/60 p-3">
              <p className="text-xs text-slate-500">Peak AQI</p>
              <p className="mt-1 text-lg font-semibold text-white">{forecast.peakAqi ?? "n/a"}</p>
            </div>
            <div className="rounded-lg border border-line bg-panel/60 p-3">
              <p className="text-xs text-slate-500">Trend</p>
              <p className="mt-1 text-lg font-semibold capitalize text-white">{forecast.trend}</p>
            </div>
            <div className="rounded-lg border border-line bg-panel/60 p-3">
              <p className="text-xs text-slate-500">Average</p>
              <p className="mt-1 text-lg font-semibold text-white">{forecast.averageAqi ?? "n/a"}</p>
            </div>
            <div className="rounded-lg border border-line bg-panel/60 p-3">
              <p className="text-xs text-slate-500">Peak time</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {forecast.peakTime ? new Date(forecast.peakTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "n/a"}
              </p>
            </div>
          </div>

          <div className={compact ? "mt-3 grid grid-cols-2 gap-2" : "mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"}>
            {display.availableHorizons.map((horizon) => (
              <div key={horizon} className="rounded-lg border border-line bg-panel/60 p-3">
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  {horizon === "24h" ? <TrendingUp size={13} /> : <Activity size={13} />}
                  Predicted {horizon}
                </p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {forecast.predictions[horizon]}
                </p>
                {forecast.categories[horizon] && (
                  <p className="text-xs text-slate-400">{forecast.categories[horizon]}</p>
                )}
              </div>
            ))}
          </div>
          {isAvailable && forecast.hourly?.length ? (
            <div className="mt-4 h-16 rounded-lg border border-line bg-panel/40 p-2">
              <div className="flex h-full items-end gap-1">
                {forecast.hourly.slice(0, 24).map((hour, index) => {
                  if (!isFiniteNonNegative(hour.aqi)) return null;
                  const height = Math.max(12, Math.min(100, (hour.aqi / 400) * 100));
                  return (
                    <span
                      key={`${hour.dateTime}-${index}`}
                      className="flex-1 rounded-sm bg-civic/70"
                      title={`${new Date(hour.dateTime).toLocaleTimeString([], { hour: "2-digit" })}: ${hour.aqi ?? "n/a"}`}
                      style={{ height: `${height}%` }}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-slate-400">{forecast.confidenceNote}</p>
          <p className="mt-1 text-xs text-slate-500">{forecast.spikeReason}</p>
          <p className="mt-1 text-xs text-slate-500">{forecast.sourceNote}</p>
        </>
      )}
    </div>
  );
}
