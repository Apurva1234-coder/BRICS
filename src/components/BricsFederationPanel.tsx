import { useState, useEffect } from "react";
import { apiClient } from "../services/apiClient";
import type {
  BricsCountryNode,
  BricsFederationEvent,
  BricsFederationStatusResponse,
  LiveFederationExchangeResponse
} from "../types";
import {
  Globe,
  Radio,
  ArrowRight,
  RefreshCw,
  Wind,
  CheckCircle2,
  AlertTriangle,
  Play,
  ChevronDown,
  ChevronUp,
  MapPin,
  TrendingUp,
  ShieldAlert,
  Flame,
  Clock,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { CrossBorderPropagationPanel } from "./CrossBorderPropagationPanel";
import { EconomicCorridorPanel } from "./EconomicCorridorPanel";
import { RegulatoryCoordinationPanel } from "./RegulatoryCoordinationPanel";

export function BricsFederationPanel() {
  const [nodes, setNodes] = useState<BricsCountryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [exchangeStep, setExchangeStep] = useState<number>(0);
  const [exchangeResult, setExchangeResult] = useState<LiveFederationExchangeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<"workflow" | "propagation" | "corridors" | "regulatory">("workflow");

  const loadFederationData = async () => {
    setLoading(true);
    setError(null);
    try {
      const nodesRes = await apiClient.getBricsNodes();
      setNodes(nodesRes.nodes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load BRICS country nodes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFederationData();
  }, []);

  const runPredictionFlow = async () => {
    setIsSimulating(true);
    setError(null);
    setExchangeStep(1);

    try {
      // Step 1: Detect pollution in India
      await new Promise((r) => setTimeout(r, 450));
      setExchangeStep(2);

      // Step 2: Call backend live exchange pipeline
      const res = await apiClient.triggerLiveFederationExchange({
        sourceCountry: "IND",
        targetCountry: "CHN",
        latitude: 28.6289,
        longitude: 77.2065,
        locality: "Delhi NCR, India",
        pollutionType: "crop_burning",
        pm2_5: 395,
        pm10: 510,
        aqi: 435,
        severity: "critical",
        horizonHours: 12
      });

      if (!res.success) {
        throw new Error("Federation prediction pipeline returned failure.");
      }

      // Step 3: BRICS Network Broadcasts
      setExchangeStep(3);
      await new Promise((r) => setTimeout(r, 450));

      // Step 4: China receives & predicts impact
      setExchangeStep(4);
      setExchangeResult(res);

      await loadFederationData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction flow failed.");
      setExchangeResult(null);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#070908] text-slate-100 p-4 lg:p-6 space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
              BRICS Climate Intelligence
            </span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <Globe className="text-emerald-400" size={24} />
            BRICS Pollution Sharing & Cross-Border Prediction
          </h1>
          <p className="text-xs lg:text-sm text-slate-400 mt-1 max-w-3xl">
            When severe pollution is detected in one country, it is instantly shared across the BRICS network to predict when and how neighboring countries will be affected.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadFederationData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : "text-slate-400"} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("workflow")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "workflow"
              ? "bg-emerald-400/20 text-emerald-300 ring-1 ring-emerald-400/40 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Radio size={14} />
          <span>Federation Workflow</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("propagation")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "propagation"
              ? "bg-cyan-400/20 text-cyan-300 ring-1 ring-cyan-400/40 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Wind size={14} />
          <span>Cross-Border Propagation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("corridors")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "corridors"
              ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <TrendingUp size={14} />
          <span>Economic Corridors</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("regulatory")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
            activeTab === "regulatory"
              ? "bg-purple-400/20 text-purple-300 ring-1 ring-purple-400/40 shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <ShieldAlert size={14} />
          <span>Regulatory Coordination</span>
        </button>
      </div>

      {activeTab === "regulatory" ? (
        <RegulatoryCoordinationPanel />
      ) : activeTab === "corridors" ? (
        <EconomicCorridorPanel />
      ) : activeTab === "propagation" ? (
        <CrossBorderPropagationPanel />
      ) : (
        <>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── 1. The Main 5-Second Visual Workflow Banner ── */}
          <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-950/40 via-slate-950/90 to-slate-950/90 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Core Workflow
                </span>
                <h2 className="text-base font-bold text-white mt-0.5">
                  India 🇮🇳 → BRICS Network → China 🇨🇳 Cross-Border Flow
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click the button to simulate a real-time event transmission and see the predicted arrival time and impact.
                </p>
              </div>

              <button
                type="button"
                onClick={runPredictionFlow}
                disabled={isSimulating}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 shrink-0"
              >
                <Play size={14} className={isSimulating ? "animate-pulse" : "fill-current"} />
                <span>{isSimulating ? "Running Prediction..." : "Run Prediction Flow"}</span>
              </button>
            </div>

            {/* Visual Step-by-Step Flow Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-3 border-t border-white/10">
              {/* Step 1 */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  exchangeStep >= 1
                    ? "border-orange-400/50 bg-orange-400/10 text-white shadow-sm"
                    : "border-white/5 bg-white/[0.02] text-slate-500"
                }`}
              >
                <div className="text-[10px] uppercase font-bold text-orange-300">1. Source Country</div>
                <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                  <span>🇮🇳 India</span>
                  {exchangeStep >= 1 && <CheckCircle2 size={12} className="text-orange-400 ml-auto" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Delhi NCR Airshed</div>
              </div>

              {/* Step 2 */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  exchangeStep >= 2
                    ? "border-red-400/50 bg-red-400/10 text-white shadow-sm"
                    : "border-white/5 bg-white/[0.02] text-slate-500"
                }`}
              >
                <div className="text-[10px] uppercase font-bold text-red-300">2. Pollution Detected</div>
                <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                  <span>PM2.5: 395</span>
                  {exchangeStep >= 2 && <CheckCircle2 size={12} className="text-red-400 ml-auto" />}
                </div>
                <div className="text-[11px] text-red-300 font-medium mt-0.5">Critical Severity (AQI 435)</div>
              </div>

              {/* Step 3 */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  exchangeStep >= 3
                    ? "border-blue-400/50 bg-blue-400/10 text-white shadow-sm"
                    : "border-white/5 bg-white/[0.02] text-slate-500"
                }`}
              >
                <div className="text-[10px] uppercase font-bold text-blue-300">3. BRICS Network</div>
                <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                  <span>🌐 Shared Instantly</span>
                  {exchangeStep >= 3 && <CheckCircle2 size={12} className="text-blue-400 ml-auto" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Dispatched to China Node</div>
              </div>

              {/* Step 4 */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  exchangeStep >= 4
                    ? "border-purple-400/50 bg-purple-400/10 text-white shadow-sm"
                    : "border-white/5 bg-white/[0.02] text-slate-500"
                }`}
              >
                <div className="text-[10px] uppercase font-bold text-purple-300">4. Affected Country</div>
                <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                  <span>🇨🇳 China</span>
                  {exchangeStep >= 4 && <CheckCircle2 size={12} className="text-purple-400 ml-auto" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Tibet / Western Border</div>
              </div>

              {/* Step 5 */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  exchangeStep >= 4
                    ? "border-emerald-400/50 bg-emerald-400/10 text-white shadow-sm"
                    : "border-white/5 bg-white/[0.02] text-slate-500"
                }`}
              >
                <div className="text-[10px] uppercase font-bold text-emerald-300">5. Predicted Impact</div>
                <div className="text-sm font-bold mt-1 flex items-center gap-1.5">
                  <span>In ~8 Hours</span>
                  {exchangeStep >= 4 && <CheckCircle2 size={12} className="text-emerald-400 ml-auto" />}
                </div>
                <div className="text-[11px] text-emerald-300 font-medium mt-0.5">PM2.5: ~142 µg/m³ (High)</div>
              </div>
            </div>
          </div>

          {/* ── 2. Current Event & Cross-Border Prediction Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card 1: Current Pollution Event */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-400" />
                  <h2 className="text-sm font-bold text-white">Current Pollution Event</h2>
                </div>
                <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-bold text-red-400 uppercase tracking-wider">
                  Critical
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Source Country</span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span>🇮🇳</span> India (Delhi NCR)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Pollution Type</span>
                  <span className="font-semibold text-slate-200">
                    Agricultural Stubble & Smoke
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Pollution Level</span>
                  <span className="font-bold font-mono text-red-300">
                    PM2.5: 395 µg/m³ <span className="text-slate-500 font-normal">(AQI 435)</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Data Origin</span>
                  <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Verified Ground Station Telemetry
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Cross-Border Prediction */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Wind size={18} className="text-cyan-400" />
                  <h2 className="text-sm font-bold text-white">Cross-Border Prediction</h2>
                </div>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  {exchangeResult ? "Prediction Active" : "Ready"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Movement Route</span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <span>🇮🇳 India</span>
                    <ArrowRight size={12} className="text-slate-500" />
                    <span>🇨🇳 China</span>
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Predicted Arrival Time</span>
                  <span className="font-bold font-mono text-cyan-300 flex items-center gap-1">
                    <Clock size={12} />
                    In ~{exchangeResult?.crossBorderPrediction?.estimatedArrivalHours || 8} hours
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Predicted Impact</span>
                  <span className="font-bold text-purple-300">
                    High (PM2.5: ~{exchangeResult?.crossBorderPrediction?.predictedPollutionLevel.pm2_5 || 142} µg/m³)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Prediction Confidence</span>
                  <span className="font-bold text-emerald-400">
                    {exchangeResult?.crossBorderPrediction?.confidence || 88}% Confidence
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. Simple Visual Map / Movement Path ── */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-emerald-400" />
                <h2 className="text-sm font-bold text-white">Visual Movement Path</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Distance: ~216 km · Estimated Travel: ~8h
              </span>
            </div>

            {/* Interactive SVG Path */}
            <div className="relative w-full h-36 rounded-xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-white/5 p-4 flex items-center justify-between overflow-hidden">
              {/* Background grid lines */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

              {/* Source: India */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-full bg-orange-500/20 border-2 border-orange-400 flex items-center justify-center text-lg shadow-lg shadow-orange-500/30 animate-pulse">
                  🇮🇳
                </div>
                <span className="text-xs font-bold text-white mt-1.5">India</span>
                <span className="text-[10px] text-orange-300 font-medium">Source (PM2.5: 395)</span>
              </div>

              {/* Moving Vector / Trajectory Line */}
              <div className="relative z-10 flex-1 mx-4 sm:mx-8 flex flex-col items-center">
                <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Wind size={12} className="animate-spin text-cyan-400" />
                  <span>North-East Wind Advection</span>
                </div>

                <div className="relative w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-cyan-400 to-purple-400 animate-[pulse_2s_ease-in-out_infinite]" />
                </div>

                <div className="flex items-center justify-between w-full text-[10px] text-slate-400 mt-1.5">
                  <span>Start (T+0h)</span>
                  <span className="rounded-md bg-white/5 px-2 py-0.5 border border-white/10 text-slate-300 font-mono">
                    Crossing Frontier (~4h)
                  </span>
                  <span>Arrival (T+8h)</span>
                </div>
              </div>

              {/* Target: China */}
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 border-2 border-purple-400 flex items-center justify-center text-lg shadow-lg shadow-purple-500/30">
                  🇨🇳
                </div>
                <span className="text-xs font-bold text-white mt-1.5">China</span>
                <span className="text-[10px] text-purple-300 font-medium">Recipient Node</span>
              </div>
            </div>
          </div>

          {/* ── 4. Country Nodes (Clean & Minimal) ── */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-5 shadow-lg backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Radio size={16} className="text-emerald-400" />
                BRICS Member Country Nodes ({nodes.length || 11} Nations)
              </h2>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                All Nodes Active
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {nodes.map((node) => (
                <div
                  key={node.nodeId}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-2.5 hover:border-emerald-400/30 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{node.flag}</span>
                    <div>
                      <span className="text-xs font-bold text-white block leading-tight">{node.countryName}</span>
                      <span className="text-[9px] text-slate-500 uppercase">{node.countryCode}</span>
                    </div>
                  </div>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400" title="Node Active" />
                </div>
              ))}
            </div>
          </div>

          {/* ── 5. Collapsible Technical Details (For Developers & Experts) ── */}
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="w-full flex items-center justify-between p-4 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/[0.02] transition"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-emerald-400" />
                <span>Technical & Atmospheric Data Details</span>
              </div>
              {showTechnicalDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showTechnicalDetails && (
              <div className="p-4 pt-0 border-t border-white/5 text-xs text-slate-400 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3">
                  <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Atmospheric Context</div>
                    <div className="font-semibold text-white mt-1">
                      {exchangeResult?.meteorologicalContext ? (
                        <>
                          {exchangeResult.meteorologicalContext.windSpeedKmh} km/h from {exchangeResult.meteorologicalContext.windDirectionCompass} ({exchangeResult.meteorologicalContext.windDirectionDegrees}°)
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Temp: {exchangeResult.meteorologicalContext.temperatureC}°C · Humidity: {exchangeResult.meteorologicalContext.relativeHumidityPercent}%
                          </div>
                        </>
                      ) : (
                        "Open-Meteo Weather API Telemetry"
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Prediction Engine</div>
                    <div className="font-semibold text-purple-300 mt-1">
                      RuleBasedLagrangianModel v1.0
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      13-step advection polyline with exponential dilution
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/40 p-3">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Target Node Status</div>
                    <div className="font-semibold text-emerald-300 mt-1">
                      {exchangeResult?.targetNodeReceipt ? (
                        `China (${exchangeResult.targetNodeReceipt.status})`
                      ) : (
                        "Auto-Synchronized Heartbeat"
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      API: POST /api/brics/federation/exchange-live
                    </div>
                  </div>
                </div>

                {exchangeResult && (
                  <div className="mt-2">
                    <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Standardized Event JSON</div>
                    <pre className="rounded-xl bg-black/60 border border-white/5 p-3 text-[10px] font-mono text-emerald-300 overflow-x-auto">
                      {JSON.stringify(exchangeResult.event, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
