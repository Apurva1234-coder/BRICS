import { useState, useEffect } from "react";
import { apiClient } from "../services/apiClient";
import type {
  CrossBorderImpactPrediction,
  PropagationResult,
  PropagationStep
} from "../types";
import {
  Globe2,
  Wind,
  ShieldAlert,
  Clock,
  ArrowRight,
  TrendingDown,
  Navigation,
  RefreshCw,
  AlertTriangle,
  Radio,
  Send,
  Sparkles,
  Info,
  CheckCircle2
} from "lucide-react";

const PRESET_SOURCES = [
  {
    name: "Northern India (Delhi / Punjab corridor)",
    countryCode: "IND",
    flag: "🇮🇳",
    lat: 29.5,
    lng: 78.5,
    pollutant: "industrial_smoke",
    pm25: 340,
    severity: "critical"
  },
  {
    name: "Northeast China (Heilongjiang industrial basin)",
    countryCode: "CHN",
    flag: "🇨🇳",
    lat: 47.5,
    lng: 130.2,
    pollutant: "industrial_smoke",
    pm25: 290,
    severity: "severe"
  },
  {
    name: "UAE / Persian Gulf Energy Hub",
    countryCode: "ARE",
    flag: "🇦🇪",
    lat: 25.2,
    lng: 55.3,
    pollutant: "vehicle_emissions",
    pm25: 210,
    severity: "high"
  },
  {
    name: "South Africa Highveld (Mpumalanga Coal Belt)",
    countryCode: "ZAF",
    flag: "🇿🇦",
    lat: -26.2,
    lng: 29.2,
    pollutant: "industrial_smoke",
    pm25: 240,
    severity: "high"
  },
  {
    name: "Brazil / Paraná Agrobusiness Basin",
    countryCode: "BRA",
    flag: "🇧🇷",
    lat: -25.5,
    lng: -54.5,
    pollutant: "open_waste",
    pm25: 180,
    severity: "moderate"
  }
];

