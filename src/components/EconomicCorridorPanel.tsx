import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, Clock3, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { apiClient } from "../services/apiClient";
import type { CorridorImpactPrediction, EconomicCorridor } from "../types";

export function EconomicCorridorPanel() {
  const [corridors, setCorridors] = useState<EconomicCorridor[]>([]);
  const [activePredictions, setActivePredictions] = useState<CorridorImpactPrediction[]>([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState("corridor-delhi-lahore-central-asia");
  const [loading, setLoading] = useState(true);
  const [customPm25, setCustomPm25] = useState(360);
  const [horizonHours, setHorizonHours] = useState(18);
  const [simulating, setSimulating] = useState(false);
  const [simulatedPrediction, setSimulatedPrediction] = useState<CorridorImpactPrediction | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [corridorsRes, affectedRes] = await Promise.all([apiClient.getCorridors(), apiClient.getActiveCorridorPredictions()]);
      setCorridors(corridorsRes.corridors || []);
      setActivePredictions(affectedRes.predictions || []);
      if (corridorsRes.corridors?.length && !selectedCorridorId) setSelectedCorridorId(corridorsRes.corridors[0].id);
    } catch (err) {
      console.error("Failed to load corridor data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const selectedCorridor = corridors.find((corridor) => corridor.id === selectedCorridorId) || corridors[0];
  const activePrediction = simulatedPrediction?.corridorId === selectedCorridorId
    ? simulatedPrediction
    : activePredictions.find((prediction) => prediction.corridorId === selectedCorridorId);

  const handleRunSimulation = async () => {
    if (!selectedCorridor) return;
    setSimulating(true);
    try {
      const firstCity = selectedCorridor.cities[0] || { latitude: 28.6139, longitude: 77.2090 };
      const response = await apiClient.predictCorridorImpact({
        corridorId: selectedCorridor.id,
        sourceLatitude: firstCity.latitude,
        sourceLongitude: firstCity.longitude,
        sourceLocality: `${firstCity.name} Industrial Zone`,
        sourceCountryCode: firstCity.countryCode,
        initialPm2_5: customPm25,
        horizonHours
      });
      if (response.predictions?.length) {
        setSimulatedPrediction(response.predictions[0]);
        await loadData();
      }
    } catch (err) {
      console.error("Corridor simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  const riskClass = (category: string) => {
    const normalized = category.toUpperCase();
    if (normalized === "CRITICAL") return "border-red-400/35 bg-red-500/10 text-red-300";
    if (normalized === "HIGH") return "border-orange-400/35 bg-orange-500/10 text-orange-300";
    if (normalized === "MEDIUM") return "border-amber-400/35 bg-amber-500/10 text-amber-300";
    return "border-emerald-400/35 bg-emerald-500/10 text-emerald-300";
  };

  const cityImpact = (cityId: string) => activePrediction?.affectedCities.find((city) => city.cityId === cityId);
  const milestoneRisk = (label: string, type: string) => {
    if (type === "source") return "CRITICAL";
    const match = activePrediction?.affectedCities.find((city) => label.toLowerCase().includes(city.cityName.toLowerCase()));
    return match?.economicDisruptionRisk || (type === "border" ? activePrediction?.corridorRiskCategory || "HIGH" : "HIGH");
  };
  const affectedCityRecords = selectedCorridor ? selectedCorridor.cities.filter((city) => cityImpact(city.id)) : [];
  const affectedCountries = new Set(affectedCityRecords.map((city) => city.countryCode)).size;
  const criticalLocations = affectedCityRecords.filter((city) => cityImpact(city.id)?.economicDisruptionRisk.toUpperCase() === "CRITICAL").length;
  const highLocations = affectedCityRecords.filter((city) => ["HIGH", "CRITICAL"].includes(cityImpact(city.id)?.economicDisruptionRisk.toUpperCase() || "")).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300"><TrendingUp size={14} /> Trade route intelligence</div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl">Economic Corridors</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Track pollution movement across important trade and industrial routes.</p>
        </div>
        <button type="button" onClick={loadData} disabled={loading} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white sm:self-auto"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Sync Corridors</button>
      </header>

      <section className="space-y-3">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">1 · Choose a route</p><h3 className="mt-1 text-sm font-bold text-white">Available trade corridors</h3></div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {corridors.map((corridor) => {
            const prediction = activePredictions.find((item) => item.corridorId === corridor.id);
            const selected = selectedCorridorId === corridor.id;
            return <button key={corridor.id} type="button" onClick={() => { setSelectedCorridorId(corridor.id); setSimulatedPrediction(null); }} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-amber-300 bg-amber-400/10 ring-1 ring-amber-300/40" : "border-white/10 bg-slate-950/70 hover:border-white/25 hover:bg-white/[0.04]"}`}>
              <div className="flex items-start justify-between gap-3"><h4 className="text-sm font-black leading-snug text-white">{corridor.name}</h4><span className={`shrink-0 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${prediction ? riskClass(prediction.corridorRiskCategory) : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"}`}>{prediction ? `${prediction.corridorRiskCategory} risk` : "Monitored"}</span></div>
              <div className="mt-4 flex items-center gap-3 text-xs font-semibold text-slate-300"><span>{corridor.countries.join(" → ")}</span><span className="h-1 w-1 rounded-full bg-slate-600" /><span>{corridor.totalLengthKm} km</span></div>
            </button>;
          })}
        </div>
      </section>

      {selectedCorridor && <section className="space-y-5 rounded-3xl border border-white/10 bg-slate-950/75 p-5 shadow-xl sm:p-7">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">2 · Selected corridor</p><h3 className="mt-2 text-xl font-black text-white">{selectedCorridor.name}</h3><p className="mt-1 text-sm text-slate-400">{selectedCorridor.countries.join(" → ")} <span className="px-2 text-slate-600">·</span> {selectedCorridor.totalLengthKm} km</p><div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200">{selectedCorridor.cities.slice(0, 3).map((city, index) => <span key={city.id} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2"><span>{city.countryFlag}</span>{city.name}</span>)}{selectedCorridor.cities.length > 3 && <span className="text-slate-500">+{selectedCorridor.cities.length - 3} locations</span>}<span className="text-slate-600">SOURCE → MOVEMENT → BORDER</span></div></div>

        <div className="flex flex-col gap-4 rounded-2xl border border-amber-300/20 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-end sm:justify-between">
          <div><label htmlFor="corridor-pm25" className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200">PM2.5 at Source</label><p className="mt-1 text-xs text-slate-400">Starting pollution level used for the corridor forecast.</p><div className="mt-3 flex items-center gap-2"><input id="corridor-pm25" type="number" value={customPm25} onChange={(event) => setCustomPm25(Number(event.target.value))} className="w-32 rounded-xl border border-white/15 bg-black/20 px-3 py-2 font-mono text-lg font-black text-white outline-none focus:border-amber-300" /><span className="text-xs text-slate-400">µg/m³</span></div></div>
          <button type="button" disabled={simulating} onClick={handleRunSimulation} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-3 text-xs font-black text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"><Sparkles size={14} />{simulating ? "Forecasting…" : "Forecast Impact"}</button>
        </div>

        {activePrediction ? <><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">3 · Pollution movement</p><h3 className="mt-1 text-base font-black text-white">Predicted arrival along the corridor</h3></div><span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${riskClass(activePrediction.corridorRiskCategory)}`}>{activePrediction.corridorRiskCategory} corridor risk</span></div>
          <div className="grid gap-2 lg:grid-cols-6">{activePrediction.timelineSummary.map((milestone, index) => { const risk = milestoneRisk(milestone.label, milestone.type); return <div key={index} className="relative"><div className={`rounded-2xl border p-3 ${milestone.type === "border" ? "border-red-400/35 bg-red-500/10" : milestone.type === "source" ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/10 bg-white/[0.03]"}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase text-slate-400">{milestone.type === "source" ? "Now" : `+${milestone.stepHours}h`}</span><Clock3 size={13} className="text-slate-500" /></div><h4 className="mt-3 text-sm font-black text-white">{milestone.label}</h4><p className="mt-1 font-mono text-sm font-bold text-amber-200">{milestone.pm2_5} µg/m³</p><p className={`mt-2 text-[10px] font-black uppercase ${riskClass(risk).split(" ").find((token) => token.startsWith("text-")) || "text-slate-400"}`}>{risk}</p></div>{index < activePrediction.timelineSummary.length - 1 && <ArrowDown className="mx-auto my-1 text-slate-600 lg:hidden" size={16} />}</div>; })}</div>
        </> : <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-400"><AlertTriangle className="mx-auto mb-2 text-amber-300" size={18} />Run Forecast Impact to see predicted city arrivals and risk.</div>}

        {activePrediction && <section className="space-y-4 border-t border-white/10 pt-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">4 · Economic impact</p><h3 className="mt-1 text-base font-black text-white">What this could affect</h3></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><ImpactMetric label="Affected locations" value={affectedCityRecords.length} /><ImpactMetric label="Countries affected" value={affectedCountries} /><ImpactMetric label="Critical locations" value={criticalLocations} /><ImpactMetric label="High-risk locations" value={highLocations} /></div><div className="grid gap-3 md:grid-cols-3">{affectedCityRecords.sort((a, b) => b.economicWeight - a.economicWeight).slice(0, 3).map((city) => { const impact = cityImpact(city.id)!; return <div key={city.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><span className="text-xl">{city.countryFlag}</span><h4 className="text-sm font-black text-white">{city.name}</h4></div><span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${riskClass(impact.economicDisruptionRisk)}`}>{impact.economicDisruptionRisk}</span></div><div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-500">Economic importance</span><span className="font-black text-amber-200">{city.economicWeight}/10</span></div></div>; })}</div></section>}

      </section>}
    </div>
  );
}

function ImpactMetric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>;
}
