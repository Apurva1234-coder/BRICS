import { useState, useEffect } from "react";
import { apiClient } from "../services/apiClient";
import type {
  EconomicCorridor,
  CorridorImpactPrediction,
  CorridorCityImpact,
  CorridorTimelineMilestone
} from "../types";
import {
  TrendingUp,
  Building2,
  Factory,
  Clock,
  ArrowRight,
  ShieldAlert,
  MapPin,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Navigation,
  Globe2
} from "lucide-react";

export function EconomicCorridorPanel() {
  const [corridors, setCorridors] = useState<EconomicCorridor[]>([]);
  const [activePredictions, setActivePredictions] = useState<CorridorImpactPrediction[]>([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>("corridor-delhi-lahore-central-asia");
  const [loading, setLoading] = useState(true);

  // Simulation Controls
  const [customPm25, setCustomPm25] = useState(360);
  const [horizonHours, setHorizonHours] = useState(18);
  const [simulating, setSimulating] = useState(false);
  const [simulatedPrediction, setSimulatedPrediction] = useState<CorridorImpactPrediction | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [corridorsRes, affectedRes] = await Promise.all([
        apiClient.getCorridors(),
        apiClient.getActiveCorridorPredictions()
      ]);
      setCorridors(corridorsRes.corridors || []);
      setActivePredictions(affectedRes.predictions || []);

      if (corridorsRes.corridors && corridorsRes.corridors.length > 0 && !selectedCorridorId) {
        setSelectedCorridorId(corridorsRes.corridors[0].id);
      }
    } catch (err) {
      console.error("Failed to load corridor data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedCorridor = corridors.find((c) => c.id === selectedCorridorId) || corridors[0];
  const activePrediction = simulatedPrediction && simulatedPrediction.corridorId === selectedCorridorId
    ? simulatedPrediction
    : activePredictions.find((p) => p.corridorId === selectedCorridorId);

  const handleRunSimulation = async () => {
    if (!selectedCorridor) return;
    setSimulating(true);
    try {
      const firstCity = selectedCorridor.cities[0] || { latitude: 28.6139, longitude: 77.2090 };
      const res = await apiClient.predictCorridorImpact({
        corridorId: selectedCorridor.id,
        sourceLatitude: firstCity.latitude,
        sourceLongitude: firstCity.longitude,
        sourceLocality: `${firstCity.name} Industrial Zone`,
        sourceCountryCode: firstCity.countryCode,
        initialPm2_5: customPm25,
        horizonHours
      });

      if (res.predictions && res.predictions.length > 0) {
        setSimulatedPrediction(res.predictions[0]);
        // Update active list
        await loadData();
      }
    } catch (err) {
      console.error("Corridor simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  const getRiskBadge = (category: string) => {
    const cat = category.toUpperCase();
    if (cat === "CRITICAL") return "bg-red-500/20 text-red-300 border-red-500/40";
    if (cat === "HIGH") return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    if (cat === "MEDIUM") return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ── */}
      <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900/80 to-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/10 text-amber-400 shadow-inner">
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  Stage 4 Architecture
                </span>
                <span className="text-[11px] font-bold text-slate-400">Trade & Supply Chain Protection</span>
              </div>
              <h2 className="text-lg font-black text-white sm:text-xl">Economic Corridor Intelligence</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Sync Corridors</span>
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300">
          Monitors critical cross-border logistics highways, industrial basins, and economic trade arteries across BRICS member states. Identifies at-risk cities, predicts exact sequential arrival times (T0 → City A → City B → Border → City C), and evaluates multi-lateral supply chain disruption risk.
        </p>
      </div>

      {/* ── Corridor Selection Cards ── */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">BRICS Economic Trade Corridors</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {corridors.map((c) => {
            const pred = activePredictions.find((p) => p.corridorId === c.id);
            const isSelected = selectedCorridorId === c.id;

            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedCorridorId(c.id);
                  setSimulatedPrediction(null);
                }}
                className={`rounded-2xl p-4 text-left border transition relative backdrop-blur-md ${
                  isSelected
                    ? "border-amber-400 bg-amber-400/10 ring-1 ring-amber-400/40 shadow-lg"
                    : "border-white/10 bg-slate-950/80 hover:bg-white/[0.04] hover:border-white/20"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                      <span>{c.countries.join(" · ")}</span>
                      <span>·</span>
                      <span>{c.totalLengthKm} km</span>
                    </div>
                    <h4 className="text-sm font-black text-white mt-1">{c.name}</h4>
                  </div>
                  {pred ? (
                    <span className={`rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getRiskBadge(pred.corridorRiskCategory)}`}>
                      {pred.corridorRiskCategory} RISK ({pred.corridorRiskScore}%)
                    </span>
                  ) : (
                    <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300 uppercase">
                      MONITORED
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">{c.description}</p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {c.cities.slice(0, 3).map((city) => (
                    <span key={city.id} className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-slate-300">
                      {city.countryFlag} {city.name.split(" ")[0]}
                    </span>
                  ))}
                  {c.cities.length > 3 && (
                    <span className="text-slate-500 font-bold">+{c.cities.length - 3} more</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Corridor Intelligence Detail ── */}
      {selectedCorridor && (
        <div className="rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Corridor Profile Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-400/20 text-amber-300 text-[10px] font-black px-2 py-0.5 uppercase border border-amber-400/30">
                  {selectedCorridor.importance} IMPORTANCE
                </span>
                <span className="text-xs text-slate-400 font-mono">Length: {selectedCorridor.totalLengthKm} km</span>
              </div>
              <h3 className="text-lg font-black text-white mt-1.5">{selectedCorridor.name}</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">{selectedCorridor.description}</p>
            </div>

            {/* Quick Simulation Trigger */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold uppercase text-slate-400">Release PM2.5:</label>
                <input
                  type="number"
                  value={customPm25}
                  onChange={(e) => setCustomPm25(Number(e.target.value))}
                  className="w-20 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={simulating}
                onClick={handleRunSimulation}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-xs font-black text-slate-950 shadow-lg transition hover:from-amber-400 hover:to-orange-400 disabled:opacity-50"
              >
                {simulating ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>{simulating ? "Calculating Impact..." : "Forecast Corridor Spike"}</span>
              </button>
            </div>
          </div>

          {/* Impact Status Banner if Corridor is Threatened */}
          {activePrediction && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <ShieldAlert size={20} className="text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Corridor Pollution Exposure Assessment</h4>
                    <span className="text-[10px] text-slate-400">
                      Earliest City Impact: ~{activePrediction.earliestArrivalHours} hours · Peak PM2.5: {activePrediction.maxPredictedPm2_5} µg/m³
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${getRiskBadge(activePrediction.corridorRiskCategory)}`}>
                    {activePrediction.corridorRiskCategory} RISK ({activePrediction.corridorRiskScore}%)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Confidence: {activePrediction.confidence}% ({activePrediction.confidenceLevel})
                  </span>
                </div>
              </div>

              {/* Sequential Arrival Timeline */}
              <div>
                <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-3">
                  Sequential Pollution Propagation Timeline Along Corridor:
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {activePrediction.timelineSummary.map((m, idx) => {
                    const isBorder = m.type === "border";
                    const isSource = m.type === "source";

                    return (
                      <div
                        key={idx}
                        className={`rounded-xl p-3 border relative space-y-1.5 transition ${
                          isBorder
                            ? "border-red-500/40 bg-red-500/10 text-red-200"
                            : isSource
                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                            : "border-white/10 bg-white/[0.02] text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider font-mono">
                            {isSource ? "T0 Release" : `T+${m.stepHours}h Impact`}
                          </span>
                          <span className="text-xs font-black font-mono">{m.pm2_5} µg/m³</span>
                        </div>

                        <p className="text-xs font-bold text-white leading-snug">{m.label}</p>
                        <p className="text-[10px] text-slate-400 leading-tight">{m.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="text-[11px] text-slate-300 bg-black/40 rounded-xl p-3 border border-white/5">
                <strong className="text-white">Explanation:</strong> {activePrediction.explanation}
              </p>
            </div>
          )}

          {/* ── Cities & Industrial Hubs Table ── */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Corridor Economic Nodes & Manufacturing Facilities
            </h4>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase text-slate-400 bg-white/[0.02]">
                    <th className="py-3 px-3">City / Industrial Node</th>
                    <th className="py-3 px-3">Corridor Marker</th>
                    <th className="py-3 px-3">Population</th>
                    <th className="py-3 px-3">Economic Output Weight</th>
                    <th className="py-3 px-3">Industrial Specialization</th>
                    <th className="py-3 px-3">Arrival Forecast</th>
                    <th className="py-3 px-3">Predicted PM2.5</th>
                    <th className="py-3 px-3">Disruption Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {selectedCorridor.cities.map((city) => {
                    const cityImpact = activePrediction?.affectedCities.find((ac) => ac.cityId === city.id);

                    return (
                      <tr key={city.id} className={cityImpact ? "bg-amber-500/[0.06] text-white" : "text-slate-300"}>
                        <td className="py-3 px-3 font-bold flex items-center gap-2">
                          <span className="text-base">{city.countryFlag}</span>
                          <span>{city.name}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">Km {city.corridorKmMarker}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {(city.populationEstimate / 1000000).toFixed(1)}M
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-amber-300">{city.economicWeight}/10</span>
                            <div className="h-1.5 w-12 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${city.economicWeight * 10}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-400 max-w-xs">{city.industrialFocus}</td>
                        <td className="py-3 px-3 font-mono">
                          {cityImpact ? (
                            <span className="text-amber-300 font-bold flex items-center gap-1">
                              <Clock size={11} />
                              <span>T+{cityImpact.estimatedArrivalHours}h</span>
                            </span>
                          ) : (
                            <span className="text-slate-500">Unexposed</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono">
                          {cityImpact ? (
                            <span className="font-bold text-white">{cityImpact.predictedPm2_5} µg/m³</span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {cityImpact ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getRiskBadge(cityImpact.economicDisruptionRisk)}`}>
                              {cityImpact.economicDisruptionRisk}
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-bold uppercase">SAFE</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
