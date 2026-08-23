import type { CpcbLocalContext, CpcbPollutantCode } from "../types";
import { useTranslation } from "react-i18next";
import { useState } from "react";

const DEFAULT_POLLUTANTS: CpcbPollutantCode[] = ["PM2.5", "PM10", "NO2", "SO2", "CO", "OZONE", "NH3", "PB"];

function distanceLabel(meters?: number) {
  if (!Number.isFinite(meters)) return "";
  return meters! >= 1000 ? `${(meters! / 1000).toFixed(1)} km` : `${Math.round(meters!)} m`;
}

export function CpcbContextPanel({
  context,
  title,
  preferred = DEFAULT_POLLUTANTS
}: {
  context?: CpcbLocalContext | null;
  title?: string;
  preferred?: CpcbPollutantCode[];
}) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const displayTitle = title || t("cpcb.officialStationDerivedContext");

  if (!context) {
    return (
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="section-eyebrow">{displayTitle}</p>
        <p className="mt-2 text-[14px] text-slate-400">{t("common.loading")}</p>
      </section>
    );
  }

  const nearest = context.nearestStations[0];
  const rows = DEFAULT_POLLUTANTS.map((pollutant) => ({ pollutant, value: context.pollutants[pollutant] }));
  const hasReportedValue = (value: typeof rows[number]["value"]) => value?.nearestValue !== undefined || value?.idwEstimate !== undefined || value?.avgNearby !== undefined;
  const hasAnyReportedPollutant = rows.some(({ value }) => hasReportedValue(value));
  const primaryRows = rows.filter(({ pollutant, value }) => preferred.includes(pollutant) && hasReportedValue(value)).slice(0, 3);

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-eyebrow">{displayTitle}</p>
          {nearest ? (
            <p className="mt-2 text-[14px] font-semibold text-white">
              {nearest.station}
              {nearest.city ? `, ${nearest.city}` : ""} {distanceLabel(nearest.distanceMeters) ? `· ${distanceLabel(nearest.distanceMeters)}` : ""}
            </p>
          ) : null}
        </div>
        {nearest?.freshnessLabel ? (
          <span className="rounded-md border border-white/[0.1] bg-black/20 px-2 py-1 text-[11px] font-semibold text-slate-300">
            {nearest.freshnessLabel}
          </span>
        ) : null}
      </div>

      {hasAnyReportedPollutant ? <div className="mt-4 grid gap-2">
        {primaryRows.map(({ pollutant, value }) => (
          <div key={pollutant} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2 text-[13px]">
            <span className="font-bold text-white">{pollutant}</span>
            <span className="text-slate-400">
              {value?.nearestValue ?? value?.idwEstimate ?? "Not reported"}{value?.nearestValue !== undefined || value?.idwEstimate !== undefined ? ` ${value.unit}` : ""}
              {value?.nearestStation ? <span className="ml-1 text-[11px] text-slate-500">· {value.nearestStation}{value.nearestDistanceMeters !== undefined ? ` · ${distanceLabel(value.nearestDistanceMeters)}` : ""}</span> : null}
            </span>
            <span className="text-[11px] uppercase text-slate-500">{value?.confidence || "unavailable"}</span>
          </div>
        ))}
      </div> : <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-3 text-[13px] leading-relaxed text-slate-400">No fresh nearby CPCB station reading is available for this location.</div>}

      {hasAnyReportedPollutant && <button
        type="button"
        className="mt-3 inline-flex items-center text-[11px] font-semibold text-slate-300 hover:text-white"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((open) => !open)}
      >
        {detailsOpen ? "Hide data details" : "Data details"}
      </button>}

      {detailsOpen && hasAnyReportedPollutant && (
        <div className="mt-2 grid gap-2">
          {rows.filter(({ value }) => hasReportedValue(value)).map(({ pollutant, value }) => (
            <div key={pollutant} className="rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-white">{pollutant}</span>
                <span className="text-[10px] uppercase text-slate-500">{value?.confidence || "unavailable"}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-400 sm:grid-cols-4">
                <span>Nearest station reading: {value?.nearestValue ?? "Not reported"}{value?.nearestValue !== undefined ? ` ${value.unit}` : ""}</span>
                <span>Nearby station average: {value?.avgNearby ?? "Not reported"}{value?.avgNearby !== undefined ? ` ${value.unit}` : ""}</span>
                <span>Station-derived IDW estimate: {value?.idwEstimate ?? "Not reported"}{value?.idwEstimate !== undefined ? ` ${value.unit}` : ""}</span>
                <span>Range: {value?.minNearby ?? "-"} to {value?.maxNearby ?? "-"}{value ? ` ${value.unit}` : ""}</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{value?.freshnessSummary || "Update time unavailable"}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
        {context.sourceNote}
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">Pollutants may come from different nearby monitoring stations; this is station-derived local context, not exact street-level sensor data.</p>
    </section>
  );
}
