import { Loader2, RefreshCw, Satellite } from "lucide-react";
import type { SatelliteEvidence } from "../types";
import { toPublicSatelliteStatus } from "../utils/satelliteStatus";

function resultLabel(evidence: SatelliteEvidence) {
  if (evidence.status === "pending") return "Satellite context check queued";
  if (evidence.status === "processing") return "Checking available satellite imagery";
  if (evidence.status === "unavailable" || evidence.status === "failed") return "Satellite context unavailable";
  if (evidence.observability.status === "cloud_obscured") return "Cloud-obscured";
  if (evidence.observability.status === "temporal_mismatch") return "Temporal mismatch";
  if (evidence.observability.status === "not_suitable_for_event_type" || evidence.observability.status === "not_suitable_for_resolution") return "Not suitable";
  switch (evidence.assessment.result) {
    case "potentially_consistent": return "Potentially consistent";
    case "possible_surface_change": return "Possible surface change";
    case "no_observable_signal": return "No observable signal";
    case "contradictory_context": return "Contradictory context";
    case "not_observable": return "Not observable";
    default: return "Inconclusive";
  }
}

function metric(evidence: SatelliteEvidence, name: string) {
  const item = evidence.metrics.find(value => value.name === name);
  return item?.value === undefined ? "—" : `${item.value.toFixed(name.includes("percent") ? 1 : 2)}${item.unit === "%" ? "%" : ""}`;
}

export function SatelliteEvidenceCard({ evidence, compact, loading, onRetry }: { evidence?: SatelliteEvidence | null; reportId?: string; compact?: boolean; loading?: boolean; onRetry?: () => void }) {
  if (!evidence) return null;
  const busy = loading || evidence.status === "pending" || evidence.status === "processing";
  const terminalUnavailable = evidence.status === "unavailable" || evidence.status === "failed";
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.025] overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white"><Satellite size={16} className="text-slate-400" /><span className="text-sm font-semibold">Satellite context</span></div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">{busy ? <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Processing</span> : resultLabel(evidence)}</span>
        </div>
        <p className="text-[13px] leading-relaxed text-slate-300">{busy ? (evidence.status === "pending" ? "Satellite context check queued." : "Checking available satellite imagery.") : toPublicSatelliteStatus(evidence)}</p>
        {terminalUnavailable && <p className="text-[12px] text-slate-500">This does not invalidate the citizen report.</p>}
        {!busy && !terminalUnavailable && <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-[12px] text-slate-400">
          <span>Photo captured <strong className="block text-slate-200">{new Date(evidence.eventTime.photoCapturedAt).toLocaleString()}</strong></span>
          <span>Event suitability <strong className="block text-slate-200 capitalize">{evidence.eventSuitability.level.replace(/_/g, " ")}</strong></span>
          <span>Satellite acquisition <strong className="block text-slate-200">{evidence.scenes.nearReport ? new Date(evidence.scenes.nearReport.acquisitionTime).toLocaleString() : "—"}</strong></span>
          <span>Temporal difference <strong className="block text-slate-200">{evidence.observability.temporalOffsetHours === undefined ? "—" : `${Math.abs(evidence.observability.temporalOffsetHours).toFixed(1)} hours`}</strong></span>
          <span>Local cloud <strong className="block text-slate-200">{evidence.observability.localCloudPercent === undefined ? "—" : `${evidence.observability.localCloudPercent.toFixed(1)}%`}</strong></span>
          <span>Valid analysis pixels <strong className="block text-slate-200">{evidence.observability.validPixelPercent === undefined ? "—" : `${evidence.observability.validPixelPercent.toFixed(1)}%`}</strong></span>
          <span>AOI radius <strong className="block text-slate-200">{evidence.reportLocation.aoiRadiusMeters} m</strong></span>
          <span>Context points <strong className="block text-slate-200">{evidence.evidenceContributionPoints}/10</strong></span>
        </div>}
        {!compact && !busy && !terminalUnavailable && <>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-400">
            <span>Geometry pixels <strong className="text-slate-200">{metric(evidence, "geometry_pixel_count")}</strong></span>
            <span>Local cloud <strong className="text-slate-200">{metric(evidence, "local_cloud_percent")}</strong></span>
            <span>NBR context <strong className="text-slate-200">{metric(evidence, "nbr")}</strong></span>
            <span>BSI context <strong className="text-slate-200">{metric(evidence, "bsi")}</strong></span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(["nearTrueColor", "baselineTrueColor", "followUpTrueColor", "swirNirContext", "nbrContext", "changeContext", "bareSurfaceContext"] as const).map(key => evidence.products[key] && <img key={key} src={evidence.products[key]} alt={key.replace(/([A-Z])/g, " $1")} className="aspect-square w-full rounded-lg border border-white/10 object-cover bg-black/20" />)}
          </div>
          <div className="text-[12px] leading-relaxed text-slate-400"><strong className="text-slate-300">Assessment:</strong> {evidence.assessment.explanation}</div>
          {evidence.assessment.limitations.length > 0 && <ul className="list-disc pl-4 text-[11px] leading-relaxed text-slate-500">{evidence.assessment.limitations.map(item => <li key={item}>{item}</li>)}</ul>}
          <p className="text-[11px] text-slate-500">{evidence.attribution}</p>
        </>}
        {onRetry && terminalUnavailable && <button onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"><RefreshCw size={14} /> Retry context check</button>}
      </div>
    </section>
  );
}