export function CrossBorderPropagationPanel() {
  const [activePredictions, setActivePredictions] = useState<CrossBorderImpactPrediction[]>([]);
  const [affectedSummary, setAffectedSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Simulation Form State
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [customLat, setCustomLat] = useState(PRESET_SOURCES[0].lat);
  const [customLng, setCustomLng] = useState(PRESET_SOURCES[0].lng);
  const [customPm25, setCustomPm25] = useState(PRESET_SOURCES[0].pm25);
  const [horizonHours, setHorizonHours] = useState(18);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<PropagationResult | null>(null);
  const [broadcastMessage, setBroadcastMessage] = useState<string | null>(null);

  const loadActiveData = async () => {
    try {
      setLoading(true);
      const [eventsRes, affectedRes] = await Promise.all([
        apiClient.getPropagationEvents(),
        apiClient.getAffectedCountries()
      ]);
      setActivePredictions(eventsRes.predictions || []);
      setAffectedSummary(affectedRes.affectedCountries || []);
    } catch (err) {
      console.error("Failed to load active propagation data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveData();
  }, []);

  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    const p = PRESET_SOURCES[idx];
    setCustomLat(p.lat);
    setCustomLng(p.lng);
    setCustomPm25(p.pm25);
  };

  const runSimulation = async () => {
    setSimulating(true);
    setBroadcastMessage(null);
    try {
      const preset = PRESET_SOURCES[selectedPresetIndex];
      const result = await apiClient.predictPropagation({
        sourceLatitude: customLat,
        sourceLongitude: customLng,
        sourceCountryCode: preset.countryCode,
        sourceLocality: preset.name,
        initialPm2_5: customPm25,
        pollutionType: preset.pollutant,
        horizonHours
      });

      setSimulationResult(result);
      if (result.hasCrossBorderImpact && result.crossBorderPrediction) {
        setBroadcastMessage(
          `Alert routed to ${result.crossBorderPrediction.affectedCountryName} Node: Incoming plume detected with arrival in ${result.crossBorderPrediction.estimatedArrivalHours}h!`
        );
        // Refresh active predictions
        loadActiveData();
      }
    } catch (err) {
      console.error("Simulation failed:", err);
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
      {/* Header Banner */}
      <div className="rounded-3xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-950/95 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-400 shadow-inner">
              <Globe2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-300">
                  Stage 3 Architecture
                </span>
                <span className="text-[11px] font-bold text-slate-400">BRICS Atmospheric Mesh</span>
              </div>
              <h2 className="text-lg font-black text-white sm:text-xl">Cross-Border Pollution Propagation</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={loadActiveData}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh Mesh</span>
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-300">
          Simulates Lagrangian particulate plume advection, atmospheric eddy dispersion, and exponential wet/dry decay across international boundaries. Identifies affected recipient nations, arrival timestamps, and transboundary risk ratings before plumes cross sovereign borders.
        </p>
      </div>

      {/* Recipient Countries Summary Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Recipient Nations Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {affectedSummary.map((item) => (
            <div
              key={item.countryCode}
              className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 shadow-lg backdrop-blur-md space-y-2.5 transition hover:border-cyan-500/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{item.flag}</span>
                  <div>
                    <h4 className="text-sm font-black text-white">{item.countryName}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">{item.countryCode} Airshed</span>
                  </div>
                </div>
                <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${getRiskBadge(item.highestRiskCategory)}`}>
                  {item.highestRiskCategory} RISK
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">Incoming Plumes</span>
                  <p className="font-bold text-white mt-0.5">{item.incomingPlumesCount} active</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">Earliest Arrival</span>
                  <p className="font-bold text-cyan-300 mt-0.5 flex items-center gap-1">
                    <Clock size={11} />
                    <span>~{item.earliestArrivalHours}h</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Plume Propagation Simulator */}
      <div className="rounded-3xl border border-cyan-500/20 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Wind className="text-cyan-400" size={18} />
            <div>
              <h3 className="text-sm font-black text-white">Live Plume Propagation Simulator</h3>
              <p className="text-[11px] text-slate-400">Run modular physics-based Lagrangian plume simulation across BRICS corridors</p>
            </div>
          </div>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
            Physics Lagrangian Model v1.0
          </span>
        </div>

        {/* Preset Selector */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Select Transboundary Hotspot Preset:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {PRESET_SOURCES.map((preset, idx) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleSelectPreset(idx)}
                className={`rounded-xl p-3 text-left border transition flex items-center gap-2.5 ${
                  selectedPresetIndex === idx
                    ? "border-cyan-400 bg-cyan-400/10 text-white shadow-md ring-1 ring-cyan-400/40"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className="text-xl">{preset.flag}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{preset.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {preset.lat.toFixed(1)}°N, {preset.lng.toFixed(1)}°E · {preset.pm25} µg/m³
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Parameters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Source Latitude</label>
            <input
              type="number"
              step="0.01"
              value={customLat}
              onChange={(e) => setCustomLat(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Source Longitude</label>
            <input
              type="number"
              step="0.01"
              value={customLng}
              onChange={(e) => setCustomLng(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Source PM2.5 (µg/m³)</label>
            <input
              type="number"
              value={customPm25}
              onChange={(e) => setCustomPm25(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Forecast Horizon</label>
            <select
              value={horizonHours}
              onChange={(e) => setHorizonHours(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
            >
              <option value={6}>6 Hours Horizon</option>
              <option value={12}>12 Hours Horizon</option>
              <option value={18}>18 Hours Horizon</option>
              <option value={24}>24 Hours Horizon</option>
              <option value={36}>36 Hours Horizon</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={simulating}
            onClick={runSimulation}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-6 py-2.5 text-xs font-black text-slate-950 shadow-lg transition hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50"
          >
            {simulating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{simulating ? "Calculating Atmospheric Advection..." : "Run Cross-Border Simulation"}</span>
          </button>
        </div>

        {/* Broadcast Confirmation Banner */}
        {broadcastMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 text-xs text-cyan-200">
            <Radio size={16} className="shrink-0 mt-0.5 text-cyan-400 animate-pulse" />
            <div>
              <p className="font-bold text-white">Federated Protocol Dispatch Confirmed</p>
              <p className="mt-0.5 text-cyan-300">{broadcastMessage}</p>
            </div>
          </div>
        )}

        {/* Simulation Output Card */}
        {simulationResult && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{simulationResult.source.flag}</span>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {simulationResult.source.countryName} → {simulationResult.dominantDirection} Corridor
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    Total Estimated Travel: ~{simulationResult.totalDistanceKm} km across {simulationResult.horizonHours} hours
                  </span>
                </div>
              </div>

              {simulationResult.hasCrossBorderImpact && simulationResult.crossBorderPrediction ? (
                <div className="flex items-center gap-2">
                  <span className="text-xl">{simulationResult.crossBorderPrediction.affectedFlag}</span>
                  <span className={`rounded-md border px-2.5 py-1 text-[11px] font-black uppercase tracking-wider ${getRiskBadge(simulationResult.crossBorderPrediction.riskCategory)}`}>
                    {simulationResult.crossBorderPrediction.riskCategory} CROSS-BORDER RISK ({simulationResult.crossBorderPrediction.riskScore}%)
                  </span>
                </div>
              ) : (
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 uppercase">
                  Domestic Retention / No Cross-Border Impact
                </span>
              )}
            </div>

            {/* Cross Border Impact Prediction Box */}
            {simulationResult.crossBorderPrediction && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                    <ShieldAlert size={15} />
                    <span>Cross-Border Impact Prediction Contract</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    Confidence: {simulationResult.crossBorderPrediction.confidence}% ({simulationResult.crossBorderPrediction.confidenceLevel})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400">Target Airshed</span>
                    <p className="font-bold text-white mt-0.5">
                      {simulationResult.crossBorderPrediction.affectedCountryName} ({simulationResult.crossBorderPrediction.affectedRegion})
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400">Estimated Arrival</span>
                    <p className="font-bold text-cyan-300 mt-0.5">
                      ~{simulationResult.crossBorderPrediction.estimatedArrivalHours} hours (
                      {new Date(simulationResult.crossBorderPrediction.estimatedArrivalTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400">Predicted Arrival PM2.5</span>
                    <p className="font-bold text-white mt-0.5">
                      {simulationResult.crossBorderPrediction.predictedPollutionLevel.pm2_5} µg/m³
                      <span className="text-[10px] text-slate-400 font-normal"> ({Math.round(simulationResult.crossBorderPrediction.predictedPollutionLevel.remainingRatio * 100)}% remaining)</span>
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400">Transit Wind Vector</span>
                    <p className="font-bold text-white mt-0.5">
                      {simulationResult.crossBorderPrediction.windConditions.compass} ({simulationResult.crossBorderPrediction.windConditions.directionDeg}°) · {simulationResult.crossBorderPrediction.windConditions.speedKmh} km/h
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 bg-black/40 rounded-lg p-2.5 border border-white/5">
                  <strong className="text-white">Explanation:</strong> {simulationResult.crossBorderPrediction.explanation}
                </p>
              </div>
            )}

            {/* Hourly Plume Dispersion Timeline */}
            <div>
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Hourly Plume Advection & Dilution Path:</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[10px] uppercase text-slate-400">
                      <th className="py-2 px-2">Step</th>
                      <th className="py-2 px-2">Time</th>
                      <th className="py-2 px-2">Territory / Airspace</th>
                      <th className="py-2 px-2">Distance</th>
                      <th className="py-2 px-2">Plume Radius</th>
                      <th className="py-2 px-2">Est. PM2.5</th>
                      <th className="py-2 px-2">Dilution</th>
                      <th className="py-2 px-2">Impact Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {simulationResult.steps.map((step) => {
                      const isBorderCross = step.currentCountryCode !== simulationResult.source.countryCode && step.currentCountryCode !== "INTL";
                      return (
                        <tr key={step.stepNumber} className={isBorderCross ? "bg-cyan-500/10 text-cyan-200" : "text-slate-300"}>
                          <td className="py-2 px-2 font-bold">T+{step.hoursElapsed}h</td>
                          <td className="py-2 px-2 font-sans">{new Date(step.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="py-2 px-2 font-sans font-bold flex items-center gap-1.5">
                            <span>{step.currentCountryFlag}</span>
                            <span>{step.currentCountryName}</span>
                            {isBorderCross && <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30">BORDER CROSSING</span>}
                          </td>
                          <td className="py-2 px-2">~{Math.round(step.distanceFromSourceKm)} km</td>
                          <td className="py-2 px-2">±{step.plumeRadiusKm} km</td>
                          <td className="py-2 px-2 font-bold">{step.estimatedPm2_5} µg/m³</td>
                          <td className="py-2 px-2">{Math.round(step.dilutionFactor * 100)}%</td>
                          <td className="py-2 px-2 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRiskBadge(step.impactLevel)}`}>
                              {step.impactLevel}
                            </span>
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

      {/* Active Cross-Border Corridor Feed */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Active Transboundary Incident Streams</h3>
        <div className="space-y-3">
          {activePredictions.map((pred) => (
            <div
              key={pred.predictionId}
              className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-xl backdrop-blur-md space-y-3 transition hover:border-cyan-500/30"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-base font-black text-white">
                    <span>{pred.sourceFlag} {pred.sourceCountryName}</span>
                    <ArrowRight size={14} className="text-cyan-400 mx-1" />
                    <span>{pred.affectedFlag} {pred.affectedCountryName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">({pred.affectedRegion})</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${getRiskBadge(pred.riskCategory)}`}>
                    {pred.riskCategory} RISK ({pred.riskScore}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">Pollutant</span>
                  <p className="font-bold text-white mt-0.5">{pred.sourcePollutant}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400">Estimated Arrival</span>
                  <p className="font-bold text-cyan-300 mt-0.5 flex items-center gap-1">
                    <Clock size={12} />
                    <span>In ~{pred.estimatedArrivalHours}h</span>
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400">Predicted Arrival PM2.5</span>
                  <p className="font-bold text-white mt-0.5">
                    {pred.predictedPollutionLevel.pm2_5} µg/m³
                    <span className="text-[10px] text-slate-400 font-normal"> (Ratio: {Math.round(pred.predictedPollutionLevel.remainingRatio * 100)}%)</span>
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400">Wind Direction</span>
                  <p className="font-bold text-white mt-0.5">
                    From {pred.windConditions.compass} ({pred.windConditions.directionDeg}°) at {pred.windConditions.speedKmh} km/h
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 bg-white/[0.02] rounded-xl p-3 border border-white/5">
                {pred.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
