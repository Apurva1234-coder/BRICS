import { RadioTower, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { AirQualityPanel } from "./AirQualityPanel";
import type { AirQualitySourcesResponse } from "../types";

function SourceCard({
  title,
  subtitle,
  usable,
  reason,
  children
}: {
  title: string;
  subtitle: string;
  usable: boolean;
  reason: string;
  children?: ReactNode;
}) {
  return (
    <div className="aq-source-card">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className={usable ? "source-pill source-pill-ok" : "source-pill"}>
          {usable ? "Live" : "Unavailable"}
        </span>
      </div>
      {children || <p className="rounded-lg border border-line bg-ink/50 p-3 text-sm text-slate-400">{reason}</p>}
    </div>
  );
}

export function AirQualitySourcesPanel({
  sources,
  loading,
  error,
  focusLabel
}: {
  sources: AirQualitySourcesResponse | null;
  loading: boolean;
  error: string | null;
  focusLabel: string;
}) {
  return (
    <section className="aq-sheet">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Air quality layer</span>
          <h2 className="mt-3 text-2xl font-semibold text-white">Measured station context</h2>
          <p className="mt-1 text-sm text-slate-400">
            Showing both sources for {focusLabel}. Values are station-derived local context, not exact street-level sensor data.
          </p>
        </div>
        {sources && (
          <div className="selected-provider">
            <ShieldCheck size={18} />
            <span>
              Selected provider
              <strong>{sources.selectedProvider.replace(/_/g, " ")}</strong>
            </span>
          </div>
        )}
      </div>

      {loading && <p className="rounded-lg border border-line bg-ink/50 p-4 text-sm text-slate-300">Loading AQI sources...</p>}
      {error && <p className="rounded-lg border border-severe/40 bg-severe/10 p-4 text-sm text-severe">{error}</p>}

      {sources && (
        <div className="grid gap-3 lg:grid-cols-2">
          <SourceCard
            title="CPCB / data.gov.in"
            subtitle="Nearest official station pollutant readings"
            usable={sources.cpcb.usable}
            reason={sources.cpcb.reason}
          >
            {sources.cpcb.value && <AirQualityPanel airQuality={sources.cpcb.value} compact />}
          </SourceCard>
          <SourceCard
            title="OpenAQ v3"
            subtitle="Supplementary monitoring locations and measurements"
            usable={Boolean(sources.openaq?.usable)}
            reason={sources.openaq?.reason || "OpenAQ status unavailable."}
          >
            {sources.openaq?.value && <AirQualityPanel airQuality={sources.openaq.value} compact />}
          </SourceCard>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="aq-note">
          <RadioTower size={18} />
          <span>Estimated Indian AQI uses eligible station averages; it is not exact street-level sensor data.</span>
        </div>
        <div className="aq-note">
          <RadioTower size={18} />
          <span>CPCB confirms official nearby pollutant readings for municipal context.</span>
        </div>
      </div>
    </section>
  );
}
