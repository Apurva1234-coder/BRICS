import type { AirQualitySummary } from "../types";

const pollutantOrder = ["PM2.5", "PM10", "NO2", "SO2", "CO", "OZONE", "NH3", "pm25", "pm10", "no2", "so2", "co", "o3"];

function providerLabel(provider: AirQualitySummary["provider"]) {
  if (provider === "cpcb_data_gov") return "CPCB Monitoring Station";
  if (provider === "openaq") return "OpenAQ Monitoring Station";
  if (provider === "fused_measured") return "Fused Station Context";
  return "Unavailable";
}

function pollutantValue(value: unknown) {
  if (value && typeof value === "object") {
    const record = value as { value?: unknown; avg?: unknown; unit?: unknown; displayName?: unknown };
    const reading = record.value ?? record.avg;
    if (reading === undefined || reading === null) return "available";
    if (record.unit === "CPCB reported value") return `${reading} (${record.unit})`;
    const unit = typeof record.unit === "string" ? ` ${record.unit}` : "";
    return `${reading}${unit}`;
  }
  return value !== undefined && value !== null ? String(value) : "available";
}

function pollutantName(key: string, value: unknown) {
  if (value && typeof value === "object") {
    const record = value as { displayName?: unknown };
    if (typeof record.displayName === "string") return record.displayName;
  }
  if (key === "pm25") return "PM2.5";
  if (key === "o3") return "OZONE";
  return key.toUpperCase();
}

function pollutantEntries(airQuality: AirQualitySummary) {
  const pollutants = airQuality.pollutants || {};
  const keys = Object.keys(pollutants);
  return keys.sort((a, b) => {
    const aIndex = pollutantOrder.indexOf(a);
    const bIndex = pollutantOrder.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

function PollutantGrid({ airQuality }: { airQuality: AirQualitySummary }) {
  const entries = pollutantEntries(airQuality);
  if (!entries.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map((key) => (
        <div key={key} className="rounded-lg border border-line bg-panel/60 p-2">
          <p className="text-xs text-slate-500">{pollutantName(key, airQuality.pollutants?.[key])}</p>
          <p className="font-semibold text-white">{pollutantValue(airQuality.pollutants?.[key])}</p>
        </div>
      ))}
    </div>
  );
}

export function AirQualityPanel({ airQuality, compact = false }: { airQuality: AirQualitySummary; compact?: boolean }) {
  const hasAqi = airQuality.aqi !== undefined && airQuality.aqi !== null;
  const entries = pollutantEntries(airQuality);

  return (
    <div className="rounded-lg border border-line bg-ink/60 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="metric-pill">{providerLabel(airQuality.provider)}</span>
        {airQuality.dominantPollutant && (
          <span className="metric-pill">Dominant: {airQuality.dominantPollutant.toUpperCase()}</span>
        )}
      </div>

      {airQuality.provider !== "unavailable" && (
        <>
          <p className={compact ? "text-base font-semibold text-white" : "text-xl font-semibold text-white"}>
            {hasAqi
              ? airQuality.aqiQuality === "indicative"
                ? `Indicative AQI ${airQuality.aqi}`
                : `Estimated Indian AQI ${airQuality.aqi}`
              : "Official pollutant readings"}
            {airQuality.category ? ` - ${airQuality.category}` : ""}
          </p>
          {airQuality.nearestStation && <p className="mt-1 text-sm text-slate-300">{airQuality.nearestStation}</p>}
          {airQuality.nearestStationDistanceMeters !== undefined && (
            <p className="text-xs text-slate-500">
              Approx. {airQuality.nearestStationDistanceMeters.toLocaleString()} m from report
            </p>
          )}
          {airQuality.lastUpdate && <p className="text-xs text-slate-500">Updated {airQuality.lastUpdate}</p>}
          <PollutantGrid airQuality={airQuality} />
          <p className="mt-3 text-sm text-slate-400">
            {airQuality.aqiQuality === "indicative"
              ? "Indicative CPCB station estimate; averaging period not verified. Station-derived local context, not exact street-level sensor data."
              : "Station-derived local context, not exact street-level sensor data."}
          </p>
        </>
      )}

      {airQuality.provider === "unavailable" && (
        <p className={compact ? "text-sm text-slate-300" : "text-base text-slate-300"}>
          Air-quality reading unavailable. Photo verification still succeeded.
        </p>
      )}

      {airQuality.rawSummary && (
        <p className="mt-2 text-sm text-slate-400">{airQuality.rawSummary}</p>
      )}
    </div>
  );
}
