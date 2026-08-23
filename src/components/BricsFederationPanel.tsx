import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Clock3, Globe2, Play, Radio, RefreshCw, Wind } from "lucide-react";
import { apiClient } from "../services/apiClient";
import type { BricsCountryNode, LiveFederationExchangeResponse } from "../types";
import { EconomicCorridorPanel } from "./EconomicCorridorPanel";
import { RegulatoryCoordinationPanel } from "./RegulatoryCoordinationPanel";

export type FederationSection = "propagation" | "corridors" | "regulatory";

export function BricsFederationPanel({ section = "propagation" }: { section?: FederationSection }) {
  const showFederationHeader = false;
  const [nodes, setNodes] = useState<BricsCountryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [exchangeStep, setExchangeStep] = useState(0);
  const [exchangeResult, setExchangeResult] = useState<LiveFederationExchangeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const loadFederationData = async () => {
    setLoading(true); setError(null);
    try { const response = await apiClient.getBricsNodes(); setNodes(response.nodes || []); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load federation nodes."); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadFederationData(); }, []);

  const runPredictionFlow = async () => {
    setIsSimulating(true); setError(null); setExchangeStep(1);
    try {
      await new Promise((resolve) => setTimeout(resolve, 450)); setExchangeStep(2);
      const response = await apiClient.triggerLiveFederationExchange({
        sourceCountry: "IND", targetCountry: "CHN", latitude: 28.6289, longitude: 77.2065,
        locality: "Delhi NCR, India", pollutionType: "crop_burning", pm2_5: 395, pm10: 510,
        aqi: 435, severity: "critical", horizonHours: 12
      });
      if (!response.success) throw new Error("Federation prediction pipeline returned failure.");
      setExchangeStep(3); await new Promise((resolve) => setTimeout(resolve, 450));
      setExchangeStep(4); setExchangeResult(response); await loadFederationData();
    } catch (err) { setError(err instanceof Error ? err.message : "Prediction flow failed."); setExchangeResult(null); }
    finally { setIsSimulating(false); }
  };

  const arrivalHours = exchangeResult?.crossBorderPrediction?.estimatedArrivalHours || 8;
  const predictedPm = exchangeResult?.crossBorderPrediction?.predictedPollutionLevel.pm2_5 || 142;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#070908] text-slate-100">
      <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 lg:p-8">
        {showFederationHeader && <header className="flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Live federation network</div>
            <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl"><Globe2 className="text-emerald-400" size={28} /> BRICS Federation</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Cross-border pollution intelligence and coordinated response.</p>
          </div>
          <button type="button" onClick={loadFederationData} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/[0.09] md:self-auto"><RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : "text-slate-400"} /> Sync network</button>
        </header>}

        {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"><AlertTriangle size={16} className="shrink-0 text-red-400" />{error}</div>}
        {section === "corridors" ? <EconomicCorridorPanel /> : section === "regulatory" ? <RegulatoryCoordinationPanel /> : (
          <>
            <section className="overflow-hidden rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-950/50 via-slate-950 to-slate-950 shadow-2xl">
              <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-400">Cross-border propagation</p><h2 className="mt-1 text-xl font-black text-white sm:text-2xl">From detection to predicted impact</h2><p className="mt-1 text-xs text-slate-400">A pollution alert is shared across the BRICS network before it reaches the next affected country.</p></div>
                <button type="button" onClick={runPredictionFlow} disabled={isSimulating} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-xs font-black text-[#07100c] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"><Play size={14} className={isSimulating ? "animate-pulse" : "fill-current"} />{isSimulating ? "Running prediction" : "Run prediction flow"}</button>
              </div>
              <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:divide-x sm:divide-y-0">
                <FlowStep active={exchangeStep >= 1} tone="orange" label="01 · Pollution detected"><div className="flex items-start justify-between gap-3"><div><div className="text-lg font-black text-white">🇮🇳 India</div><p className="mt-1 text-xs text-slate-400">Delhi NCR · crop burning</p></div><div className="text-right"><div className="font-mono text-lg font-black text-orange-200">PM2.5 395</div><p className="mt-1 text-[10px] font-bold uppercase text-red-300">Critical · AQI 435</p></div></div></FlowStep>
                <div className="hidden items-center justify-center sm:flex"><ArrowRight className="text-slate-600" size={20} /></div>
                <FlowStep active={exchangeStep >= 2} tone="cyan" label="02 · Shared securely"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-300/10"><Radio size={21} className="text-cyan-300" /></div><div><div className="text-lg font-black text-white">BRICS Network</div><p className="mt-1 text-xs text-slate-400">Standardized alert broadcast</p></div></div></FlowStep>
                <div className="hidden items-center justify-center sm:flex"><ArrowRight className="text-slate-600" size={20} /></div>
                <FlowStep active={exchangeStep >= 4} tone="purple" label="03 · Predicted impact"><div className="flex items-start justify-between gap-3"><div><div className="text-lg font-black text-white">🇨🇳 China</div><p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Clock3 size={12} /> Expected in ~{arrivalHours} hours</p></div><div className="text-right"><div className="font-mono text-lg font-black text-purple-200">PM2.5 ~{predictedPm}</div><p className="mt-1 text-[10px] font-bold uppercase text-purple-300">High impact</p></div></div></FlowStep>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Network reach</p><h3 className="mt-1 text-sm font-bold text-white">Connected BRICS country nodes</h3></div><span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> All active</span></div><div className="mt-5 flex flex-wrap gap-2">{nodes.map((node) => <div key={node.nodeId} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2"><span className="text-base">{node.flag}</span><span className="text-xs font-semibold text-slate-200">{node.countryName}</span><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /></div>)}</div></div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">How to read this</p><div className="mt-4 space-y-3 text-xs text-slate-300"><div className="flex gap-3"><span className="text-orange-300">01</span><span>Where pollution started</span></div><div className="flex gap-3"><span className="text-cyan-300">02</span><span>How the federation shares it</span></div><div className="flex gap-3"><span className="text-purple-300">03</span><span>Where it may go and what to expect</span></div></div></div>
            </section>

            <div className="rounded-2xl border border-white/10 bg-slate-950/50"><button type="button" onClick={() => setShowTechnicalDetails((value) => !value)} className="flex w-full items-center justify-between p-4 text-xs font-bold text-slate-400 transition hover:text-white"><span className="flex items-center gap-2"><Wind size={14} className="text-emerald-400" /> Prediction details</span>{showTechnicalDetails ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>{showTechnicalDetails && <div className="grid gap-3 border-t border-white/10 p-4 text-xs text-slate-400 sm:grid-cols-3"><div><span className="text-slate-500">Atmospheric context</span><p className="mt-1 text-white">{exchangeResult?.meteorologicalContext ? `${exchangeResult.meteorologicalContext.windSpeedKmh} km/h from ${exchangeResult.meteorologicalContext.windDirectionCompass}` : "Available after a prediction run"}</p></div><div><span className="text-slate-500">Prediction engine</span><p className="mt-1 text-white">RuleBasedLagrangianModel v1.0</p></div><div><span className="text-slate-500">Target node</span><p className="mt-1 text-emerald-300">{exchangeResult?.targetNodeReceipt ? `China (${exchangeResult.targetNodeReceipt.status})` : "Ready for exchange"}</p></div></div>}</div>
          </>
        )}
      </div>
    </div>
  );
}

function FlowStep({ active, tone, label, children }: { active: boolean; tone: "orange" | "cyan" | "purple"; label: string; children: React.ReactNode }) {
  const tones = { orange: "text-orange-300", cyan: "text-cyan-300", purple: "text-purple-300" };
  return <div className={`p-5 sm:p-6 ${active ? "bg-white/[0.035]" : ""}`}><p className={`text-[10px] font-bold uppercase tracking-widest ${tones[tone]}`}>{label}</p><div className="mt-4">{children}</div>{active && <CheckCircle2 size={15} className={`mt-5 ${tones[tone]}`} />}</div>;
}
