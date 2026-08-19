import { Activity, CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RefObject } from "react";
import { DraggableMobileAqiPanel } from "./DraggableMobileAqiPanel";

export function CpcbLayerPanel({
  totalStations,
  processedStations,
  validatedCount,
  indicativeCount,
  providerReportedCount,
  pendingCount,
  selectedDisplayStations,
  snapshotComplete,
  snapshotRefreshing,
  sourceAvailable,
  mapContainerRef
}: {
  totalStations: number;
  processedStations: number;
  validatedCount: number;
  indicativeCount: number;
  providerReportedCount: number;
  pendingCount: number;
  selectedDisplayStations: number;
  snapshotComplete: boolean;
  snapshotRefreshing: boolean;
  sourceAvailable: boolean;
  mapContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const progress = totalStations > 0 ? Math.min(100, Math.round((processedStations / totalStations) * 100)) : 0;
  return (
    <DraggableMobileAqiPanel mapContainerRef={mapContainerRef} className="mobile-aqi-coverage-panel z-[420]" storagePrefix="cleanAirMobileAqiCoveragePanel" summary={`Air Quality · ${sourceAvailable ? `Indicative ${indicativeCount}` : "Data unavailable"}`}>
      <div className="rounded-2xl border border-white/[0.12] bg-slate-950/92 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.12em] text-emerald-300"><Activity size={14} /> {t("air.mapTitle")}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t("air.aqiCoverageNote")}</p>
          </div>
          <CircleHelp size={15} className="shrink-0 text-slate-500" />
        </div>

        {snapshotRefreshing && totalStations > 0 && <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
            <span>{t("air.processingAqi", { processed: Math.min(processedStations, totalStations), total: totalStations })}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full rounded-full bg-emerald-400 transition-[width]" style={{ width: `${progress}%` }} /></div>
        </div>}

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <span className="rounded-lg bg-emerald-400/10 px-2.5 py-2 text-emerald-300">{t("air.validated", { count: validatedCount })}</span>
          <span className="rounded-lg bg-cyan-400/10 px-2.5 py-2 text-cyan-300">{t("air.indicative", { count: indicativeCount })}</span>
          <span className="rounded-lg bg-sky-400/10 px-2.5 py-2 text-sky-300">{t("air.providerReported", { count: providerReportedCount })}</span>
          <span className="rounded-lg bg-amber-400/10 px-2.5 py-2 text-amber-300">{t("air.pending", { count: pendingCount })}</span>
        </div>

        {!sourceAvailable && <p className="mt-3 text-[11px] text-amber-300">{t("air.stationDataUnavailable")}</p>}
        {sourceAvailable && selectedDisplayStations === 0 && snapshotComplete && <p className="mt-3 text-[11px] text-amber-300">{t("air.aqiUnavailable")}</p>}
        <p className="mt-3 border-t border-white/[0.08] pt-3 text-[10px] leading-relaxed text-slate-500">{t("air.aqiStationDisclaimer")}</p>
      </div>
    </DraggableMobileAqiPanel>
  );
}
